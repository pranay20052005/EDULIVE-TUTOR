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
-- Add compatibility columns for test_attempts
ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS marks_obtained INTEGER;
ALTER TABLE test_attempts ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2);

-- Add compatibility column for assignment_submissions
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS content TEXT;

-- Update test_attempts update policy for students submitting their own attempt
DROP POLICY IF EXISTS "test_attempts_update_student_or_teacher" ON test_attempts;
CREATE POLICY "test_attempts_update_student_or_teacher" ON test_attempts
  FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_attempts.test_id
        AND tests.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM tests
      WHERE tests.id = test_attempts.test_id
        AND tests.teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );
`;

async function main() {
  await client.connect();
  await client.query(sql);
  console.log("✓ Applied schema compatibility columns and test_attempts UPDATE policy!");
  await client.end();
}

main();
