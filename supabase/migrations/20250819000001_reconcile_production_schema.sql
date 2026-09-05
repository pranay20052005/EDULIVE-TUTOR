-- ============================================================================
-- EduLive Migration: Production Reconciliation & Canonical Security Hardening
-- ============================================================================
-- Forward migration to reconcile production schema with repository canonical state:
-- 1. Ensure students.status column and index
-- 2. Restrict subjects foreign key to prevent cascade-delete of courses
-- 3. Codify ensure_user_role_profile trigger function and trigger
-- 4. Codify canonical RLS policies for materials, assignments, subjects, attendance,
--    teachers, test_attempts, course_certificates, and notifications.
-- ============================================================================

-- 1. Students status column and index
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

UPDATE public.students 
  SET status = 'active' 
  WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

-- 2. Subjects teacher_id foreign key constraint: ON DELETE RESTRICT
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

-- 3. User role profile auto-provisioning trigger function
CREATE OR REPLACE FUNCTION public.ensure_user_role_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO admins (id, user_id, created_at, updated_at)
    VALUES (gen_random_uuid(), NEW.id, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF NEW.role = 'teacher' THEN
    INSERT INTO teachers (id, user_id, qualification, experience_years, bio, created_at, updated_at)
    VALUES (gen_random_uuid(), NEW.id, 'Faculty', 1, 'Faculty Member', NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF NEW.role = 'student' THEN
    INSERT INTO students (id, user_id, standard, board, created_at, updated_at)
    VALUES (gen_random_uuid(), NEW.id, '10th', 'CBSE', NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_user_role_profile ON public.users;
CREATE TRIGGER trg_ensure_user_role_profile
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_role_profile();

-- 4. Materials table canonical CRUD RLS policies
DROP POLICY IF EXISTS "materials_insert_teacher" ON public.materials;
CREATE POLICY "materials_insert_teacher" ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "materials_select_own_teacher" ON public.materials;
CREATE POLICY "materials_select_own_teacher" ON public.materials
  FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid()) OR
    (EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = materials.subject_id
      AND subjects.teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())
    )) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "materials_select_published" ON public.materials;
CREATE POLICY "materials_select_published" ON public.materials
  FOR SELECT TO public
  USING (status = 'published'::publish_status);

DROP POLICY IF EXISTS "materials_update_teacher_or_admin" ON public.materials;
CREATE POLICY "materials_update_teacher_or_admin" ON public.materials
  FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  )
  WITH CHECK (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "materials_delete_teacher_or_admin" ON public.materials;
CREATE POLICY "materials_delete_teacher_or_admin" ON public.materials
  FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

-- 5. Assignments table canonical CRUD RLS policies
DROP POLICY IF EXISTS "assignments_insert_teacher" ON public.assignments;
CREATE POLICY "assignments_insert_teacher" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "assignments_select_own_teacher" ON public.assignments;
CREATE POLICY "assignments_select_own_teacher" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "assignments_select_published" ON public.assignments;
CREATE POLICY "assignments_select_published" ON public.assignments
  FOR SELECT TO public
  USING (status = 'published'::publish_status);

DROP POLICY IF EXISTS "assignments_update_teacher_or_admin" ON public.assignments;
CREATE POLICY "assignments_update_teacher_or_admin" ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  )
  WITH CHECK (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "assignments_delete_teacher_or_admin" ON public.assignments;
CREATE POLICY "assignments_delete_teacher_or_admin" ON public.assignments
  FOR DELETE TO authenticated
  USING (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

-- 6. Subjects table canonical RLS policies
DROP POLICY IF EXISTS "subjects_insert_teacher" ON public.subjects;
DROP POLICY IF EXISTS "subjects_insert_admin_or_teacher" ON public.subjects;
CREATE POLICY "subjects_insert_admin_or_teacher" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "subjects_update_own_teacher" ON public.subjects;
DROP POLICY IF EXISTS "subjects_update_admin_or_teacher" ON public.subjects;
CREATE POLICY "subjects_update_admin_or_teacher" ON public.subjects
  FOR UPDATE TO authenticated
  USING (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  )
  WITH CHECK (
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "subjects_delete_admin" ON public.subjects;
CREATE POLICY "subjects_delete_admin" ON public.subjects
  FOR DELETE TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

-- 7. Teachers, Attendance & Test Attempts policies
DROP POLICY IF EXISTS "teachers_insert_admin" ON public.teachers;
CREATE POLICY "teachers_insert_admin" ON public.teachers
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid()) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "attendance_select_admin" ON public.attendance;
CREATE POLICY "attendance_select_admin" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    (student_id = (SELECT students.id FROM students WHERE students.user_id = auth.uid())) OR
    (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "test_attempts_select_admin" ON public.test_attempts;
CREATE POLICY "test_attempts_select_admin" ON public.test_attempts
  FOR SELECT TO authenticated
  USING (
    (student_id = (SELECT students.id FROM students WHERE students.user_id = auth.uid())) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())) OR
    (EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_attempts.test_id
      AND tests.teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())
    ))
  );

-- 8. Course Certificates & Notifications security lockdown
DROP POLICY IF EXISTS "certificates_manage_policy" ON public.course_certificates;
DROP POLICY IF EXISTS "certificates_manage_admin_teacher" ON public.course_certificates;
CREATE POLICY "certificates_manage_admin_teacher" ON public.course_certificates
  FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.subjects s
      JOIN public.teachers t ON t.id = s.teacher_id
      WHERE s.id = course_certificates.subject_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.subjects s
      JOIN public.teachers t ON t.id = s.teacher_id
      WHERE s.id = course_certificates.subject_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_scoped" ON public.notifications;
CREATE POLICY "notifications_insert_scoped" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.subjects s ON s.teacher_id = t.id
      JOIN public.enrollments e ON e.subject_id = s.id
      JOIN public.students st ON st.id = e.student_id
      WHERE t.user_id = auth.uid() AND st.user_id = notifications.user_id
    )
  );
