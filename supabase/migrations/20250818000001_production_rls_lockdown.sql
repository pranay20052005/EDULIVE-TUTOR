-- ============================================================================
-- EduLive Production Migration: Comprehensive RLS Lockdown & Security Hardening
-- ============================================================================

-- Helper functions (SECURITY DEFINER to prevent recursive policy evaluations)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.subjects s ON s.teacher_id = t.id
    JOIN public.enrollments e ON e.subject_id = s.id
    JOIN public.students st ON st.id = e.student_id
    WHERE t.user_id = auth.uid() AND st.user_id = target_user_id
  );
$$;

-- Ensure RLS is enabled on all tables
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_recording_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.batch_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_certificates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. TEST QUESTIONS: Students must NEVER directly SELECT from test_questions
--    (Students get questions via getStudentTestFn which strips answer keys)
-- ============================================================================
DROP POLICY IF EXISTS "test_questions_select_all" ON public.test_questions;
DROP POLICY IF EXISTS "test_questions_select_authorized" ON public.test_questions;
DROP POLICY IF EXISTS "test_questions_select_teacher_or_admin" ON public.test_questions;

CREATE POLICY "test_questions_select_teacher_or_admin"
  ON public.test_questions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers tr ON tr.id = t.teacher_id
      WHERE t.id = test_questions.test_id AND tr.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. PAYMENTS: Students must NEVER directly UPDATE payment status
--    (Verification and status transitions occur strictly via verifyPaymentFn)
-- ============================================================================
DROP POLICY IF EXISTS "payments_update_admin_or_system" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin_only" ON public.payments;

CREATE POLICY "payments_update_admin_only"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 3. ENROLLMENTS: Students cannot self-enroll in paid courses or update status
-- ============================================================================
DROP POLICY IF EXISTS "enrollments_insert_authenticated" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_safe" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_free_or_admin" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_admin_or_own" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_admin" ON public.enrollments;

CREATE POLICY "enrollments_insert_free_or_admin"
  ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE subjects.id = enrollments.subject_id 
          AND (subjects.price_inr IS NULL OR subjects.price_inr = 0)
      )
    )
  );

CREATE POLICY "enrollments_update_admin"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. TEST ATTEMPTS & ANSWERS: Students cannot tamper with scores, marks or grading
--    (Grading and submission occurs exclusively via submitTestAttemptFn)
-- ============================================================================
DROP POLICY IF EXISTS "test_attempts_update_student_or_teacher" ON public.test_attempts;
DROP POLICY IF EXISTS "test_attempts_update_teacher_or_admin" ON public.test_attempts;

CREATE POLICY "test_attempts_update_teacher_or_admin"
  ON public.test_attempts FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers tr ON tr.id = t.teacher_id
      WHERE t.id = test_attempts.test_id AND tr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers tr ON tr.id = t.teacher_id
      WHERE t.id = test_attempts.test_id AND tr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_answers_update_student_or_teacher" ON public.test_answers;
DROP POLICY IF EXISTS "test_answers_update_teacher_or_admin" ON public.test_answers;

CREATE POLICY "test_answers_update_teacher_or_admin"
  ON public.test_answers FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.test_attempts ta
      JOIN public.tests t ON t.id = ta.test_id
      JOIN public.teachers tr ON tr.id = t.teacher_id
      WHERE ta.id = test_answers.attempt_id AND tr.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. USERS: Eliminate unrestricted SELECT; scope to self, teachers, enrolled
-- ============================================================================
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_scoped" ON public.users;

CREATE POLICY "users_select_scoped"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR role = 'teacher'
    OR public.is_admin()
    OR public.is_teacher_of_student(id)
  );

-- ============================================================================
-- 6. TESTS: Add explicit DELETE policy for teacher or admin
-- ============================================================================
DROP POLICY IF EXISTS "tests_delete_teacher_or_admin" ON public.tests;

CREATE POLICY "tests_delete_teacher_or_admin"
  ON public.tests FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );
