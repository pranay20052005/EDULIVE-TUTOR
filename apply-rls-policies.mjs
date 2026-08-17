#!/usr/bin/env node

/**
 * RLS Policy Fix Script
 * Applies missing INSERT policies to users and students tables
 */

import pg from "pg";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error("❌ ERROR: Missing Supabase credentials");
  process.exit(1);
}

// Extract project ID
const projectIdMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectId = projectIdMatch ? projectIdMatch[1] : null;

if (!projectId) {
  console.error("❌ ERROR: Could not extract project ID");
  process.exit(1);
}

const client = new Client({
  host: `db.${projectId}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const queries = [
  `DROP POLICY IF EXISTS "users_insert_own" ON public.users;`,
  `DROP POLICY IF EXISTS "students_insert_own" ON public.students;`,
  `CREATE POLICY "users_insert_own" ON public.users
     FOR INSERT TO authenticated
     WITH CHECK (auth.uid() = id);`,
  `CREATE POLICY "students_insert_own" ON public.students
     FOR INSERT TO authenticated
     WITH CHECK (user_id = auth.uid());`,
  `SELECT schemaname, tablename, policyname FROM pg_policies 
    WHERE tablename IN ('users', 'students') 
    ORDER BY tablename, policyname;`,
];

async function applyPolicies() {
  try {
    await client.connect();
    console.log("✓ Connected to Supabase database");

    for (const query of queries) {
      console.log(`\nExecuting: ${query.substring(0, 50)}...`);
      const result = await client.query(query);
      if (result.rows && result.rows.length > 0) {
        console.log("Result:", JSON.stringify(result.rows, null, 2));
      }
    }

    console.log("\n✓ RLS policies applied successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyPolicies();
