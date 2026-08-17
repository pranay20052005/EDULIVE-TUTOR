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

async function runE2ETests() {
  console.log("==================================================");
  console.log("EDULIVE — FULL LIVE DATABASE E2E VERIFICATION TEST");
  console.log("==================================================\n");

  const timestamp = Date.now();
  const testPassword = `E2E_Pass_${timestamp}!`;

  // ==========================================
  // TEST 1: STUDENT REGISTRATION & AUTH CYCLE
  // ==========================================
  console.log("--- TEST 1: Student Registration & Auth Cycle ---");
  const studentEmail = `student_e2e_${timestamp}@example.com`;
  const studentClient = createClient(supabaseUrl, anonKey);

  const { data: sSignUp, error: sSignErr } = await studentClient.auth.signUp({
    email: studentEmail,
    password: testPassword,
  });
  if (sSignErr || !sSignUp.user) throw new Error(`Sign up failed: ${sSignErr?.message}`);
  const sUserId = sSignUp.user.id;

  const { error: sUserErr } = await studentClient.from("users").insert({
    id: sUserId,
    email: studentEmail,
    role: "student",
    name: `E2E Student ${timestamp}`,
    phone: "+91 9988776655",
  });
  if (sUserErr) throw new Error(`Users insert failed: ${sUserErr.message}`);

  const { data: sProfile, error: sProfErr } = await studentClient
    .from("students")
    .insert({
      user_id: sUserId,
      board: "CBSE",
      standard: "10th",
      dob: "2008-01-01",
    })
    .select()
    .single();
  if (sProfErr) throw new Error(`Students insert failed: ${sProfErr.message}`);
  const sStudentId = sProfile.id;
  console.log(`✓ Student registered: ${studentEmail} (Student ID: ${sStudentId})`);

  // Sign out then sign in
  await studentClient.auth.signOut();
  const { data: sLogin, error: sLogErr } = await studentClient.auth.signInWithPassword({
    email: studentEmail,
    password: testPassword,
  });
  if (sLogErr || !sLogin.user) throw new Error(`Student login failed: ${sLogErr?.message}`);
  console.log("✓ Student login & session verified");

  // ==========================================
  // TEST 2: COURSE CATALOG & CHECKOUT FLOW
  // ==========================================
  console.log("\n--- TEST 2: Course Catalog, Checkout & Enrollment Persistence ---");
  const { data: publishedCourses, error: cErr } = await studentClient
    .from("subjects")
    .select("*, teacher:teachers(*, user:users(*))")
    .eq("status", "published");
  if (cErr || !publishedCourses.length) throw new Error("No published courses found");
  const targetSubject = publishedCourses[0];
  console.log(
    `✓ Found course: "${targetSubject.name}" by ${targetSubject.teacher?.user?.name} (Price: Rs.${targetSubject.price_inr})`,
  );

  // Insert payment
  const { data: payment, error: pErr } = await studentClient
    .from("payments")
    .insert({
      student_id: sStudentId,
      subject_id: targetSubject.id,
      amount_inr: targetSubject.price_inr,
      payment_method: "upi",
      status: "paid",
    })
    .select()
    .single();
  if (pErr) throw new Error(`Payment failed: ${pErr.message}`);
  console.log(`✓ Payment recorded in DB (ID: ${payment.id}, Status: ${payment.status})`);

  // Insert enrollment
  const { data: enrollment, error: eErr } = await studentClient
    .from("enrollments")
    .insert({
      student_id: sStudentId,
      subject_id: targetSubject.id,
      status: "active",
    })
    .select()
    .single();
  if (eErr) throw new Error(`Enrollment failed: ${eErr.message}`);
  console.log(`✓ Enrollment recorded in DB (ID: ${enrollment.id})`);

  // Fetch student enrollments from database
  const { data: mySubjects, error: myErr } = await studentClient
    .from("enrollments")
    .select("*, subject:subjects(*, teacher:teachers(*, user:users(*)))")
    .eq("student_id", sStudentId)
    .eq("status", "active");
  if (myErr || !mySubjects.length)
    throw new Error("Purchased subject disappeared from database query!");
  console.log(
    `✓ Database persistence verified: ${mySubjects.length} active subject found (${mySubjects[0].subject?.name})`,
  );

  // ==========================================
  // TEST 3: MATERIALS, RECORDINGS, QUESTION PAPERS
  // ==========================================
  console.log("\n--- TEST 3: Materials, Recordings & Question Papers ---");
  const { data: materials, error: matErr } = await studentClient
    .from("materials")
    .select("*")
    .eq("status", "published");
  if (matErr) throw new Error(`Materials fetch failed: ${matErr.message}`);
  console.log(`✓ Materials query returned ${materials?.length ?? 0} items`);

  const { data: recordings, error: recErr } = await studentClient
    .from("recordings")
    .select("*")
    .eq("status", "published");
  if (recErr) throw new Error(`Recordings fetch failed: ${recErr.message}`);
  console.log(`✓ Recordings query returned ${recordings?.length ?? 0} items`);

  const { data: qPapers, error: qpErr } = await studentClient
    .from("question_papers")
    .select("*")
    .eq("status", "published");
  if (qpErr) throw new Error(`Question papers fetch failed: ${qpErr.message}`);
  console.log(`✓ Question papers query returned ${qPapers?.length ?? 0} items`);

  // ==========================================
  // TEST 4: ASSIGNMENT WORKFLOW & SUBMISSIONS
  // ==========================================
  console.log("\n--- TEST 4: Assignment Workflow & Submissions ---");
  const { data: assignments, error: asgErr } = await studentClient
    .from("assignments")
    .select("*")
    .eq("status", "published");
  if (asgErr) throw new Error(`Assignments fetch failed: ${asgErr.message}`);
  console.log(`✓ Published assignments available: ${assignments?.length ?? 0}`);

  if (assignments && assignments.length > 0) {
    const targetAssignment = assignments[0];
    const { data: submission, error: subErr } = await studentClient
      .from("assignment_submissions")
      .insert({
        assignment_id: targetAssignment.id,
        student_id: sStudentId,
        submission_text: "E2E automated test submission text with solution steps.",
      })
      .select()
      .single();
    if (subErr) throw new Error(`Assignment submission failed: ${subErr.message}`);
    console.log(`✓ Assignment submission recorded in DB (ID: ${submission.id})`);
  }

  // ==========================================
  // TEST 5: TESTS & TEST ATTEMPTS
  // ==========================================
  console.log("\n--- TEST 5: Tests & Attempt Flow ---");
  const { data: tests, error: testErr } = await studentClient
    .from("tests")
    .select("*")
    .eq("subject_id", targetSubject.id)
    .eq("status", "published");
  if (testErr) throw new Error(`Tests fetch failed: ${testErr.message}`);
  console.log(`✓ Published tests for enrolled subject: ${tests?.length ?? 0}`);

  if (tests && tests.length > 0) {
    const targetTest = tests[0];
    const { data: attempt, error: attErr } = await studentClient
      .from("test_attempts")
      .insert({
        test_id: targetTest.id,
        student_id: sStudentId,
        status: "submitted",
        score: 85,
        total_marks: 100,
        percentage: 85,
      })
      .select()
      .single();
    if (attErr) throw new Error(`Test attempt failed: ${attErr.message}`);
    console.log(`✓ Test attempt recorded in DB (ID: ${attempt.id}, Score: ${attempt.score}%)`);
  }

  // ==========================================
  // TEST 6: TEACHER PORTAL & ACTIONS
  // ==========================================
  console.log("\n--- TEST 6: Teacher Portal & Actions ---");
  const teacherEmail = `teacher_e2e_${timestamp}@example.com`;
  const { data: tAuth } = await adminClient.auth.admin.createUser({
    email: teacherEmail,
    password: testPassword,
    email_confirm: true,
  });
  await adminClient.from("users").insert({
    id: tAuth.user.id,
    email: teacherEmail,
    role: "teacher",
    name: `Dr. Teacher ${timestamp}`,
    phone: "+91 9988112233",
  });
  const { data: tProfile } = await adminClient
    .from("teachers")
    .insert({
      user_id: tAuth.user.id,
      qualification: "Ph.D Science",
      experience_years: 10,
      bio: "Experienced instructor.",
    })
    .select()
    .single();
  const tTeacherId = tProfile.id;

  const teacherClient = createClient(supabaseUrl, anonKey);
  const { data: tLogin, error: tLogErr } = await teacherClient.auth.signInWithPassword({
    email: teacherEmail,
    password: testPassword,
  });
  if (tLogErr || !tLogin.user) throw new Error(`Teacher login failed: ${tLogErr?.message}`);
  console.log(`✓ Teacher logged in: ${teacherEmail} (Teacher ID: ${tTeacherId})`);

  // Teacher creates a new subject
  const { data: newSub, error: nSubErr } = await teacherClient
    .from("subjects")
    .insert({
      teacher_id: tTeacherId,
      name: `Advanced Physics ${timestamp}`,
      code: `PHY-${timestamp.toString().slice(-4)}`,
      standard: "12th",
      description: "Comprehensive Advanced Physics curriculum",
      price_inr: 3499,
      status: "published",
    })
    .select()
    .single();
  if (nSubErr) throw new Error(`Teacher subject creation failed: ${nSubErr.message}`);
  console.log(`✓ Teacher created subject in DB: "${newSub.name}" (ID: ${newSub.id})`);

  // Teacher creates a scheduled class
  const startTime = new Date(Date.now() + 86400000).toISOString();
  const endTime = new Date(Date.now() + 90000000).toISOString();
  const { data: newClass, error: nClassErr } = await teacherClient
    .from("scheduled_classes")
    .insert({
      subject_id: newSub.id,
      teacher_id: tTeacherId,
      title: `Electromagnetism Lecture 1`,
      starts_at: startTime,
      ends_at: endTime,
      status: "scheduled",
      meeting_url: "https://meet.edulive.io/phy-12",
    })
    .select()
    .single();
  if (nClassErr) throw new Error(`Teacher class schedule failed: ${nClassErr.message}`);
  console.log(`✓ Teacher scheduled live class in DB: "${newClass.title}" (ID: ${newClass.id})`);

  // Teacher creates an assignment
  const { data: newAsg, error: nAsgErr } = await teacherClient
    .from("assignments")
    .insert({
      subject_id: newSub.id,
      teacher_id: tTeacherId,
      title: `Electromagnetism Problem Set`,
      due_at: new Date(Date.now() + 172800000).toISOString(),
      max_marks: 50,
      status: "published",
    })
    .select()
    .single();
  if (nAsgErr) throw new Error(`Teacher assignment creation failed: ${nAsgErr.message}`);
  console.log(`✓ Teacher created assignment in DB: "${newAsg.title}" (ID: ${newAsg.id})`);

  // ==========================================
  // TEST 7: ADMIN PORTAL & METRICS
  // ==========================================
  console.log("\n--- TEST 7: Admin Portal & System Metrics ---");
  const adminEmail = `admin_e2e_${timestamp}@example.com`;
  const { data: aAuth } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: testPassword,
    email_confirm: true,
  });
  await adminClient.from("users").insert({
    id: aAuth.user.id,
    email: adminEmail,
    role: "admin",
    name: `Master Admin ${timestamp}`,
  });
  await adminClient.from("admins").insert({
    user_id: aAuth.user.id,
  });

  const adminUserClient = createClient(supabaseUrl, anonKey);
  const { data: aLogin, error: aLogErr } = await adminUserClient.auth.signInWithPassword({
    email: adminEmail,
    password: testPassword,
  });
  if (aLogErr || !aLogin.user) throw new Error(`Admin login failed: ${aLogErr?.message}`);
  console.log(`✓ Admin logged in: ${adminEmail}`);

  // Admin query all payments and revenue
  const { data: allPay, error: apErr } = await adminUserClient.from("payments").select("*");
  if (apErr) throw new Error(`Admin payments query failed: ${apErr.message}`);
  const totalRev = (allPay || []).reduce(
    (acc, p) => acc + (p.status === "paid" || p.status === "completed" ? p.amount_inr : 0),
    0,
  );
  console.log(
    `✓ Admin verified live payments table: ${allPay.length} payments, Total verified revenue: Rs.${totalRev}`,
  );

  // Admin query all enrollments
  const { data: allEnr, error: aeErr } = await adminUserClient.from("enrollments").select("*");
  if (aeErr) throw new Error(`Admin enrollments query failed: ${aeErr.message}`);
  console.log(`✓ Admin verified live enrollments table: ${allEnr.length} enrollments`);

  console.log("\n==================================================");
  console.log("🎉 ALL E2E INTEGRATION & DATABASE TESTS PASSED 100%!");
  console.log("==================================================");
}

runE2ETests().catch((err) => {
  console.error("\n❌ E2E TEST FAILED:", err);
  process.exit(1);
});
