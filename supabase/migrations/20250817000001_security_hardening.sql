-- ============================================================================
-- EduLive Migration: Security Hardening, RLS Lockdown & Data Integrity
-- ============================================================================

-- 1. Add status column to students table if not present
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

-- 2. Alter subjects.teacher_id foreign key constraint to prevent catastrophic cascade deletes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_name = 'subjects' 
      AND constraint_name = 'subjects_teacher_id_fkey'
  ) THEN
    ALTER TABLE public.subjects DROP CONSTRAINT subjects_teacher_id_fkey;
    ALTER TABLE public.subjects 
      ADD CONSTRAINT subjects_teacher_id_fkey 
      FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 3. Lock down PAYMENTS table RLS:
-- Direct UPDATE by students is STRICTLY REVOKED (only Admins or Service Role / Server Functions can update payment status).
DROP POLICY IF EXISTS "payments_update_admin_or_system" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;

CREATE POLICY "payments_update_admin"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Lock down ENROLLMENTS table RLS:
-- Students cannot arbitrarily insert active enrollments for paid courses.
DROP POLICY IF EXISTS "enrollments_insert_authenticated" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_own_or_admin" ON public.enrollments;

CREATE POLICY "enrollments_insert_safe"
  ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR (
      student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE subjects.id = enrollments.subject_id 
          AND (subjects.price_inr IS NULL OR subjects.price_inr = 0)
      )
    )
  );

-- 5. Lock down USERS table RLS:
-- Revoke global 'USING (true)' read policy.
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;

CREATE POLICY "users_select_scoped"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.subjects s ON s.teacher_id = t.id
      JOIN public.enrollments e ON e.subject_id = s.id
      JOIN public.students st ON st.id = e.student_id
      WHERE t.user_id = auth.uid() AND st.user_id = users.id
    )
    OR EXISTS (
      SELECT 1 FROM public.students st
      JOIN public.enrollments e ON e.student_id = st.id
      JOIN public.subjects s ON s.id = e.subject_id
      JOIN public.teachers t ON t.id = s.teacher_id
      WHERE st.user_id = auth.uid() AND t.user_id = users.id
    )
  );

-- 6. Lock down COURSE CERTIFICATES RLS:
-- Revoke student FOR ALL policy. Students have SELECT-only permission for their own certificates.
DROP POLICY IF EXISTS "certificates_manage_policy" ON public.course_certificates;

CREATE POLICY "certificates_manage_admin_teacher"
  ON public.course_certificates FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subjects s
      JOIN public.teachers t ON t.id = s.teacher_id
      WHERE s.id = course_certificates.subject_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subjects s
      JOIN public.teachers t ON t.id = s.teacher_id
      WHERE s.id = course_certificates.subject_id AND t.user_id = auth.uid()
    )
  );

-- 7. Lock down NOTIFICATIONS RLS:
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;

CREATE POLICY "notifications_insert_scoped"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.subjects s ON s.teacher_id = t.id
      JOIN public.enrollments e ON e.subject_id = s.id
      JOIN public.students st ON st.id = e.student_id
      WHERE t.user_id = auth.uid() AND st.user_id = notifications.user_id
    )
  );

-- 8. Lock down TEST QUESTIONS RLS:
DROP POLICY IF EXISTS "test_questions_select_all" ON public.test_questions;

CREATE POLICY "test_questions_select_authorized"
  ON public.test_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers tr ON tr.id = t.teacher_id
      WHERE t.id = test_questions.test_id AND tr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.enrollments e ON e.subject_id = t.subject_id
      JOIN public.students s ON s.id = e.student_id
      WHERE t.id = test_questions.test_id AND s.user_id = auth.uid() AND e.status = 'active'
    )
  );

