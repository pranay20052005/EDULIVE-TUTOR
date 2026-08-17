-- Fix RLS policies to allow registration
-- Add missing INSERT policies for users and students tables

-- Drop old policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "students_insert_own" ON students;

-- Create INSERT policy for users table
CREATE POLICY "users_insert_own" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create INSERT policy for students table
CREATE POLICY "students_insert_own" ON students
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Verify policies were created
SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('users', 'students') ORDER BY tablename, policyname;
