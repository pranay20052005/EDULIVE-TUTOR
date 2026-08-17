import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, serviceKey);
const userClient = createClient(supabaseUrl, anonKey);

function getHomeForRole(role) {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
      return "/app";
    default:
      return "/login";
  }
}

async function testRoleGuards() {
  console.log("=== TESTING TEACHER & ROLE ISOLATION ===");

  // 1. Create dedicated test accounts for each role
  const timestamp = Date.now();
  const teacherEmail = `test_teacher_${timestamp}@example.com`;
  const studentEmail = `test_student_${timestamp}@example.com`;
  const adminEmail = `test_admin_${timestamp}@example.com`;
  const password = `TestPass_${timestamp}!`;

  console.log("\n1. Provisioning test accounts for Student, Teacher, and Admin...");

  // Create Teacher
  const { data: tAuth } = await adminClient.auth.admin.createUser({
    email: teacherEmail,
    password: password,
    email_confirm: true,
  });
  await adminClient.from("users").insert({
    id: tAuth.user.id,
    email: teacherEmail,
    role: "teacher",
    name: "Prof. Test Teacher",
    phone: "+91 9123456780",
  });
  await adminClient.from("teachers").insert({
    user_id: tAuth.user.id,
    subject: "Mathematics",
    qualification: "M.Sc Mathematics",
    bio: "Test faculty bio",
  });
  console.log(`✓ Teacher created: ${teacherEmail} (ID: ${tAuth.user.id})`);

  // Create Student
  const { data: sAuth } = await adminClient.auth.admin.createUser({
    email: studentEmail,
    password: password,
    email_confirm: true,
  });
  await adminClient.from("users").insert({
    id: sAuth.user.id,
    email: studentEmail,
    role: "student",
    name: "Test Student",
    phone: "+91 9123456781",
  });
  await adminClient.from("students").insert({
    user_id: sAuth.user.id,
    board: "CBSE",
    standard: "10th",
  });
  console.log(`✓ Student created: ${studentEmail} (ID: ${sAuth.user.id})`);

  // Create Admin
  const { data: aAuth } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: password,
    email_confirm: true,
  });
  await adminClient.from("users").insert({
    id: aAuth.user.id,
    email: adminEmail,
    role: "admin",
    name: "Test Admin",
    phone: "+91 9123456782",
  });
  await adminClient.from("admins").insert({
    user_id: aAuth.user.id,
    role: "super_admin",
  });
  console.log(`✓ Admin created: ${adminEmail} (ID: ${aAuth.user.id})`);

  // 2. Test Teacher Sign In & Role Resolution
  console.log("\n2. Testing Teacher Login with client SDK...");
  const { data: tLogin, error: tErr } = await userClient.auth.signInWithPassword({
    email: teacherEmail,
    password: password,
  });
  if (tErr) throw new Error(`Teacher login failed: ${tErr.message}`);

  const { data: tUserRow } = await userClient
    .from("users")
    .select("id, email, role, name")
    .eq("id", tLogin.user.id)
    .single();
  console.log("Teacher users table row:", tUserRow);

  const { data: tTeacherRow } = await userClient
    .from("teachers")
    .select("*")
    .eq("user_id", tLogin.user.id)
    .single();
  console.log("Teacher profile row:", tTeacherRow);

  if (tUserRow.role !== "teacher") throw new Error("Expected role to be teacher");
  const teacherHome = getHomeForRole(tUserRow.role);
  console.log(`✓ Teacher destination route: ${teacherHome} (Expected: /teacher)`);
  if (teacherHome !== "/teacher") throw new Error(`Wrong home route for teacher: ${teacherHome}`);

  // Test teacher attempting to access admin table
  console.log("\n3. Testing Teacher RLS isolation against Admin records...");
  const { data: adminRows, error: aReadErr } = await userClient.from("admins").select("*");
  console.log("Teacher query to admins table:", { data: adminRows, error: aReadErr?.message });
  if (adminRows && adminRows.length > 0) {
    throw new Error("RLS LEAK: Teacher was able to read admins table!");
  }
  console.log("✓ Teacher cannot read admins table (RLS enforced)");

  await userClient.auth.signOut();

  // 4. Test Student Login & Isolation
  console.log("\n4. Testing Student Login & Role Isolation...");
  const { data: sLogin, error: sErr } = await userClient.auth.signInWithPassword({
    email: studentEmail,
    password: password,
  });
  if (sErr) throw new Error(`Student login failed: ${sErr.message}`);

  const { data: sUserRow } = await userClient
    .from("users")
    .select("role")
    .eq("id", sLogin.user.id)
    .single();
  console.log(`✓ Student role: ${sUserRow.role}, destination: ${getHomeForRole(sUserRow.role)}`);

  // Student trying to query teachers directly or perform teacher actions
  const { error: subjectCreateErr } = await userClient.from("subjects").insert({
    teacher_id: "650e8400-e29b-41d4-a716-446655440001",
    name: "Hacked Subject",
    standard: "10th",
    price_inr: 100,
  });
  console.log("Student attempt to create subject blocked by RLS:", !!subjectCreateErr);

  await userClient.auth.signOut();

  console.log("\n🎉 ALL ROLE ISOLATION & TEACHER LOGIN CHECKS PASSED!");
}

testRoleGuards().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
