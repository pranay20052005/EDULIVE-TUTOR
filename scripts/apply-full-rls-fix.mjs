import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const client = new Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.jrknrglxivqmddoqqcjh",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const sql = `
-- ============================================================
-- 1. Extend payment_status enum with completed and refunded if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = 'payment_status'::regtype) THEN
    ALTER TYPE payment_status ADD VALUE 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'refunded' AND enumtypid = 'payment_status'::regtype) THEN
    ALTER TYPE payment_status ADD VALUE 'refunded';
  END IF;
END $$;

-- ============================================================
-- 2. ENROLLMENTS POLICIES (Fix missing INSERT and UPDATE)
-- ============================================================
DROP POLICY IF EXISTS "enrollments_select_own" ON enrollments;
DROP POLICY IF EXISTS "enrollments_select_teacher_subjects" ON enrollments;
DROP POLICY IF EXISTS "enrollments_select_admin" ON enrollments;
DROP POLICY IF EXISTS "enrollments_insert_own_or_admin" ON enrollments;
DROP POLICY IF EXISTS "enrollments_update_own_or_admin" ON enrollments;

CREATE POLICY "enrollments_select_own" ON enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "enrollments_select_teacher_subjects" ON enrollments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = enrollments.subject_id
        AND subjects.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "enrollments_select_admin" ON enrollments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "enrollments_insert_own_or_admin" ON enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "enrollments_update_own_or_admin" ON enrollments
  FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. PAYMENTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "payments_select_own" ON payments;
DROP POLICY IF EXISTS "payments_select_admin" ON payments;
DROP POLICY IF EXISTS "payments_insert_own_or_admin" ON payments;
DROP POLICY IF EXISTS "payments_update_admin" ON payments;

CREATE POLICY "payments_select_own" ON payments
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_select_admin" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_insert_own_or_admin" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_update_admin" ON payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 4. CHAPTERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "chapters_select_all" ON chapters;
DROP POLICY IF EXISTS "chapters_insert_teacher_or_admin" ON chapters;
DROP POLICY IF EXISTS "chapters_update_teacher_or_admin" ON chapters;
DROP POLICY IF EXISTS "chapters_delete_teacher_or_admin" ON chapters;

CREATE POLICY "chapters_select_all" ON chapters
  FOR SELECT
  USING (true);

CREATE POLICY "chapters_insert_teacher_or_admin" ON chapters
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = chapters.subject_id
        AND subjects.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "chapters_update_teacher_or_admin" ON chapters
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = chapters.subject_id
        AND subjects.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "chapters_delete_teacher_or_admin" ON chapters
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = chapters.subject_id
        AND subjects.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 5. QUESTION PAPERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "question_papers_select_published" ON question_papers;
DROP POLICY IF EXISTS "question_papers_select_own_teacher" ON question_papers;
DROP POLICY IF EXISTS "question_papers_select_admin" ON question_papers;
DROP POLICY IF EXISTS "question_papers_insert_teacher_or_admin" ON question_papers;
DROP POLICY IF EXISTS "question_papers_update_teacher_or_admin" ON question_papers;
DROP POLICY IF EXISTS "question_papers_delete_teacher_or_admin" ON question_papers;

CREATE POLICY "question_papers_select_published" ON question_papers
  FOR SELECT
  USING (status = 'published'::publish_status);

CREATE POLICY "question_papers_select_own_teacher" ON question_papers
  FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "question_papers_select_admin" ON question_papers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "question_papers_insert_teacher_or_admin" ON question_papers
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "question_papers_update_teacher_or_admin" ON question_papers
  FOR UPDATE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "question_papers_delete_teacher_or_admin" ON question_papers
  FOR DELETE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 6. ASSIGNMENT SUBMISSIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "assignment_submissions_select_own" ON assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions_select_teacher" ON assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions_select_admin" ON assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions_insert_student" ON assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions_update_student_or_teacher" ON assignment_submissions;

CREATE POLICY "assignment_submissions_select_own" ON assignment_submissions
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "assignment_submissions_select_teacher" ON assignment_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.id = assignment_submissions.assignment_id
        AND s.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "assignment_submissions_select_admin" ON assignment_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "assignment_submissions_insert_student" ON assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "assignment_submissions_update_student_or_teacher" ON assignment_submissions
  FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM assignments a
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.id = assignment_submissions.assignment_id
        AND s.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 7. TEST QUESTIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "test_questions_select_all" ON test_questions;
DROP POLICY IF EXISTS "test_questions_insert_teacher_or_admin" ON test_questions;
DROP POLICY IF EXISTS "test_questions_update_teacher_or_admin" ON test_questions;
DROP POLICY IF EXISTS "test_questions_delete_teacher_or_admin" ON test_questions;

CREATE POLICY "test_questions_select_all" ON test_questions
  FOR SELECT
  USING (true);

CREATE POLICY "test_questions_insert_teacher_or_admin" ON test_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_questions.test_id
        AND tests.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "test_questions_update_teacher_or_admin" ON test_questions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_questions.test_id
        AND tests.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "test_questions_delete_teacher_or_admin" ON test_questions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_questions.test_id
        AND tests.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 8. TEST ANSWERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "test_answers_select_own" ON test_answers;
DROP POLICY IF EXISTS "test_answers_select_teacher" ON test_answers;
DROP POLICY IF EXISTS "test_answers_select_admin" ON test_answers;
DROP POLICY IF EXISTS "test_answers_insert_student" ON test_answers;
DROP POLICY IF EXISTS "test_answers_update_student_or_teacher" ON test_answers;

CREATE POLICY "test_answers_select_own" ON test_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_attempts ta
      WHERE ta.id = test_answers.attempt_id
        AND ta.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "test_answers_select_teacher" ON test_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_attempts ta
      JOIN tests t ON ta.test_id = t.id
      WHERE ta.id = test_answers.attempt_id
        AND t.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "test_answers_select_admin" ON test_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "test_answers_insert_student" ON test_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_attempts ta
      WHERE ta.id = test_answers.attempt_id
        AND ta.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "test_answers_update_student_or_teacher" ON test_answers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM test_attempts ta
      WHERE ta.id = test_answers.attempt_id
        AND ta.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 9. ANNOUNCEMENTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "announcements_select_published" ON announcements;
DROP POLICY IF EXISTS "announcements_manage_admin" ON announcements;

CREATE POLICY "announcements_select_published" ON announcements
  FOR SELECT
  USING (published = true OR auth.role() = 'authenticated');

CREATE POLICY "announcements_manage_admin" ON announcements
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 10. SUBSCRIPTION PLANS & SETTINGS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "subscription_plans_select_all" ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_manage_admin" ON subscription_plans;
DROP POLICY IF EXISTS "settings_select_authenticated" ON settings;
DROP POLICY IF EXISTS "settings_manage_admin" ON settings;

CREATE POLICY "subscription_plans_select_all" ON subscription_plans
  FOR SELECT
  USING (true);

CREATE POLICY "subscription_plans_manage_admin" ON subscription_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "settings_manage_admin" ON settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 11. TEACHERS & USERS PUBLIC READ FOR AUTHENTICATED
-- ============================================================
DROP POLICY IF EXISTS "teachers_select_own" ON teachers;
DROP POLICY IF EXISTS "teachers_select_all" ON teachers;
CREATE POLICY "teachers_select_all" ON teachers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
CREATE POLICY "users_select_authenticated" ON users
  FOR SELECT TO authenticated
  USING (true);
`;

async function main() {
  try {
    await client.connect();
    console.log("🔗 Connected to Supabase PostgreSQL");
    console.log("Applying comprehensive RLS fixes...");

    await client.query(sql);

    console.log("✅ Successfully applied all RLS policies and enum enhancements!");
  } catch (err) {
    console.error("❌ Migration error:", err);
  } finally {
    await client.end();
  }
}

main();
