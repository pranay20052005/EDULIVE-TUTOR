import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Create anon client for user
const client = createClient(supabaseUrl, anonKey);

async function main() {
  console.log("=== TESTING FULL STUDENT PURCHASE FLOW ===");

  const timestamp = Date.now();
  const testEmail = `student_test_${timestamp}@example.com`;
  const testPassword = `Pass1234_${timestamp}`;
  const testName = `Test Student ${timestamp}`;

  // 1. REGISTER
  console.log(`\n1. Registering user ${testEmail}...`);
  const { data: authData, error: authError } = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (authError || !authData.user) {
    throw new Error(`Sign up failed: ${authError?.message}`);
  }
  const userId = authData.user.id;
  console.log(`✓ Auth user created: ${userId}`);

  // Insert user record
  const { data: userRecord, error: userError } = await client
    .from("users")
    .insert({
      id: userId,
      email: testEmail,
      role: "student",
      name: testName,
      phone: "+91 9876543210",
    })
    .select()
    .single();

  if (userError) {
    throw new Error(`Users insert failed: ${userError.message}`);
  }
  console.log(`✓ Users table row created: ${userRecord.id}`);

  // Insert student record
  const { data: studentRecord, error: studentError } = await client
    .from("students")
    .insert({
      user_id: userId,
      board: "CBSE",
      standard: "10th",
      dob: "2008-08-15",
    })
    .select()
    .single();

  if (studentError) {
    throw new Error(`Students insert failed: ${studentError.message}`);
  }
  const studentId = studentRecord.id;
  console.log(`✓ Students table row created: ${studentId}`);

  // 2. SIGN OUT to simulate clean transition to Login
  console.log("\n2. Signing out after registration...");
  await client.auth.signOut();
  console.log("✓ Signed out");

  // 3. SIGN IN
  console.log(`\n3. Signing in with ${testEmail}...`);
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError || !loginData.user) {
    throw new Error(`Login failed: ${loginError?.message}`);
  }
  console.log(`✓ Login successful! User ID: ${loginData.user.id}`);

  // 4. GET PUBLISHED SUBJECT
  console.log("\n4. Fetching published subjects...");
  const { data: subjects, error: subError } = await client
    .from("subjects")
    .select("id, name, price_inr")
    .eq("status", "published")
    .limit(1);

  if (subError || !subjects || subjects.length === 0) {
    throw new Error(`Failed to fetch subjects: ${subError?.message}`);
  }
  const subject = subjects[0];
  console.log(
    `✓ Found published subject: "${subject.name}" (${subject.id}) - Price: Rs.${subject.price_inr}`,
  );

  // 5. CREATE PAYMENT
  console.log("\n5. Creating payment record...");
  const { data: paymentRecord, error: payError } = await client
    .from("payments")
    .insert({
      student_id: studentId,
      subject_id: subject.id,
      amount_inr: subject.price_inr,
      currency: "INR",
      payment_method: "upi",
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (payError) {
    throw new Error(`Payment creation failed: ${payError.message}`);
  }
  console.log(
    `✓ Payment recorded successfully: ID=${paymentRecord.id}, Status=${paymentRecord.status}`,
  );

  // 6. CREATE ENROLLMENT
  console.log("\n6. Creating enrollment record...");
  const { data: enrollmentRecord, error: enrollError } = await client
    .from("enrollments")
    .insert({
      student_id: studentId,
      subject_id: subject.id,
      status: "active",
      enrolled_at: new Date().toISOString(),
    })
    .select("*, subject:subjects(*, teacher:teachers(*, user:users(*)))")
    .single();

  if (enrollError) {
    throw new Error(`Enrollment creation failed: ${enrollError.message}`);
  }
  console.log(
    `✓ Enrollment recorded successfully: ID=${enrollmentRecord.id}, Subject=${enrollmentRecord.subject?.name}`,
  );

  // 7. QUERY ENROLLMENTS (Simulating My Subjects database fetch)
  console.log("\n7. Fetching student enrollments via RLS query...");
  const { data: myEnrollments, error: myErr } = await client
    .from("enrollments")
    .select("*, subject:subjects(*, teacher:teachers(*, user:users(*)))")
    .eq("student_id", studentId)
    .eq("status", "active");

  if (myErr) {
    throw new Error(`My Subjects query failed: ${myErr.message}`);
  }
  console.log(`✓ My Subjects query returned ${myEnrollments.length} enrolled subjects:`);
  console.table(
    myEnrollments.map((e) => ({
      enrollment_id: e.id,
      subject_id: e.subject_id,
      subject_name: e.subject?.name,
      teacher_name: e.subject?.teacher?.user?.name,
      status: e.status,
    })),
  );

  if (myEnrollments.length === 0) {
    throw new Error("❌ FAILURE: Enrollment not returned from database query!");
  }

  console.log(
    "\n🎉 TEST COMPLETED SUCCESSFULLY: Student registered, logged in, paid, enrolled, and verified in My Subjects database query!",
  );
}

main().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
