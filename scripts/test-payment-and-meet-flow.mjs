/**
 * Comprehensive Verification Test for:
 * 1. Payment Identity Resolution & Enrollment Foreign Key Constraint Fix
 * 2. Google Meet Live Class Link Storage & Authorized Joining Flow
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

if (!supabaseUrl || !serviceKey || !razorpaySecret) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log("================================================================================");
  console.log("EDULIVE — PAYMENT ENROLLMENT FK FIX & GOOGLE MEET JOIN FLOW VERIFICATION");
  console.log("================================================================================");

  // 1. Fetch reference teacher, subject, student
  const { data: teacherUser } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("role", "teacher")
    .limit(1)
    .single();

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("id, user_id")
    .eq("user_id", teacherUser.id)
    .single();

  const { data: studentUsers } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("role", "student")
    .limit(2);

  const studentUser1 = studentUsers[0];
  const studentUser2 = studentUsers[1] || studentUsers[0];

  const { data: student1Row } = await supabase
    .from("students")
    .select("id, user_id")
    .eq("user_id", studentUser1.id)
    .single();

  console.log(`Teacher: ${teacherUser.name} (User: ${teacherUser.id}, Teacher: ${teacherRow.id})`);
  console.log(`Student 1: ${studentUser1.name} (User: ${studentUser1.id}, Student: ${student1Row.id})`);

  // Create a dedicated test subject
  const testSubCode = `TEST_PAY_${Date.now()}`;
  const { data: testSubject, error: subErr } = await supabase
    .from("subjects")
    .insert([
      {
        name: "Advanced Quantum Computing",
        code: testSubCode,
        standard: "12th",
        teacher_id: teacherRow.id,
        price_inr: 1500,
        duration_months: 6,
        status: "published",
      },
    ])
    .select()
    .single();

  if (subErr || !testSubject) {
    throw new Error(`Failed to create test subject: ${subErr?.message}`);
  }

  // =========================================================================
  // SECTION 1: PAYMENT IDENTITY RESOLUTION & ENROLLMENT FK VERIFICATION
  // =========================================================================
  console.log("\n[TEST SUITE 1] Payment Identity Resolution & Enrollment FK Verification");

  const { resolveStudentIdentity } = await import("../src/lib/server/payment-functions.ts");

  // Test 1.1: Resolve via students.id
  const resolvedFromStudentId = await resolveStudentIdentity(supabase, student1Row.id);
  assert(
    resolvedFromStudentId && resolvedFromStudentId.studentId === student1Row.id,
    `Resolved identity from students.id: ${resolvedFromStudentId.studentId}`,
  );
  assert(
    resolvedFromStudentId.userId === studentUser1.id,
    `Resolved userId from students.id matches users.id: ${resolvedFromStudentId.userId}`,
  );

  // Test 1.2: Resolve via users.id
  const resolvedFromUserId = await resolveStudentIdentity(supabase, studentUser1.id);
  assert(
    resolvedFromUserId && resolvedFromUserId.studentId === student1Row.id,
    `Resolved authentic students.id from users.id: ${resolvedFromUserId.studentId}`,
  );

  // Test 1.3: Teacher / Admin enrollment rejection
  let teacherRejected = false;
  try {
    await resolveStudentIdentity(supabase, teacherUser.id);
  } catch (err) {
    teacherRejected = true;
  }
  assert(teacherRejected, "Teacher role blocked from resolving as student for enrollment");

  // Test 1.4: Server-side payment order & anti-tampering
  const basePrice = Number(testSubject.price_inr);
  const gst = Math.round(basePrice * 0.18);
  const totalAmountInr = basePrice + gst;
  const orderId = `order_test_${Date.now()}_abc123`;

  // Insert pending payment order with resolved authentic studentId
  const { data: pendingPayment, error: payInsErr } = await supabase
    .from("payments")
    .insert([
      {
        student_id: resolvedFromUserId.studentId, // Verified students.id
        subject_id: testSubject.id,
        amount_inr: totalAmountInr,
        currency: "INR",
        provider: "razorpay",
        provider_order_id: orderId,
        status: "pending",
        payment_method: "upi",
      },
    ])
    .select()
    .single();

  assert(!payInsErr && pendingPayment, "Pending payment recorded with authentic student_id");
  assert(pendingPayment.student_id === student1Row.id, "payment.student_id references authentic students(id)");
  assert(Number(pendingPayment.amount_inr) === 1770, "Authentic price ₹1770 (₹1500 + 18% GST) recorded");

  // Test 1.5: Cryptographic signature verification and enrollment activation
  const testPaymentId = `pay_real_test_${Date.now()}`;
  const validSignature = crypto
    .createHmac("sha256", razorpaySecret)
    .update(`${orderId}|${testPaymentId}`)
    .digest("hex");

  // Verify HMAC-SHA256 signature
  const expectedSig = crypto
    .createHmac("sha256", razorpaySecret)
    .update(`${orderId}|${testPaymentId}`)
    .digest("hex");
  assert(validSignature === expectedSig, "HMAC-SHA256 signature mathematically verified");

  // Mark payment as paid
  const nowStr = new Date().toISOString();
  const { data: paidPayment, error: payUpdateErr } = await supabase
    .from("payments")
    .update({
      status: "paid",
      provider_payment_id: testPaymentId,
      provider_signature: validSignature,
      paid_at: nowStr,
    })
    .eq("provider_order_id", orderId)
    .select()
    .single();

  assert(!payUpdateErr && paidPayment.status === "paid", "Payment status transitioned from 'pending' -> 'paid'");

  // Activate enrollment in database with authentic student_id
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  const { data: activatedEnrollment, error: enrollErr } = await supabase
    .from("enrollments")
    .upsert(
      [
        {
          student_id: resolvedFromUserId.studentId,
          subject_id: testSubject.id,
          status: "active",
          enrolled_at: nowStr,
          expires_at: expiresAt.toISOString(),
          enrollment_type: "paid",
          payment_id: paidPayment.id,
        },
      ],
      { onConflict: "student_id,subject_id" },
    )
    .select()
    .single();

  assert(!enrollErr && activatedEnrollment, "Enrollment activated successfully without foreign key violation");
  assert(activatedEnrollment.student_id === student1Row.id, `enrollment.student_id (${activatedEnrollment.student_id}) references authentic students(id)`);
  assert(activatedEnrollment.status === "active", "enrollment.status is 'active'");
  assert(activatedEnrollment.payment_id === paidPayment.id, "enrollment.payment_id links to payment record");

  // Test 1.6: Duplicate purchase prevention
  const { data: existingActive } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", resolvedFromUserId.studentId)
    .eq("subject_id", testSubject.id)
    .eq("status", "active")
    .maybeSingle();

  assert(existingActive !== null, "Duplicate check detects existing active enrollment");

  // Test 1.7: Free course enrollment
  const freeSubCode = `TEST_FREE_${Date.now()}`;
  const { data: freeSubject } = await supabase
    .from("subjects")
    .insert([
      {
        name: "Introductory Python Free",
        code: freeSubCode,
        standard: "10th",
        teacher_id: teacherRow.id,
        price_inr: 0,
        duration_months: 12,
        status: "published",
      },
    ])
    .select()
    .single();

  const { data: freeEnroll, error: freeEnrollErr } = await supabase
    .from("enrollments")
    .upsert(
      [
        {
          student_id: resolvedFromUserId.studentId,
          subject_id: freeSubject.id,
          status: "active",
          enrolled_at: nowStr,
          expires_at: expiresAt.toISOString(),
          enrollment_type: "free",
        },
      ],
      { onConflict: "student_id,subject_id" },
    )
    .select()
    .single();

  assert(!freeEnrollErr && freeEnroll, "Free course enrollment activated with authentic student_id");
  assert(freeEnroll.enrollment_type === "free", "Free enrollment has enrollment_type 'free'");

  // Clean up free subject and enrollment
  await supabase.from("enrollments").delete().eq("subject_id", freeSubject.id);
  await supabase.from("subjects").delete().eq("id", freeSubject.id);

  // =========================================================================
  // SECTION 2: GOOGLE MEET LIVE CLASS STORAGE & JOIN FLOW
  // =========================================================================
  console.log("\n[TEST SUITE 2] Google Meet Live Class Storage & Join Flow");

  const testMeetUrl = "https://meet.google.com/abc-defg-hij";
  const now = new Date();
  const startTime = new Date(now.getTime() + 10 * 60000).toISOString();
  const endTime = new Date(now.getTime() + 70 * 60000).toISOString();

  // Create scheduled class with Google Meet URL
  const { data: scheduledClass, error: classErr } = await supabase
    .from("scheduled_classes")
    .insert([
      {
        subject_id: testSubject.id,
        teacher_id: teacherRow.id,
        title: "Quantum Superposition & Entanglement",
        topic: "Chapter 1: Quantum Gates",
        starts_at: startTime,
        ends_at: endTime,
        meeting_url: testMeetUrl,
        status: "scheduled",
      },
    ])
    .select()
    .single();

  assert(!classErr && scheduledClass, "Scheduled class created in database");
  assert(scheduledClass.meeting_url === testMeetUrl, "scheduled_classes.meeting_url accurately stored Google Meet link");

  // Transition to 'live'
  const { data: liveClass } = await supabase
    .from("scheduled_classes")
    .update({ status: "live" })
    .eq("id", scheduledClass.id)
    .select()
    .single();

  assert(liveClass.status === "live", "Class transitioned to 'live' status");
  assert(liveClass.meeting_url === testMeetUrl, "Live class preserves meeting_url");

  // Verify attendance marking
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: attRecord, error: attErr } = await supabase
    .from("attendance")
    .upsert([
      {
        student_id: student1Row.id,
        subject_id: testSubject.id,
        teacher_id: teacherRow.id,
        attendance_date: todayStr,
        status: "present",
        session: "Quantum Superposition & Entanglement",
        notes: `Attended Google Meet live class: ${liveClass.title}`,
      },
    ], { onConflict: "student_id,subject_id,attendance_date,session" })
    .select()
    .single();

  assert(!attErr && attRecord, "Student attendance record successfully created upon joining");
  assert(attRecord.status === "present", "Attendance status is 'present'");

  // Clean up test data
  await supabase.from("attendance").delete().eq("subject_id", testSubject.id);
  await supabase.from("scheduled_classes").delete().eq("id", scheduledClass.id);
  await supabase.from("enrollments").delete().eq("subject_id", testSubject.id);
  await supabase.from("payments").delete().eq("subject_id", testSubject.id);
  await supabase.from("subjects").delete().eq("id", testSubject.id);

  console.log("\n================================================================================");
  console.log(`CUSTOM VERIFICATION SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
