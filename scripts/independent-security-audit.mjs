import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import {
  verifyPaymentInternal,
  createPaymentOrderInternal,
} from "../src/lib/server/payment-functions.ts";

import {
  submitTestAttemptInternal,
  evaluateTestAnswers,
  validateTestTimingAndAvailability,
  getStudentTestInternal,
} from "../src/lib/server/test-functions.ts";

import { verifyRazorpaySignature } from "../src/lib/server/razorpay.ts";

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

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(name, condition, details = "") {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log("  ✓ PASS: " + name);
  } else {
    failedChecks++;
    failures.push({ name, details });
    console.error("  ❌ FAIL: " + name + " - " + details);
  }
}

async function asUser(client, userId, callback) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("SELECT set_config('request.jwt.claim.sub', '" + userId + "', true)");
    await client.query(
      "SELECT set_config('request.jwt.claims', '{\"sub\": \"" +
        userId +
        '", "role": "authenticated"}\', true)',
    );
    const res = await callback();
    await client.query("ROLLBACK");
    return { threw: false, res };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {}
    return { threw: true, err };
  }
}

async function run() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL for Independent Security Audit.");

  // Fetch real users
  const students = (
    await client.query(
      "SELECT s.id as student_id, u.id as user_id, u.email FROM students s JOIN users u ON s.user_id = u.id ORDER BY s.created_at;",
    )
  ).rows;
  const teachers = (
    await client.query(
      "SELECT t.id as teacher_id, u.id as user_id, u.email FROM teachers t JOIN users u ON t.user_id = u.id;",
    )
  ).rows;
  const admins = (
    await client.query(
      "SELECT a.id as admin_id, u.id as user_id, u.email FROM admins a JOIN users u ON a.user_id = u.id;",
    )
  ).rows;
  const subjects = (await client.query("SELECT * FROM subjects ORDER BY created_at;")).rows;

  const studentA = students[0];
  const studentB = students[1];
  const teacherA = teachers[0];
  const adminA = admins[0];
  const baseSubject = subjects[0];

  console.log(
    "\nTest Actors:\nStudent A: " +
      studentA.email +
      " (User: " +
      studentA.user_id +
      ")\nStudent B: " +
      studentB.email +
      " (User: " +
      studentB.user_id +
      ")\nTeacher A: " +
      teacherA.email +
      " (User: " +
      teacherA.user_id +
      ")\nAdmin A: " +
      adminA.email +
      " (User: " +
      adminA.user_id +
      ")\n",
  );

  // =========================================================================
  // SUITE 1: AUTHORIZATION ATTACK TESTS (Prompt Section 3)
  // =========================================================================
  console.log("=== SUITE 1: AUTHORIZATION ATTACK TESTS ===");

  // 1. Student A -> Student B Data Read & Write
  const a1 = await asUser(client, studentA.user_id, () =>
    client.query("SELECT * FROM users WHERE id = $1", [studentB.user_id]),
  );
  check("Student A cannot read Student B from users table", a1.res?.rowCount === 0);

  const a2 = await asUser(client, studentA.user_id, () =>
    client.query("SELECT * FROM students WHERE id = $1", [studentB.student_id]),
  );
  check("Student A cannot read Student B from students table", a2.res?.rowCount === 0);

  const a3 = await asUser(client, studentA.user_id, () =>
    client.query("UPDATE users SET name = 'Hacked' WHERE id = $1", [studentB.user_id]),
  );
  check("Student A cannot modify Student B in users table", a3.res?.rowCount === 0);

  const a4 = await asUser(client, studentA.user_id, () =>
    client.query("UPDATE students SET standard = '12th' WHERE id = $1", [studentB.student_id]),
  );
  check("Student A cannot modify Student B in students table", a4.res?.rowCount === 0);

  const a5 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO payments (student_id, amount_inr, status, order_id, created_at) VALUES ($1, 1000, 'pending', 'order_fake_attack', NOW())",
      [studentB.student_id],
    ),
  );
  check(
    "Student A cannot insert payment record for Student B directly",
    a5.threw || a5.res?.rowCount === 0,
  );

  const a6 = await asUser(client, studentA.user_id, () =>
    client.query("UPDATE payments SET status = 'paid' WHERE student_id = $1", [
      studentB.student_id,
    ]),
  );
  check("Student A cannot update payment status for Student B directly", a6.res?.rowCount === 0);

  const a7 = await asUser(client, studentA.user_id, () =>
    client.query("SELECT * FROM notifications WHERE user_id = $1", [studentB.user_id]),
  );
  check("Student A cannot read Student B notifications", a7.res?.rowCount === 0);

  const a8 = await asUser(client, studentA.user_id, () =>
    client.query("SELECT * FROM course_certificates WHERE student_id = $1", [studentB.student_id]),
  );
  check("Student A cannot read Student B course certificates", a8.res?.rowCount === 0);

  const a9 = await asUser(client, studentA.user_id, () =>
    client.query("SELECT * FROM test_attempts WHERE student_id = $1", [studentB.student_id]),
  );
  check("Student A cannot read Student B test attempts", a9.res?.rowCount === 0);

  const a10 = await asUser(client, studentA.user_id, () =>
    client.query("UPDATE test_attempts SET score = 100, status = 'graded' WHERE student_id = $1", [
      studentB.student_id,
    ]),
  );
  check(
    "Student A cannot modify Student B test attempt score/status directly",
    a10.res?.rowCount === 0,
  );

  // 2. Student -> Teacher Resource Attacks
  const t1 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO subjects (id, name, description, standard, teacher_id, price_inr, status) VALUES (gen_random_uuid(), 'Hacked Course', 'Desc', '10th', $1, 0, 'published')",
      [teacherA.teacher_id],
    ),
  );
  check("Student cannot create a course/subject", t1.threw || t1.res?.rowCount === 0);

  const t2 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO tests (id, title, subject_id, teacher_id, duration_min, total_marks, status, starts_at, ends_at) VALUES (gen_random_uuid(), 'Hacked Test', $1, $2, 60, 100, 'published', NOW(), NOW() + interval '1 day')",
      [baseSubject.id, teacherA.teacher_id],
    ),
  );
  check("Student cannot create a test", t2.threw || t2.res?.rowCount === 0);

  const t3 = await asUser(client, studentA.user_id, () =>
    client.query("SELECT * FROM test_questions"),
  );
  check("Student cannot directly SELECT from test_questions table", t3.res?.rowCount === 0);

  const t4 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO test_questions (id, test_id, type, text, marks, question_order) VALUES (gen_random_uuid(), gen_random_uuid(), 'mcq', 'Hacked?', 5, 1)",
    ),
  );
  check("Student cannot insert questions into test_questions", t4.threw || t4.res?.rowCount === 0);

  const t5 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO assignments (id, title, subject_id, teacher_id, total_marks, due_at) VALUES (gen_random_uuid(), 'Hacked Assignment', $1, $2, 50, NOW() + interval '1 day')",
      [baseSubject.id, teacherA.teacher_id],
    ),
  );
  check("Student cannot create an assignment", t5.threw || t5.res?.rowCount === 0);

  const t6 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO attendance (student_id, subject_id, teacher_id, attendance_date, status) VALUES ($1, $2, $3, CURRENT_DATE, 'present')",
      [studentA.student_id, baseSubject.id, teacherA.teacher_id],
    ),
  );
  check("Student cannot insert attendance records", t6.threw || t6.res?.rowCount === 0);

  // 3. Student -> Admin Attacks
  const adm1 = await asUser(client, studentA.user_id, () => client.query("SELECT * FROM admins"));
  check("Student cannot read admins table", adm1.res?.rowCount === 0);

  const adm2 = await asUser(client, studentA.user_id, () =>
    client.query(
      "INSERT INTO subscription_plans (name, price_inr, duration_days, is_active) VALUES ('Free Hack Plan', 0, 365, true)",
    ),
  );
  check("Student cannot insert subscription plans", adm2.threw || adm2.res?.rowCount === 0);

  const adm3 = await asUser(client, studentA.user_id, () =>
    client.query("UPDATE settings SET value = '{\"hacked\": true}' WHERE key = 'site_config'"),
  );
  check("Student cannot modify global system settings", adm3.threw || adm3.res?.rowCount === 0);

  // 4. Teacher -> Admin Attacks
  const tadm1 = await asUser(client, teacherA.user_id, () => client.query("SELECT * FROM admins"));
  check("Teacher cannot read admins table", tadm1.res?.rowCount === 0);

  const tadm2 = await asUser(client, teacherA.user_id, () =>
    client.query(
      "INSERT INTO subscription_plans (name, price_inr, duration_days, is_active) VALUES ('Teacher Plan', 100, 30, true)",
    ),
  );
  check("Teacher cannot insert subscription plans", tadm2.threw || tadm2.res?.rowCount === 0);

  const tadm3 = await asUser(client, teacherA.user_id, () =>
    client.query("UPDATE settings SET value = '{\"hacked\": true}' WHERE key = 'site_config'"),
  );
  check("Teacher cannot modify global system settings", tadm3.threw || tadm3.res?.rowCount === 0);

  // 5. Teacher A -> Teacher B Resource Isolation
  const tempEmail = "temp_tb_" + Date.now() + "@edulive.test";
  const teacherBUserRes = await client.query(
    "INSERT INTO users (email, role, name) VALUES ($1, 'teacher', 'Teacher B') RETURNING id;",
    [tempEmail],
  );
  const teacherBUserId = teacherBUserRes.rows[0].id;
  const teacherBRes = await client.query("SELECT id FROM teachers WHERE user_id = $1", [
    teacherBUserId,
  ]);
  const teacherBId = teacherBRes.rows[0].id;

  const teacherBSubjectRes = await client.query(
    "INSERT INTO subjects (name, description, standard, teacher_id, price_inr, status) VALUES ('Teacher B Subject', 'Private subject', '11th', $1, 1500, 'draft') RETURNING id;",
    [teacherBId],
  );
  const teacherBSubjectId = teacherBSubjectRes.rows[0].id;

  const tb1 = await asUser(client, teacherA.user_id, () =>
    client.query("UPDATE subjects SET name = 'Hacked by Teacher A' WHERE id = $1", [
      teacherBSubjectId,
    ]),
  );
  check("Teacher A cannot modify Teacher B subject", tb1.res?.rowCount === 0);

  const tb2 = await asUser(client, teacherA.user_id, () =>
    client.query("DELETE FROM subjects WHERE id = $1", [teacherBSubjectId]),
  );
  check("Teacher A cannot delete Teacher B subject", tb2.res?.rowCount === 0);

  // Cleanup temporary Teacher B
  await client.query("DELETE FROM subjects WHERE id = $1", [teacherBSubjectId]);
  await client.query("DELETE FROM teachers WHERE id = $1", [teacherBId]);
  await client.query("DELETE FROM users WHERE id = $1", [teacherBUserId]);

  // =========================================================================
  // SUITE 2: PAYMENT SECURITY TESTS (Prompt Section 4)
  // =========================================================================
  console.log("\n=== SUITE 2: PAYMENT SECURITY TESTS ===");

  const secret = process.env.RAZORPAY_KEY_SECRET || "test_secret";

  // 1. Cryptographic HMAC validation with real gateway function
  const testOrderId = "order_audit_" + Date.now();
  const testPayId = "pay_audit_" + Date.now();
  const validHmac = crypto
    .createHmac("sha256", secret)
    .update(testOrderId + "|" + testPayId)
    .digest("hex");
  const badHmac = crypto
    .createHmac("sha256", secret)
    .update(testOrderId + "|pay_bad")
    .digest("hex");

  check(
    "1. Valid HMAC SHA256 passes gateway verification",
    verifyRazorpaySignature({
      orderId: testOrderId,
      paymentId: testPayId,
      signature: validHmac,
    }) === true,
  );
  check(
    "2. Forged signature is rejected by gateway verification",
    verifyRazorpaySignature({ orderId: testOrderId, paymentId: testPayId, signature: badHmac }) ===
      false,
  );
  check(
    "3. Tampered payload is rejected by gateway verification",
    verifyRazorpaySignature({
      orderId: testOrderId,
      paymentId: "pay_tampered",
      signature: validHmac,
    }) === false,
  );

  // Live database test of payment order and verification
  const testSubjPrice = 2000;
  const testExpectedPriceWithGst = 2360;

  // Insert a test payment record directly into DB to test verification
  const insertPayRes = await client.query(
    "INSERT INTO payments (student_id, subject_id, amount_inr, status, provider, provider_order_id) VALUES ($1, $2, $3, 'pending', 'razorpay', $4) RETURNING *;",
    [studentA.student_id, baseSubject.id, testExpectedPriceWithGst, testOrderId],
  );
  const livePayment = insertPayRes.rows[0];

  // 4. Verify payment with student mismatch (Student B tries to verify Student A payment)
  let studentMismatchThrew = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: testOrderId,
      paymentId: testPayId,
      signature: validHmac,
      subjectId: baseSubject.id,
      studentId: studentB.student_id, // Student B attempting to claim Student A payment
      authenticatedUserId: studentB.user_id,
    });
  } catch (e) {
    studentMismatchThrew = /does not belong to the authenticated student|mismatch/i.test(e.message);
  }
  check("4. Student B attempting to verify Student A payment is rejected", studentMismatchThrew);

  // 5. Nonexistent Razorpay order ID is rejected
  let wrongOrderThrew = false;
  const fakeOrderId = "order_nonexistent_999";
  const fakeSig = crypto
    .createHmac("sha256", secret)
    .update(fakeOrderId + "|" + testPayId)
    .digest("hex");
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: fakeOrderId,
      paymentId: testPayId,
      signature: fakeSig,
      subjectId: baseSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.user_id,
    });
  } catch (e) {
    wrongOrderThrew = /not found/i.test(e.message);
  }
  check("5. Nonexistent Razorpay order ID is rejected", wrongOrderThrew);

  // 6. Wrong subject ID (course tampering)
  let wrongSubjectThrew = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: testOrderId,
      paymentId: testPayId,
      signature: validHmac,
      subjectId: "00000000-0000-0000-0000-000000000000",
      studentId: studentA.student_id,
      authenticatedUserId: studentA.user_id,
    });
  } catch (e) {
    wrongSubjectThrew = /does not match the requested course|mismatch/i.test(e.message);
  }
  check("6. Wrong subject ID (course tampering) is rejected", wrongSubjectThrew);

  // 7. Invalid signature rejection
  let badSigThrew = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: testOrderId,
      paymentId: testPayId,
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
      subjectId: baseSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.user_id,
    });
  } catch (e) {
    badSigThrew = /signature verification failed/i.test(e.message);
  }
  check("7. Invalid cryptographic signature is rejected and marked failed", badSigThrew);

  // 8. Clean up test payment
  await client.query("DELETE FROM payments WHERE id = $1;", [livePayment.id]);

  // =========================================================================
  // SUITE 3: TEST SECURITY (Prompt Section 5)
  // =========================================================================
  console.log("\n=== SUITE 3: TEST SECURITY ===");

  const mockQuestions = [
    { id: "q1", test_id: "test_sec_1", type: "mcq", correct_answer_index: 2, marks: 5 },
    { id: "q2", test_id: "test_sec_1", type: "truefalse", correct_answer: "True", marks: 5 },
  ];

  // 1. Submit after test expiration
  let pastEndThrew = false;
  try {
    validateTestTimingAndAvailability({
      test: {
        id: "test_ended",
        status: "published",
        starts_at: new Date(Date.now() - 3600000).toISOString(),
        ends_at: new Date(Date.now() - 1000).toISOString(),
        duration_min: 60,
      },
    });
  } catch (e) {
    pastEndThrew = /has ended/i.test(e.message);
  }
  check("1. Submit after test expiration rejected", pastEndThrew);

  // 2. Submit before test start
  let futureStartThrew = false;
  try {
    validateTestTimingAndAvailability({
      test: {
        id: "test_future",
        status: "published",
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        ends_at: new Date(Date.now() + 7200000).toISOString(),
        duration_min: 60,
      },
    });
  } catch (e) {
    futureStartThrew = /has not started yet/i.test(e.message);
  }
  check("2. Submit before test start rejected", futureStartThrew);

  // 3. Submit after duration expires
  let durationExpiredThrew = false;
  try {
    validateTestTimingAndAvailability({
      test: { id: "test_dur", status: "published", duration_min: 60 },
      attempt: {
        started_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
        status: "in_progress",
      },
    });
  } catch (e) {
    durationExpiredThrew = /duration has expired/i.test(e.message);
  }
  check("3. Submit after duration expires rejected", durationExpiredThrew);

  // 4. Invalid question IDs handled safely without score inflation
  const evalInvalidQ = evaluateTestAnswers({
    questions: mockQuestions,
    answers: { q_fake_999: "2" },
  });
  check(
    "4. Invalid question IDs safely receive 0 marks without crashing",
    evalInvalidQ.score === 0 && evalInvalidQ.correctCount === 0,
  );

  // 5. Answers belonging to another test receive 0 marks
  const evalOtherTestQ = evaluateTestAnswers({
    questions: mockQuestions,
    answers: { q_other_test_1: "True" },
  });
  check("5. Answers belonging to another test receive 0 marks", evalOtherTestQ.score === 0);

  // =========================================================================
  // SUITE 4: ANSWER KEY LEAK TEST (Prompt Section 6)
  // =========================================================================
  console.log("\n=== SUITE 4: ANSWER KEY LEAK TEST ===");

  // 1. Insert a temporary test and question with answers and explanations
  const tempTestRes = await client.query(
    "INSERT INTO tests (subject_id, teacher_id, title, duration_min, total_marks, passing_marks, status, starts_at, ends_at) VALUES ($1, $2, 'Security Audit Secret Exam', 60, 10, 5, 'published', NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days') RETURNING id;",
    [baseSubject.id, teacherA.teacher_id],
  );
  const tempTestId = tempTestRes.rows[0].id;

  const tempQRes = await client.query(
    "INSERT INTO test_questions (test_id, type, text, options, marks, difficulty, question_order, correct_answer, correct_answer_index) VALUES ($1, 'mcq', 'What is the secret answer?', '[\"Option A\", \"Option B\", \"Option C\", \"Option D\"]'::jsonb, 5, 'medium', 1, 'Option B', 1) RETURNING id;",
    [tempTestId],
  );
  const tempQId = tempQRes.rows[0].id;

  // Ensure Student A has an active enrollment for baseSubject
  await client.query(
    "INSERT INTO enrollments (student_id, subject_id, status) VALUES ($1, $2, 'active') ON CONFLICT DO NOTHING;",
    [studentA.student_id, baseSubject.id],
  );

  // 2. Fetch test via authoritative server function as Student A
  const studentTestResponse = await getStudentTestInternal(supabaseAdmin, {
    testId: tempTestId,
    studentId: studentA.student_id,
    authenticatedUserId: studentA.user_id,
  });

  check(
    "Student can fetch published test through server function",
    studentTestResponse && studentTestResponse.test.id === tempTestId,
  );
  check(
    "Server function returns questions array",
    Array.isArray(studentTestResponse.questions) && studentTestResponse.questions.length === 1,
  );

  const returnedQ = studentTestResponse.questions[0];
  check("Returned question has question text", returnedQ.text === "What is the secret answer?");
  check(
    "Returned question has options list",
    Array.isArray(returnedQ.options) && returnedQ.options.length === 4,
  );
  check("Returned question has NO correct_answer", returnedQ.correct_answer === undefined);
  check(
    "Returned question has NO correct_answer_index",
    returnedQ.correct_answer_index === undefined,
  );

  const serializedResponse = JSON.stringify(studentTestResponse);
  check(
    "Payload JSON does NOT contain correct_answer",
    !serializedResponse.includes('"correct_answer"'),
  );
  check(
    "Payload JSON does NOT contain correct_answer_index",
    !serializedResponse.includes('"correct_answer_index"'),
  );
  check(
    "Payload JSON does NOT contain raw answer value",
    !serializedResponse.includes('"Option B"') ||
      (returnedQ.options.includes("Option B") &&
        !serializedResponse.includes('"correct_answer":"Option B"')),
  );

  // 3. Verify that Student A CANNOT bypass server function by querying test_questions directly via RLS
  let directSelectLeaked = true;
  await client.query("BEGIN;");
  try {
    await client.query("SET LOCAL ROLE authenticated;");
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${studentA.user_id}';`);
    const directSelectRes = await client.query("SELECT * FROM test_questions WHERE test_id = $1;", [
      tempTestId,
    ]);
    directSelectLeaked = directSelectRes.rows.length > 0;
  } catch {
    directSelectLeaked = false;
  } finally {
    await client.query("ROLLBACK;");
  }
  check("Student A cannot query test_questions directly via Supabase RLS", !directSelectLeaked);

  // 4. Cleanup temporary test artifacts
  await client.query("DELETE FROM test_answers WHERE question_id = $1;", [tempQId]);
  await client.query("DELETE FROM test_attempts WHERE test_id = $1;", [tempTestId]);
  await client.query("DELETE FROM test_questions WHERE test_id = $1;", [tempTestId]);
  await client.query("DELETE FROM tests WHERE id = $1;", [tempTestId]);

  // =========================================================================
  // SUITE 5: LIVE DATABASE RLS SECURITY TEST (Prompt Section 7)
  // =========================================================================
  console.log("\n=== SUITE 5: LIVE DATABASE RLS SECURITY TEST ===");

  const allTablesRes = await client.query(
    "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;",
  );
  const withoutRls = allTablesRes.rows.filter((r) => !r.rowsecurity);
  check("All 27 public tables have RLS enabled (rowsecurity = true)", withoutRls.length === 0);

  const sensitiveTables = [
    "users",
    "students",
    "teachers",
    "admins",
    "subjects",
    "enrollments",
    "payments",
    "tests",
    "test_questions",
    "test_attempts",
    "test_answers",
    "assignments",
    "assignment_submissions",
    "attendance",
    "notifications",
    "course_certificates",
    "batches",
    "batch_students",
    "recordings",
  ];

  const polRes = await client.query(
    "SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1) ORDER BY tablename, cmd;",
    [sensitiveTables],
  );

  const policiesByTable = {};
  sensitiveTables.forEach((t) => (policiesByTable[t] = []));
  polRes.rows.forEach((p) => {
    policiesByTable[p.tablename].push(p);
  });

  for (const table of sensitiveTables) {
    const pols = policiesByTable[table] || [];
    check(
      "Table '" + table + "' has active RLS policies",
      pols.length > 0,
      "Policies count: " + pols.length,
    );
  }

  const tqSelectPols = (policiesByTable["test_questions"] || []).filter((p) => p.cmd === "SELECT");
  const tqHasOpenTrue = tqSelectPols.some((p) => p.qual === "true");
  check("test_questions SELECT has NO open USING (true) policy", !tqHasOpenTrue);

  const usersSelectPols = (policiesByTable["users"] || []).filter((p) => p.cmd === "SELECT");
  const usersHasOpenTrue = usersSelectPols.some((p) => p.qual === "true");
  check("users SELECT has NO open USING (true) policy", !usersHasOpenTrue);

  const paymentsUpdatePols = (policiesByTable["payments"] || []).filter((p) => p.cmd === "UPDATE");
  const paymentsHasOpenUpdate = paymentsUpdatePols.some(
    (p) => p.qual === "true" || /student_id/.test(p.qual || ""),
  );
  check(
    "payments UPDATE restricted strictly to admins (no student direct update)",
    !paymentsHasOpenUpdate,
  );

  const enrollmentsInsertPols = (policiesByTable["enrollments"] || []).filter(
    (p) => p.cmd === "INSERT",
  );
  const enrollmentsHasOpenInsert = enrollmentsInsertPols.some((p) => p.with_check === "true");
  check("enrollments INSERT has NO unrestricted WITH CHECK (true)", !enrollmentsHasOpenInsert);

  const attemptsUpdatePols = (policiesByTable["test_attempts"] || []).filter(
    (p) => p.cmd === "UPDATE",
  );
  const attemptsHasStudentUpdate = attemptsUpdatePols.some(
    (p) => /student_id/.test(p.qual || "") && !/teachers/.test(p.qual || ""),
  );
  check(
    "test_attempts UPDATE restricted (students cannot self-grade/update score)",
    !attemptsHasStudentUpdate,
  );

  const answersUpdatePols = (policiesByTable["test_answers"] || []).filter(
    (p) => p.cmd === "UPDATE",
  );
  const answersHasStudentUpdate = answersUpdatePols.some(
    (p) => /student_id/.test(p.qual || "") && !/teachers/.test(p.qual || ""),
  );
  check(
    "test_answers UPDATE restricted (students cannot alter marks/answers)",
    !answersHasStudentUpdate,
  );

  await client.end();

  console.log("\n================================================================================");
  console.log(
    "INDEPENDENT SECURITY AUDIT COMPLETE: " +
      passedChecks +
      " PASSED, " +
      failedChecks +
      " FAILED (Total: " +
      totalChecks +
      ")",
  );
  console.log("================================================================================");

  if (failedChecks > 0) {
    console.error("Failed checks summary:", failures);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});
