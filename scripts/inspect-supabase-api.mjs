import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Service Key:", serviceRoleKey ? "Found" : "Missing");
console.log("Anon Key:", anonKey ? "Found" : "Missing");

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function main() {
  console.log("\n--- Checking Users table (Admin) ---");
  const { data: users, error: uErr } = await supabaseAdmin.from("users").select("*");
  if (uErr) console.error("Users error:", uErr);
  else console.table(users);

  console.log("\n--- Checking Students table (Admin) ---");
  const { data: students, error: sErr } = await supabaseAdmin
    .from("students")
    .select("*, user:users(*)");
  if (sErr) console.error("Students error:", sErr);
  else
    console.table(
      students.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        name: s.user?.name,
        email: s.user?.email,
      })),
    );

  console.log("\n--- Checking Teachers table (Admin) ---");
  const { data: teachers, error: tErr } = await supabaseAdmin
    .from("teachers")
    .select("*, user:users(*)");
  if (tErr) console.error("Teachers error:", tErr);
  else
    console.table(
      teachers.map((t) => ({
        id: t.id,
        user_id: t.user_id,
        name: t.user?.name,
        email: t.user?.email,
      })),
    );

  console.log("\n--- Checking Subjects table (Admin) ---");
  const { data: subjects, error: subErr } = await supabaseAdmin.from("subjects").select("*");
  if (subErr) console.error("Subjects error:", subErr);
  else
    console.table(
      subjects.map((s) => ({ id: s.id, name: s.name, price_inr: s.price_inr, status: s.status })),
    );

  console.log("\n--- Checking Enrollments table (Admin) ---");
  const { data: enrollments, error: eErr } = await supabaseAdmin.from("enrollments").select("*");
  if (eErr) console.error("Enrollments error:", eErr);
  else console.table(enrollments);

  console.log("\n--- Checking Payments table (Admin) ---");
  const { data: payments, error: pErr } = await supabaseAdmin.from("payments").select("*");
  if (pErr) console.error("Payments error:", pErr);
  else console.table(payments);

  console.log("\n--- Checking Supabase Auth Users ---");
  const { data: authUsers, error: aErr } = await supabaseAdmin.auth.admin.listUsers();
  if (aErr) console.error("Auth Users error:", aErr);
  else
    console.table(
      authUsers.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })),
    );
}

main();
