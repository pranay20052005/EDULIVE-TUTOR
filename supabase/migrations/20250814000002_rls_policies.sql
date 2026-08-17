-- ============================================================
-- EduLive Row Level Security (RLS) Policies
-- Phase 1: Foundation
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_insert_signup" ON users;
DROP POLICY IF EXISTS "users_insert_public" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- Authenticated users can read their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "users_select_admin" ON users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- New authenticated users can insert their own profile
CREATE POLICY "users_insert_own" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile (non-sensitive fields)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- STUDENTS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "students_select_own" ON students;
DROP POLICY IF EXISTS "students_select_teacher_subjects" ON students;
DROP POLICY IF EXISTS "students_insert_own" ON students;
DROP POLICY IF EXISTS "students_insert_signup" ON students;
DROP POLICY IF EXISTS "students_insert_public" ON students;
DROP POLICY IF EXISTS "students_update_own" ON students;

-- Students can read their own profile
CREATE POLICY "students_select_own" ON students
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- New authenticated users can insert their own student profile
CREATE POLICY "students_insert_own" ON students
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Students can update their own profile
CREATE POLICY "students_update_own" ON students
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- TEACHERS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "teachers_select_own" ON teachers;
DROP POLICY IF EXISTS "teachers_update_own" ON teachers;

-- Teachers can read their own profile
CREATE POLICY "teachers_select_own" ON teachers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Teachers can update their own profile
CREATE POLICY "teachers_update_own" ON teachers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- SUBJECTS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "subjects_select_published" ON subjects;
DROP POLICY IF EXISTS "subjects_select_own_teacher" ON subjects;
DROP POLICY IF EXISTS "subjects_insert_teacher" ON subjects;
DROP POLICY IF EXISTS "subjects_update_own_teacher" ON subjects;

-- Anyone can read published subjects
CREATE POLICY "subjects_select_published" ON subjects
  FOR SELECT
  USING (status = 'published' OR auth.role() = 'authenticated');

-- Teachers can read/edit their own subjects
CREATE POLICY "subjects_select_own_teacher" ON subjects
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

CREATE POLICY "subjects_insert_teacher" ON subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "subjects_update_own_teacher" ON subjects
  FOR UPDATE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ============================================================
-- ENROLLMENTS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "enrollments_select_own" ON enrollments;
DROP POLICY IF EXISTS "enrollments_select_teacher_subjects" ON enrollments;
DROP POLICY IF EXISTS "enrollments_select_admin" ON enrollments;

-- Students can read their own enrollments
CREATE POLICY "enrollments_select_own" ON enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Teachers can read enrollments in their subjects
CREATE POLICY "enrollments_select_teacher_subjects" ON enrollments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = enrollments.subject_id
        AND subjects.teacher_id = (
          SELECT id FROM teachers WHERE user_id = auth.uid()
        )
    )
  );

-- Admins can read all enrollments
CREATE POLICY "enrollments_select_admin" ON enrollments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.user_id = auth.uid()
    )
  );

-- ============================================================
-- TESTS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tests_select_published" ON tests;
DROP POLICY IF EXISTS "tests_select_own_teacher" ON tests;
DROP POLICY IF EXISTS "tests_insert_teacher" ON tests;
DROP POLICY IF EXISTS "tests_update_own_teacher" ON tests;

-- Published tests visible to all authenticated users
CREATE POLICY "tests_select_published" ON tests
  FOR SELECT
  USING (status = 'published');

-- Teachers can manage their own tests
CREATE POLICY "tests_select_own_teacher" ON tests
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "tests_insert_teacher" ON tests
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "tests_update_own_teacher" ON tests
  FOR UPDATE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ============================================================
-- TEST ATTEMPTS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "test_attempts_select_own" ON test_attempts;
DROP POLICY IF EXISTS "test_attempts_insert_student" ON test_attempts;
DROP POLICY IF EXISTS "test_attempts_select_teacher" ON test_attempts;

-- Students can see their own attempts
CREATE POLICY "test_attempts_select_own" ON test_attempts
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Students can create attempts for published tests they're enrolled in
CREATE POLICY "test_attempts_insert_student" ON test_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM tests t
      JOIN enrollments e ON t.subject_id = e.subject_id
      WHERE t.id = test_attempts.test_id
        AND e.student_id = test_attempts.student_id
        AND t.status = 'published'
    )
  );

-- Teachers can see attempts for their tests
CREATE POLICY "test_attempts_select_teacher" ON test_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_attempts.test_id
        AND tests.teacher_id = (
          SELECT id FROM teachers WHERE user_id = auth.uid()
        )
    )
  );

-- ============================================================
-- ASSIGNMENTS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "assignments_select_published" ON assignments;
DROP POLICY IF EXISTS "assignments_select_own_teacher" ON assignments;
DROP POLICY IF EXISTS "assignments_insert_teacher" ON assignments;

-- Published assignments visible to authenticated users
CREATE POLICY "assignments_select_published" ON assignments
  FOR SELECT
  USING (status = 'published');

-- Teachers can manage their own assignments
CREATE POLICY "assignments_select_own_teacher" ON assignments
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "assignments_insert_teacher" ON assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ============================================================
-- SCHEDULED CLASSES POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "scheduled_classes_select_published" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_select_own_teacher" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_insert_teacher" ON scheduled_classes;

-- Published classes visible to all
CREATE POLICY "scheduled_classes_select_published" ON scheduled_classes
  FOR SELECT
  USING (status != 'draft');

-- Teachers can manage their own classes
CREATE POLICY "scheduled_classes_select_own_teacher" ON scheduled_classes
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "scheduled_classes_insert_teacher" ON scheduled_classes
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ============================================================
-- ATTENDANCE POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "attendance_select_own" ON attendance;
DROP POLICY IF EXISTS "attendance_select_teacher" ON attendance;
DROP POLICY IF EXISTS "attendance_insert_teacher" ON attendance;
DROP POLICY IF EXISTS "attendance_update_teacher" ON attendance;

-- Students can read their own attendance
CREATE POLICY "attendance_select_own" ON attendance
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- Teachers can read attendance for their subjects
CREATE POLICY "attendance_select_teacher" ON attendance
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- Teachers can create/update attendance for their subjects
CREATE POLICY "attendance_insert_teacher" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "attendance_update_teacher" ON attendance
  FOR UPDATE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

-- Users can read their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- MATERIALS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "materials_select_published" ON materials;
DROP POLICY IF EXISTS "materials_select_own_teacher" ON materials;
DROP POLICY IF EXISTS "materials_insert_teacher" ON materials;

-- Published materials visible to authenticated users
CREATE POLICY "materials_select_published" ON materials
  FOR SELECT
  USING (status = 'published');

-- Teachers can manage their own materials
CREATE POLICY "materials_select_own_teacher" ON materials
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
  );

CREATE POLICY "materials_insert_teacher" ON materials
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- ============================================================
-- RECORDINGS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "recordings_select_published" ON recordings;
DROP POLICY IF EXISTS "recordings_select_own_teacher" ON recordings;

-- Published recordings visible to all
CREATE POLICY "recordings_select_published" ON recordings
  FOR SELECT
  USING (status = 'published');

-- Teachers can manage their own recordings
CREATE POLICY "recordings_select_own_teacher" ON recordings
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
  );

-- ============================================================
-- ADMIN POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "admins_select_own" ON admins;

-- Admins can only see their own admin record
CREATE POLICY "admins_select_own" ON admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
