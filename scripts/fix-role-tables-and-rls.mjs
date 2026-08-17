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

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL...");

  // 1. Insert missing admins records
  await client.query(`
    INSERT INTO admins (id, user_id, created_at, updated_at)
    SELECT gen_random_uuid(), u.id, NOW(), NOW()
    FROM users u
    WHERE u.role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM admins a WHERE a.user_id = u.id);
  `);
  console.log("✓ Ensured admins table rows for all admin users");

  // 2. Insert missing teachers records
  await client.query(`
    INSERT INTO teachers (id, user_id, qualification, experience_years, bio, created_at, updated_at)
    SELECT gen_random_uuid(), u.id, 'M.Sc., B.Ed.', 5, 'Dedicated faculty at EduLive.', NOW(), NOW()
    FROM users u
    WHERE u.role = 'teacher'
    AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.user_id = u.id);
  `);
  console.log("✓ Ensured teachers table rows for all teacher users");

  // 3. Update RLS policies on students table to allow Admins to SELECT, UPDATE, and DELETE
  await client.query(`
    DROP POLICY IF EXISTS students_select_own ON students;
    CREATE POLICY students_select_own ON students
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'teacher')
      );

    DROP POLICY IF EXISTS students_update_own ON students;
    CREATE POLICY students_update_own ON students
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
      )
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
      );
  `);
  console.log("✓ Updated students table RLS policies for admin select and class promotion updates");

  // 4. Update RLS policies on teachers table
  await client.query(`
    DROP POLICY IF EXISTS teachers_select_all ON teachers;
    CREATE POLICY teachers_select_all ON teachers
      FOR SELECT TO authenticated
      USING (true);

    DROP POLICY IF EXISTS teachers_update_own ON teachers;
    CREATE POLICY teachers_update_own ON teachers
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
      );

    DROP POLICY IF EXISTS teachers_insert_admin ON teachers;
    CREATE POLICY teachers_insert_admin ON teachers
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
      );
  `);
  console.log("✓ Updated teachers table RLS policies");

  // 5. Update RLS policies on test_attempts and attendance for admin visibility
  await client.query(`
    DROP POLICY IF EXISTS test_attempts_select_admin ON test_attempts;
    CREATE POLICY test_attempts_select_admin ON test_attempts
      FOR SELECT TO authenticated
      USING (
        student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM tests
          WHERE tests.id = test_attempts.test_id
          AND tests.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
        )
      );

    DROP POLICY IF EXISTS attendance_select_admin ON attendance;
    CREATE POLICY attendance_select_admin ON attendance
      FOR SELECT TO authenticated
      USING (
        student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        OR teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
      );
  `);
  console.log("✓ Updated test_attempts and attendance RLS policies for admin stats calculation");

  // Verify counts
  const finalStudents = await client.query("SELECT COUNT(*) FROM students;");
  const finalTeachers = await client.query("SELECT COUNT(*) FROM teachers;");
  const finalAdmins = await client.query("SELECT COUNT(*) FROM admins;");
  console.log(
    `Current counts in DB -> Students: ${finalStudents.rows[0].count}, Teachers: ${finalTeachers.rows[0].count}, Admins: ${finalAdmins.rows[0].count}`,
  );

  await client.end();
  console.log("Database update completed successfully.");
}

main().catch((err) => {
  console.error("Database update error:", err);
  process.exit(1);
});
