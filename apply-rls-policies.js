import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// SQL to apply
const sql = `
-- Fix RLS policies to allow registration
-- Add missing INSERT policies for users and students tables

-- Drop old policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "students_insert_own" ON public.students;

-- Create INSERT policy for users table
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create INSERT policy for students table
CREATE POLICY "students_insert_own" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Verify policies were created
SELECT schemaname, tablename, policyname FROM pg_policies 
WHERE tablename IN ('users', 'students') 
ORDER BY tablename, policyname;
`;

async function applyPolicies() {
  try {
    console.log("Applying RLS policies...");
    const { data, error } = await supabase.rpc("exec_sql", { sql });

    if (error) {
      console.error("Error applying policies:", error);
      process.exit(1);
    }

    console.log("✓ RLS policies applied successfully");
    console.log("Policies:", data);
  } catch (err) {
    console.error("Exception:", err);
    process.exit(1);
  }
}

applyPolicies();
