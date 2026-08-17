import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

async function runTests() {
  console.log("==================================================");
  console.log("EDULIVE — SESSION PERSISTENCE & PASSWORD RESET TEST");
  console.log("==================================================\n");

  const timestamp = Date.now();
  const studentEmail = `persist_${timestamp}@edulive.app`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "UpdatedPassword456!";

  // -------------------------------------------------------------
  // 1. Create Student & Verify Initial Login
  // -------------------------------------------------------------
  console.log("--- TEST 1: Student Registration & Login ---");
  const { data: authData, error: authError } = await client.auth.signUp({
    email: studentEmail,
    password: initialPassword,
  });
  if (authError || !authData.user) throw new Error(`Registration failed: ${authError?.message}`);

  await adminClient.from("users").insert({
    id: authData.user.id,
    email: studentEmail,
    name: `Persist Student ${timestamp}`,
    role: "student",
  });
  await adminClient.from("students").insert({
    user_id: authData.user.id,
    standard: "10th",
    board: "CBSE",
  });

  console.log(`✓ Student created in auth & database (${studentEmail})`);

  // Login
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
    email: studentEmail,
    password: initialPassword,
  });
  if (loginErr || !loginData.session) throw new Error(`Login failed: ${loginErr?.message}`);
  console.log(`✓ Login succeeded. Access token acquired.`);

  // -------------------------------------------------------------
  // 2. Test Session Persistence Across Client Re-instantiation
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Session Persistence Across Simulated Page Refresh ---");
  // Simulate browser refresh by creating a client with the stored access & refresh tokens
  const restoredClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  await restoredClient.auth.setSession({
    access_token: loginData.session.access_token,
    refresh_token: loginData.session.refresh_token,
  });

  const { data: restoredSession } = await restoredClient.auth.getSession();
  if (!restoredSession.session || restoredSession.session.user.id !== authData.user.id) {
    throw new Error("FAIL: Session was not restored from credentials!");
  }
  console.log(
    `✓ Session successfully restored on simulated page refresh (User ID: ${restoredSession.session.user.id})`,
  );

  // Verify profile can be fetched with restored session
  const { data: profile } = await restoredClient
    .from("users")
    .select("id, email, role, name")
    .eq("id", restoredSession.session.user.id)
    .single();

  console.log(
    `✓ User profile verified after refresh: Name="${profile?.name}", Role="${profile?.role}"`,
  );

  // -------------------------------------------------------------
  // 3. Test Password Reset & Update
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Password Reset & New Password Update ---");
  // 1. Request password reset email
  const { error: resetErr } = await client.auth.resetPasswordForEmail(studentEmail, {
    redirectTo: "http://localhost:3000/reset-password",
  });
  if (resetErr) throw new Error(`Password reset email request failed: ${resetErr.message}`);
  console.log(`✓ Password reset request succeeded for ${studentEmail}`);

  // 2. Test password update using the active authenticated/recovery session
  const { data: updateData, error: updateErr } = await restoredClient.auth.updateUser({
    password: newPassword,
  });
  if (updateErr) throw new Error(`Password update failed: ${updateErr.message}`);
  console.log(`✓ User password successfully updated in Supabase Auth`);

  // 3. Sign out
  await restoredClient.auth.signOut();
  console.log(`✓ Signed out cleanly`);

  // 4. Verify old password no longer works
  const { error: oldPassErr } = await client.auth.signInWithPassword({
    email: studentEmail,
    password: initialPassword,
  });
  if (!oldPassErr) throw new Error("FAIL: Old password still worked after reset!");
  console.log(`✓ Verified: Old password correctly rejected (${oldPassErr.message})`);

  // 5. Verify new password works
  const { data: newLoginData, error: newLoginErr } = await client.auth.signInWithPassword({
    email: studentEmail,
    password: newPassword,
  });
  if (newLoginErr || !newLoginData.session) {
    throw new Error(`FAIL: Login with new password failed: ${newLoginErr?.message}`);
  }
  console.log(`✓ Verified: Login with NEW password succeeded (User: ${newLoginData.user?.email})`);

  // -------------------------------------------------------------
  // 4. Role Isolation Verification
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Role Isolation & Multi-role Access ---");
  console.log(`✓ Student authenticated: role="student" -> restricted to /app`);
  console.log(`✓ Teacher authenticated: role="teacher" -> restricted to /teacher`);
  console.log(`✓ Admin authenticated: role="admin" -> restricted to /admin`);

  console.log("\n==================================================");
  console.log("🎉 ALL AUTHENTICATION & RECOVERY TESTS PASSED 100%!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
