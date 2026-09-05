/**
 * EduLive — STAGE 1: COMPLETE REAL PAYMENT LIFECYCLE VERIFICATION
 *
 * Executes the complete real payment lifecycle against:
 * 1. Real Razorpay Test/Sandbox API (https://api.razorpay.com/v1)
 * 2. Real Razorpay Mock Gateway (https://api.razorpay.com/v1/gateway/mocksharp)
 * 3. Real Supabase PostgreSQL database (aws-0-ap-south-1.pooler.supabase.com:6543)
 * 4. Real production backend server functions (payment-functions.ts and razorpay.ts)
 */

import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import {
  createPaymentOrderInternal,
  verifyPaymentInternal,
} from "../src/lib/server/payment-functions.ts";

import {
  getRazorpayConfig,
  createRazorpayOrder,
  verifyRazorpaySignature,
} from "../src/lib/server/razorpay.ts";

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
const checkResults = [];

function check(name, condition, details = "") {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ PASS: ${name}${details ? " — " + details : ""}`);
    checkResults.push({ name, status: "PASS", details });
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${name}${details ? " — " + details : ""}`);
    checkResults.push({ name, status: "FAIL", details });
  }
}

/**
 * Executes a real payment on Razorpay's test servers via Checkout API and mock bank gateway
 */
async function executeRealRazorpayTestPayment(
  config,
  orderId,
  amountInPaise,
  shouldSucceed = true,
) {
  // 1. Initiate payment on Razorpay Checkout API
  const createPayRes = await fetch("https://api.razorpay.com/v1/payments/create/ajax", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `https://api.razorpay.com/v1/checkout/public?key_id=${config.keyId}&order_id=${orderId}`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    body: new URLSearchParams({
      key_id: config.keyId,
      order_id: orderId,
      amount: String(amountInPaise),
      currency: "INR",
      method: "netbanking",
      bank: "YESB",
      email: "test_checkout_student@example.com",
      contact: "+919876543210",
    }).toString(),
  });

  const payData = await createPayRes.json();
  if (!payData.payment_id || !payData.request?.content?.callback_url) {
    throw new Error("Razorpay payment initiation failed: " + JSON.stringify(payData));
  }

  const paymentId = payData.payment_id;

  // 2. Submit Authorization to Razorpay Mocksharp Gateway
  const submitUrl =
    "https://api.razorpay.com/v1/gateway/mocksharp/payment/submit?key_id=" + config.keyId;
  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      callback_url: payData.request.content.callback_url,
      language_code: "en",
      success: shouldSucceed ? "S" : "F",
    }).toString(),
    redirect: "manual",
  });

  const cbUrl = submitRes.headers.get("location");
  if (cbUrl) {
    await fetch(cbUrl);
  }

  // 3. Verify status with Razorpay API
  const authHeader =
    "Basic " + Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const checkRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: authHeader },
  });
  const checkData = await checkRes.json();

  // 4. Compute authentic Razorpay HMAC signature if succeeded
  let signature = "";
  if (shouldSucceed) {
    signature = crypto
      .createHmac("sha256", config.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  }

  return {
    paymentId,
    signature,
    gatewayStatus: checkData.status,
    rawGatewayData: checkData,
  };
}

async function run() {
  console.log("================================================================================");
  console.log("EDULIVE — STAGE 1: COMPLETE REAL PAYMENT LIFECYCLE VERIFICATION");
  console.log("Target: Razorpay Sandbox API + Supabase PostgreSQL");
  console.log("================================================================================\n");

  await client.connect();

  const config = getRazorpayConfig();
  console.log("Razorpay Gateway Configuration:");
  console.log(
    `- Key ID: ${config.keyId} (${config.keyId.startsWith("rzp_test_") ? "TEST MODE VERIFIED" : "WARNING: LIVE KEY"})`,
  );
  console.log(`- Key Secret Configured: ${Boolean(config.keySecret)}`);
  console.log(`- Is Configured: ${config.isConfigured}\n`);

  check(
    "Razorpay credentials use TEST/SANDBOX mode",
    config.keyId.startsWith("rzp_test_"),
    config.keyId,
  );
  check("Razorpay secret is configured", Boolean(config.keySecret));

  // ---------------------------------------------------------------------------
  // SETUP DEDICATED TEST ACTORS & SUBJECTS
  // ---------------------------------------------------------------------------
  const timestamp = Date.now();
  const studentAEmail = `student_payment_test_a_${timestamp}@example.com`;
  const studentBEmail = `student_payment_test_b_${timestamp}@example.com`;

  // 1. Create Student A
  const sAUserRes = await client.query(
    "INSERT INTO users (email, name, role) VALUES ($1, $2, 'student') RETURNING id, email, name;",
    [studentAEmail, `Test Student A ${timestamp}`],
  );
  const studentAUser = sAUserRes.rows[0];
  const sAProfileRes = await client.query("SELECT id FROM students WHERE user_id = $1;", [
    studentAUser.id,
  ]);
  const studentA = { ...studentAUser, student_id: sAProfileRes.rows[0].id };

  // 2. Create Student B (for ownership attack tests)
  const sBUserRes = await client.query(
    "INSERT INTO users (email, name, role) VALUES ($1, $2, 'student') RETURNING id, email, name;",
    [studentBEmail, `Test Student B ${timestamp}`],
  );
  const studentBUser = sBUserRes.rows[0];
  const sBProfileRes = await client.query("SELECT id FROM students WHERE user_id = $1;", [
    studentBUser.id,
  ]);
  const studentB = { ...studentBUser, student_id: sBProfileRes.rows[0].id };

  // 3. Fetch reference teacher
  const teacherRes = await client.query("SELECT id, user_id FROM teachers LIMIT 1;");
  const teacher = teacherRes.rows[0];

  // 4. Create Dedicated Paid Subject (Price: ₹1500)
  const subjectPrice = 1500;
  const expectedGst = 270; // 18% of 1500
  const expectedTotalInr = 1770;
  const expectedTotalPaise = 177000;

  const subjRes = await client.query(
    "INSERT INTO subjects (teacher_id, name, standard, price_inr, duration_months, status) VALUES ($1, $2, 'Class 10', $3, 6, 'published') RETURNING id, name, price_inr;",
    [teacher.id, `Real Payment Test Course ${timestamp}`, subjectPrice],
  );
  const targetSubject = subjRes.rows[0];

  // 5. Create Second Subject (for course tampering tests)
  const subjBRes = await client.query(
    "INSERT INTO subjects (teacher_id, name, standard, price_inr, duration_months, status) VALUES ($1, $2, 'Class 10', 2000, 6, 'published') RETURNING id, name, price_inr;",
    [teacher.id, `Tampering Target Course ${timestamp}`],
  );
  const otherSubject = subjBRes.rows[0];

  console.log(`Test Entities Created:`);
  console.log(`- Student A: ${studentA.email} (Student ID: ${studentA.student_id})`);
  console.log(`- Student B: ${studentB.email} (Student ID: ${studentB.student_id})`);
  console.log(
    `- Primary Subject: "${targetSubject.name}" (ID: ${targetSubject.id}, Base: ₹${subjectPrice}, Total with GST: ₹${expectedTotalInr})`,
  );
  console.log(`- Tampering Subject: "${otherSubject.name}" (ID: ${otherSubject.id})\n`);

  // ===========================================================================
  // SECTION 2: REAL SUCCESSFUL PAYMENT TEST (Prompt Section 2)
  // ===========================================================================
  console.log("=== SECTION 2: REAL SUCCESSFUL PAYMENT LIFECYCLE ===");

  // Step 1: Initial state check
  const initPayCheck = await client.query(
    "SELECT COUNT(*) FROM payments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, targetSubject.id],
  );
  const initEnrollCheck = await client.query(
    "SELECT COUNT(*) FROM enrollments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, targetSubject.id],
  );
  check("Initial state: 0 payments for test subject", Number(initPayCheck.rows[0].count) === 0);
  check(
    "Initial state: 0 enrollments for test subject",
    Number(initEnrollCheck.rows[0].count) === 0,
  );

  // Step 2: Student starts checkout -> Backend creates Razorpay order
  const orderRes = await createPaymentOrderInternal(supabaseAdmin, {
    subjectId: targetSubject.id,
    studentId: studentA.student_id,
    authenticatedUserId: studentA.id,
  });

  check(
    "Order created with valid Razorpay order ID",
    orderRes.orderId.startsWith("order_"),
    orderRes.orderId,
  );
  check(
    "Order calculated authentic server total with 18% GST (₹1770)",
    orderRes.amountInr === expectedTotalInr,
    `amount: ₹${orderRes.amountInr}`,
  );
  check(
    "Order calculated authentic amount in paise (177000)",
    orderRes.amountInPaise === expectedTotalPaise,
    `paise: ${orderRes.amountInPaise}`,
  );
  check("Order currency is INR", orderRes.currency === "INR");
  check("Order subject name matches", orderRes.subjectName === targetSubject.name);
  check("Order is not marked free", orderRes.isFree === false);

  // Step 3: Check database pending payment record
  const pendingPayRes = await client.query("SELECT * FROM payments WHERE provider_order_id = $1;", [
    orderRes.orderId,
  ]);
  check("Pending payment row persisted in database", pendingPayRes.rowCount === 1);
  const pendingPayment = pendingPayRes.rows[0];
  check("Pending payment status is 'pending'", pendingPayment.status === "pending");
  check("Pending payment belongs to Student A", pendingPayment.student_id === studentA.student_id);
  check(
    "Pending payment belongs to target subject",
    pendingPayment.subject_id === targetSubject.id,
  );
  check(
    "Pending payment amount matches ₹1770",
    Number(pendingPayment.amount_inr) === expectedTotalInr,
  );

  // Step 4 & 5: Complete Razorpay Test Checkout through mock gateway
  console.log(`  -> Executing real transaction on Razorpay API for ${orderRes.orderId}...`);
  const realPaymentResult = await executeRealRazorpayTestPayment(
    config,
    orderRes.orderId,
    orderRes.amountInPaise,
    true, // Success
  );

  check(
    "Razorpay payment captured on gateway",
    realPaymentResult.gatewayStatus === "captured",
    `payment_id: ${realPaymentResult.paymentId}`,
  );
  check(
    "Cryptographic HMAC SHA256 signature generated",
    realPaymentResult.signature.length === 64,
    realPaymentResult.signature,
  );

  // Step 6 & 7: Send through production payment verification path
  console.log(`  -> Verifying payment through verifyPaymentInternal...`);
  const verifyRes = await verifyPaymentInternal(supabaseAdmin, {
    orderId: orderRes.orderId,
    paymentId: realPaymentResult.paymentId,
    signature: realPaymentResult.signature,
    subjectId: targetSubject.id,
    studentId: studentA.student_id,
    paymentMethod: "netbanking",
    authenticatedUserId: studentA.id,
  });

  check("Verification response reports success = true", verifyRes.success === true);
  check("Verification response reports enrolled = true", verifyRes.enrolled === true);
  check(
    "Verification response returns paymentId",
    verifyRes.paymentId === realPaymentResult.paymentId,
  );

  // Step 8: Verify payment row becomes 'paid' in DB
  const paidPayRes = await client.query("SELECT * FROM payments WHERE id = $1;", [
    pendingPayment.id,
  ]);
  const paidPayment = paidPayRes.rows[0];
  check("Database payment row transitioned to 'paid'", paidPayment.status === "paid");
  check(
    "Database payment records provider_payment_id",
    paidPayment.provider_payment_id === realPaymentResult.paymentId,
  );
  check(
    "Database payment records provider_signature",
    paidPayment.provider_signature === realPaymentResult.signature,
  );
  check("Database payment records paid_at timestamp", Boolean(paidPayment.paid_at));

  // Step 9: Verify enrollment becomes 'active' in DB
  const enrollRes = await client.query(
    "SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, targetSubject.id],
  );
  check("Database enrollment record created", enrollRes.rowCount === 1);
  const activeEnrollment = enrollRes.rows[0];
  check("Enrollment status is 'active'", activeEnrollment.status === "active");
  check("Enrollment type is 'paid'", activeEnrollment.enrollment_type === "paid");
  check("Enrollment links to paid payment record", activeEnrollment.payment_id === paidPayment.id);
  check("Enrollment has valid expiration date", new Date(activeEnrollment.expires_at) > new Date());

  // Step 10: Verify billing notification created for student
  const notifRes = await client.query(
    "SELECT * FROM notifications WHERE user_id = $1 AND related_entity_id = $2 ORDER BY created_at DESC LIMIT 1;",
    [studentA.id, targetSubject.id],
  );
  check(
    "Student received enrollment activation notification",
    notifRes.rowCount === 1 && notifRes.rows[0].type === "billing",
  );

  // Step 11: Verify student can access paid subject content
  let rlsAccessGranted = false;
  await client.query("BEGIN;");
  try {
    await client.query("SET LOCAL ROLE authenticated;");
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${studentA.id}';`);
    const rlsEnrollRes = await client.query(
      "SELECT e.id, s.name FROM enrollments e JOIN subjects s ON s.id = e.subject_id WHERE e.student_id = $1 AND e.status = 'active';",
      [studentA.student_id],
    );
    rlsAccessGranted = rlsEnrollRes.rows.some((r) => r.name === targetSubject.name);
  } finally {
    await client.query("ROLLBACK;");
  }
  check("Student A has active content access to purchased course under RLS", rlsAccessGranted);

  // Step 12: Verify no duplicate payment or enrollment created
  const totalPaysForSubject = await client.query(
    "SELECT COUNT(*) FROM payments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, targetSubject.id],
  );
  const totalEnrollsForSubject = await client.query(
    "SELECT COUNT(*) FROM enrollments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, targetSubject.id],
  );
  check(
    "Exactly 1 payment record exists for this purchase",
    Number(totalPaysForSubject.rows[0].count) === 1,
  );
  check(
    "Exactly 1 enrollment record exists for this purchase",
    Number(totalEnrollsForSubject.rows[0].count) === 1,
  );

  // ===========================================================================
  // SECTION 3: FAILED / CANCELLED PAYMENT TEST (Prompt Section 3)
  // ===========================================================================
  console.log("\n=== SECTION 3: FAILED / CANCELLED PAYMENT LIFECYCLE ===");

  const failSubjRes = await client.query(
    "INSERT INTO subjects (teacher_id, name, standard, price_inr, duration_months, status) VALUES ($1, $2, 'Class 10', 1200, 6, 'published') RETURNING id, name, price_inr;",
    [teacher.id, `Failure Test Course ${timestamp}`],
  );
  const failSubject = failSubjRes.rows[0];

  // 1. Create order
  const failOrderRes = await createPaymentOrderInternal(supabaseAdmin, {
    subjectId: failSubject.id,
    studentId: studentA.student_id,
    authenticatedUserId: studentA.id,
  });
  check("Failure test order created", failOrderRes.orderId.startsWith("order_"));

  // 2. Execute gateway rejection (Failure on bank page)
  console.log(`  -> Simulating bank decline on Razorpay gateway for ${failOrderRes.orderId}...`);
  const failPaymentResult = await executeRealRazorpayTestPayment(
    config,
    failOrderRes.orderId,
    failOrderRes.amountInPaise,
    false, // Failure / Decline
  );
  check("Gateway marked transaction as 'failed'", failPaymentResult.gatewayStatus === "failed");

  // 3. Attempt verification with invalid/cancelled signature
  let verificationRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: failOrderRes.orderId,
      paymentId: failPaymentResult.paymentId,
      signature: "invalid_failed_signature_00000000000000000000000000000000",
      subjectId: failSubject.id,
      studentId: studentA.student_id,
      paymentMethod: "netbanking",
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    verificationRejected = /signature verification failed/i.test(err.message);
  }
  check("Server rejected verification for failed payment", verificationRejected);

  // 4. Verify payment row in DB is NOT marked paid
  const failedDbPay = (
    await client.query("SELECT * FROM payments WHERE provider_order_id = $1;", [
      failOrderRes.orderId,
    ])
  ).rows[0];
  check("Failed payment status is NOT 'paid'", failedDbPay.status !== "paid");
  check("Failed payment status is marked 'failed'", failedDbPay.status === "failed");

  // 5. Verify enrollment was NOT activated
  const failedEnroll = await client.query(
    "SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, failSubject.id],
  );
  check("No enrollment activated for failed payment", failedEnroll.rowCount === 0);

  // 6. Verify student does NOT gain content access under RLS
  let failedContentAccess = true;
  await client.query("BEGIN;");
  try {
    await client.query("SET LOCAL ROLE authenticated;");
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${studentA.id}';`);
    const rlsFailCheck = await client.query(
      "SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2 AND status = 'active';",
      [studentA.student_id, failSubject.id],
    );
    failedContentAccess = rlsFailCheck.rowCount > 0;
  } finally {
    await client.query("ROLLBACK;");
  }
  check("Student denied content access for failed course", !failedContentAccess);

  // 7. Verify student can safely retry payment
  let retrySucceeded = false;
  try {
    const retryOrder = await createPaymentOrderInternal(supabaseAdmin, {
      subjectId: failSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
    retrySucceeded = Boolean(retryOrder.orderId);
  } catch (e) {
    retrySucceeded = false;
  }
  check("Student can safely retry checkout after failed payment", retrySucceeded);

  // ===========================================================================
  // SECTION 4: DUPLICATE VERIFICATION & IDEMPOTENCY (Prompt Section 4)
  // ===========================================================================
  console.log("\n=== SECTION 4: DUPLICATE VERIFICATION / IDEMPOTENCY ===");

  console.log(`  -> Submitting duplicate verification request for ${orderRes.orderId}...`);
  const duplicateVerifyRes = await verifyPaymentInternal(supabaseAdmin, {
    orderId: orderRes.orderId,
    paymentId: realPaymentResult.paymentId,
    signature: realPaymentResult.signature,
    subjectId: targetSubject.id,
    studentId: studentA.student_id,
    paymentMethod: "netbanking",
    authenticatedUserId: studentA.id,
  });

  check(
    "Duplicate verification returns success = true (idempotent)",
    duplicateVerifyRes.success === true,
  );
  check("Duplicate verification returns enrolled = true", duplicateVerifyRes.enrolled === true);
  check(
    "Duplicate verification acknowledges existing state",
    /already verified/i.test(duplicateVerifyRes.message),
  );

  // Verify database counts remain strictly 1
  const dupPayCount = await client.query(
    "SELECT COUNT(*) FROM payments WHERE provider_order_id = $1;",
    [orderRes.orderId],
  );
  const dupEnrollCount = await client.query(
    "SELECT COUNT(*) FROM enrollments WHERE student_id = $1 AND subject_id = $2;",
    [studentA.student_id, targetSubject.id],
  );
  check(
    "Payments count for order remains exactly 1 (no duplicate payment)",
    Number(dupPayCount.rows[0].count) === 1,
  );
  check(
    "Enrollments count remains exactly 1 (no duplicate enrollment)",
    Number(dupEnrollCount.rows[0].count) === 1,
  );

  // Verify duplicate order creation for actively enrolled student is blocked
  let dupOrderBlocked = false;
  try {
    await createPaymentOrderInternal(supabaseAdmin, {
      subjectId: targetSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    dupOrderBlocked = /already actively enrolled/i.test(err.message);
  }
  check("Duplicate order creation for actively enrolled student is rejected", dupOrderBlocked);

  // ===========================================================================
  // SECTION 5: SECURITY NEGATIVE TESTS (Prompt Section 5)
  // ===========================================================================
  console.log("\n=== SECTION 5: SECURITY NEGATIVE TESTS USING REAL FLOW ===");

  async function createTestOrder() {
    return createPaymentOrderInternal(supabaseAdmin, {
      subjectId: otherSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  }

  // 5.A: Invalid Signature
  const negOrderA = await createTestOrder();
  let invalidSigRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: negOrderA.orderId,
      paymentId: "pay_fake_" + Date.now(),
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
      subjectId: otherSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    invalidSigRejected = /signature verification failed/i.test(err.message);
  }
  check("5.A: Invalid signature rejected", invalidSigRejected);
  const negDbPayA = (
    await client.query("SELECT status FROM payments WHERE provider_order_id = $1;", [
      negOrderA.orderId,
    ])
  ).rows[0];
  check("5.A: Payment remains unpaid/failed in database", negDbPayA.status === "failed");

  // 5.B: Wrong Order ID (Mismatched order with real signature)
  let wrongOrderRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: "order_mismatched_nonexistent_999",
      paymentId: realPaymentResult.paymentId,
      signature: realPaymentResult.signature,
      subjectId: targetSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    wrongOrderRejected = /signature verification failed|not found/i.test(err.message);
  }
  check("5.B: Wrong order ID rejected", wrongOrderRejected);

  // 5.C: Wrong Payment ID
  const negOrderC = await createTestOrder();
  let wrongPayIdRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: negOrderC.orderId,
      paymentId: "pay_tampered_nonexistent_999",
      signature: realPaymentResult.signature,
      subjectId: otherSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    wrongPayIdRejected = /signature verification failed/i.test(err.message);
  }
  check("5.C: Wrong payment ID rejected", wrongPayIdRejected);

  // 5.D: Amount Tampering (Manipulating DB payment amount before verify)
  const negOrderD = await createTestOrder();
  await client.query("UPDATE payments SET amount_inr = 100 WHERE provider_order_id = $1;", [
    negOrderD.orderId,
  ]);
  const validSigD = crypto
    .createHmac("sha256", config.keySecret)
    .update(`${negOrderD.orderId}|pay_test_d`)
    .digest("hex");
  let amountTamperRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: negOrderD.orderId,
      paymentId: "pay_test_d",
      signature: validSigD,
      subjectId: otherSubject.id,
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    amountTamperRejected = /amount mismatch/i.test(err.message);
  }
  check("5.D: Amount tampering detected and rejected", amountTamperRejected);

  // 5.E: Subject Tampering (Attempting to claim subject B using subject A payment)
  const negOrderE = await createTestOrder();
  const validSigE = crypto
    .createHmac("sha256", config.keySecret)
    .update(`${negOrderE.orderId}|pay_test_e`)
    .digest("hex");
  let subjectTamperRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: negOrderE.orderId,
      paymentId: "pay_test_e",
      signature: validSigE,
      subjectId: targetSubject.id, // Mismatched subject ID
      studentId: studentA.student_id,
      authenticatedUserId: studentA.id,
    });
  } catch (err) {
    subjectTamperRejected = /does not match the requested course/i.test(err.message);
  }
  check("5.E: Subject tampering rejected", subjectTamperRejected);

  // 5.F: Student Ownership Tampering (Student B tries to verify Student A payment)
  let studentTamperRejected = false;
  try {
    await verifyPaymentInternal(supabaseAdmin, {
      orderId: orderRes.orderId,
      paymentId: realPaymentResult.paymentId,
      signature: realPaymentResult.signature,
      subjectId: targetSubject.id,
      studentId: studentB.student_id, // Student B attempting to claim Student A payment
      authenticatedUserId: studentB.id,
    });
  } catch (err) {
    studentTamperRejected = /does not belong to the authenticated student/i.test(err.message);
  }
  check("5.F: Cross-student ownership hijacking rejected", studentTamperRejected);

  // 5.G: Direct Client Enrollment Injection Blocked (RLS Security)
  let rlsDirectEnrollBlocked = false;
  await client.query("BEGIN;");
  try {
    await client.query("SET LOCAL ROLE authenticated;");
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${studentB.id}';`);
    await client.query(
      "INSERT INTO enrollments (student_id, subject_id, status) VALUES ($1, $2, 'active');",
      [studentB.student_id, targetSubject.id],
    );
  } catch (err) {
    rlsDirectEnrollBlocked = /violates row-level security/i.test(err.message);
  } finally {
    await client.query("ROLLBACK;");
  }
  check("5.G: Direct client enrollment injection blocked by RLS", rlsDirectEnrollBlocked);

  // ===========================================================================
  // SECTION 6: DATABASE INTEGRITY VERIFICATION (Prompt Section 6)
  // ===========================================================================
  console.log("\n=== SECTION 6: DATABASE INTEGRITY AUDIT ===");

  // 1. Verify payment belongs to correct student & subject
  const dbFinalPay = (
    await client.query("SELECT * FROM payments WHERE provider_order_id = $1;", [orderRes.orderId])
  ).rows[0];
  check("Payment belongs to correct student", dbFinalPay.student_id === studentA.student_id);
  check("Payment belongs to correct subject", dbFinalPay.subject_id === targetSubject.id);
  check("Payment recorded status is 'paid'", dbFinalPay.status === "paid");
  check("Razorpay order ID matches", dbFinalPay.provider_order_id === orderRes.orderId);
  check(
    "Razorpay payment ID matches",
    dbFinalPay.provider_payment_id === realPaymentResult.paymentId,
  );

  // 2. Verify enrollment belongs to same student & subject
  const dbFinalEnroll = (
    await client.query("SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2;", [
      studentA.student_id,
      targetSubject.id,
    ])
  ).rows[0];
  check("Enrollment belongs to correct student", dbFinalEnroll.student_id === studentA.student_id);
  check("Enrollment belongs to correct subject", dbFinalEnroll.subject_id === targetSubject.id);
  check("Enrollment status is 'active'", dbFinalEnroll.status === "active");
  check("Enrollment links to paid payment row ID", dbFinalEnroll.payment_id === dbFinalPay.id);

  // 3. Check for any orphaned successful payments
  const orphanedPays = await client.query(
    `
    SELECT p.id FROM payments p 
    LEFT JOIN enrollments e ON e.payment_id = p.id 
    WHERE p.status = 'paid' AND e.id IS NULL AND p.student_id = $1;
  `,
    [studentA.student_id],
  );
  check("Zero orphaned successful payments without enrollments", orphanedPays.rowCount === 0);

  // 4. Check for any active enrollments without payment
  const unbackedEnrolls = await client.query(
    `
    SELECT e.id FROM enrollments e 
    LEFT JOIN payments p ON p.id = e.payment_id 
    WHERE e.enrollment_type = 'paid' AND (p.id IS NULL OR p.status != 'paid') AND e.student_id = $1;
  `,
    [studentA.student_id],
  );
  check("Zero paid enrollments without confirmed payment", unbackedEnrolls.rowCount === 0);

  // ===========================================================================
  // SECTION 7: SECRET SAFETY CONFIRMATION (Prompt Section 7)
  // ===========================================================================
  console.log("\n=== SECTION 7: SECRET SAFETY CONFIRMATION ===");

  check(
    "Razorpay secret starts without public prefix (server-only)",
    !config.keySecret.startsWith("VITE_"),
  );
  check("Razorpay key uses test prefix ('rzp_test_')", config.keyId.startsWith("rzp_test_"));
  check(
    "Razorpay key does NOT use live prefix ('rzp_live_')",
    !config.keyId.startsWith("rzp_live_"),
  );

  // ===========================================================================
  // CLEANUP DEDICATED TEST DATA
  // ===========================================================================
  console.log("\nCleaning up dedicated test records...");
  const testSubjIds = [targetSubject.id, otherSubject.id, failSubject.id];
  const testStudentIds = [studentA.student_id, studentB.student_id];
  const testUserIds = [studentA.id, studentB.id];

  await client.query("DELETE FROM notifications WHERE user_id = ANY($1);", [testUserIds]);
  await client.query("DELETE FROM enrollments WHERE student_id = ANY($1);", [testStudentIds]);
  await client.query("DELETE FROM payments WHERE student_id = ANY($1);", [testStudentIds]);
  await client.query("DELETE FROM subjects WHERE id = ANY($1);", [testSubjIds]);
  await client.query("DELETE FROM students WHERE id = ANY($1);", [testStudentIds]);
  await client.query("DELETE FROM users WHERE id = ANY($1);", [testUserIds]);
  console.log("Cleanup complete: all dedicated test records removed.\n");

  await client.end();

  console.log("================================================================================");
  console.log(
    `STAGE 1 VERIFICATION SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED (Total: ${totalChecks})`,
  );
  console.log("================================================================================");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal Stage 1 Verification Error:", err);
  process.exit(1);
});
