import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("=== CHECKING ADMIN / STUDENTS / TEACHERS QUERIES ===");

  // 1. Check all users in DB
  const { data: users, error: uErr } = await adminClient
    .from("users")
    .select("id, email, role, name");
  console.log("All users in DB via service role:", users);

  const { data: students, error: sErr } = await adminClient
    .from("students")
    .select("*, user:users(*)");
  console.log("All students in DB via service role:", students?.length, students);

  const { data: teachers, error: tErr } = await adminClient
    .from("teachers")
    .select("*, user:users(*)");
  console.log("All teachers in DB via service role:", teachers?.length, teachers);

  // 2. Find an admin user
  const adminUser = users?.find((u) => u.role === "admin");
  console.log("\nFound admin user:", adminUser);

  if (adminUser) {
    // 3. Test querying as an authenticated client with admin JWT if we sign in or test RLS policies
    console.log("\nTesting students & teachers query with anon client...");
    const { data: anonStudents, error: asErr } = await client
      .from("students")
      .select("*, user:users(*)");
    console.log("Anon query students result:", { count: anonStudents?.length, error: asErr });

    const { data: anonTeachers, error: atErr } = await client
      .from("teachers")
      .select("*, user:users(*)");
    console.log("Anon query teachers result:", { count: anonTeachers?.length, error: atErr });
  }
}

main().catch(console.error);
