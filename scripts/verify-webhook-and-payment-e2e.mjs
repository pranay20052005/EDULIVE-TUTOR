/**
 * EduLive — Final Razorpay Webhook & Payment E2E Gate Verification Script
 *
 * Exercises the complete real-world scenarios:
 * 1. Native HTTP POST to /api/webhooks/razorpay with raw HMAC verification
 * 2. Scenario A: Successful payment with immediate browser close -> independent webhook activation -> student course access
 * 3. Scenario B: Failed payment (bank decline) -> DB consistency -> no access -> retry possible
 * 4. Scenario C: Cancelled payment -> pending/failed status -> no access -> retry possible
 * 5. Idempotent duplicate webhook re-delivery -> no duplicate payments/enrollments/notifications
 * 6. Tampering resistance (amount tampering, subject mismatch, student mismatch)
 */

import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import serverHandler from "../src/server.ts";
import {
  createPaymentOrderInternal,
  handleRazorpayWebhookInternal,
} from "../src/lib/server/payment-functions.ts";
import {
  getRazorpayConfig,
  verifyWebhookSignature,
} from "../src/lib/server/razorpay.ts";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const dbClient = new Client({
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
  { auth: { persistSession: false } }
);

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const results = [];

function check(name, condition, details = "") {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ PASS: ${name}${details ? " — " + details : ""}`);
    results.push({ name, status: "PASS", details });
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${name}${details ? " — " + details : ""}`);
    results.push({ name, status: "FAIL", details });
  }
}

/**
 * Execute real payment on Razorpay Test API
 */
async function executeRealRazorpayTestPayment(config, orderId, amountInPaise, shouldSucceed = true) {
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
      email: "test_webhook_student@example.com",
      contact: "+919876543210",
    }).toString(),
  });

  const payData = await createPayRes.json();
  if (!payData.payment_id || !payData.request?.content?.callback_url) {
    throw new Error("Razorpay payment initiation failed: " + JSON.stringify(payData));
  }

  const paymentId = payData.payment_id;

  const submitUrl = "https://api.razorpay.com/v1/gateway/mocksharp/payment/submit?key_id=" + config.keyId;
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

  const authHeader = "Basic " + Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const checkRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: authHeader },
  });
  const checkData = await checkRes.json();

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

function generateWebhookSignature(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function run() {
  console.log("================================================================================");
  console.log("EDULIVE — RAZORPAY WEBHOOK & RELEASE GATE E2E VERIFICATION");
  console.log("================================================================================\n");

  await dbClient.connect();

  const config = getRazorpayConfig();
  const webhookSecret = config.webhookSecret || config.keySecret;
  console.log("Gateway Credentials Status:");
  console.log(`- Key ID: ${config.keyId} (${config.keyId.startsWith("rzp_test_") ? "TEST MODE" : "LIVE"})`);
  console.log(`- Key Secret: ${Boolean(config.keySecret)}`);
  console.log(`- Webhook Secret: ${Boolean(webhookSecret)}\n`);

  check("Razorpay Key uses TEST mode", config.keyId.startsWith("rzp_test_"), config.keyId);
  check("Razorpay Secret is configured", Boolean(config.keySecret));
  check("Razorpay Webhook Secret is configured", Boolean(webhookSecret));

  // SETUP TEST DATA
  const ts = Date.now();
  const studentEmail = `student_webhook_e2e_${ts}@example.com`;

  // Create Student
  const studentUserRes = await dbClient.query(
    "INSERT INTO users (email, name, role) VALUES ($1, $2, 'student') RETURNING id, email, name;",
    [studentEmail, `Test Student Webhook ${ts}`]
  );
  const studentUser = studentUserRes.rows[0];
  const studentProfileRes = await dbClient.query("SELECT id FROM students WHERE user_id = $1;", [studentUser.id]);
  const student = { ...studentUser, student_id: studentProfileRes.rows[0].id };

  // Fetch Teacher
  const teacherRes = await dbClient.query("SELECT id FROM teachers LIMIT 1;");
  const teacher = teacherRes.rows[0];

  // Create Course (Price: ₹2000, Total with GST: ₹2360)
  const basePrice = 2000;
  const expectedGst = 360;
  const expectedTotalInr = 2360;
  const expectedPaise = 236000;

  const subjectRes = await dbClient.query(
    "INSERT INTO subjects (teacher_id, name, standard, price_inr, duration_months, status) VALUES ($1, $2, 'Class 12', $3, 6, 'published') RETURNING id, name, price_inr;",
    [teacher.id, `Webhook Master Class ${ts}`, basePrice]
  );
  const subject = subjectRes.rows[0];

  console.log(`Test Entities:`);
  console.log(`- Student: ${student.email} (ID: ${student.student_id})`);
  console.log(`- Subject: "${subject.name}" (ID: ${subject.id}, Total ₹${expectedTotalInr})\n`);

  // ===========================================================================
  // GATE 1: NATIVE HTTP ENDPOINT: POST /api/webhooks/razorpay
  // ===========================================================================
  console.log("=== GATE 1: NATIVE HTTP WEBHOOK ENDPOINT VERIFICATION ===");

  // 1.1 Health Check on GET
  const getReq = new Request("http://localhost:3000/api/webhooks/razorpay", { method: "GET" });
  const getRes = await serverHandler.fetch(getReq, {}, {});
  check("GET /api/webhooks/razorpay returns HTTP 200 OK", getRes.status === 200);
  const getJson = await getRes.json();
  check("GET /api/webhooks/razorpay reports active gateway", getJson.status === "active");

  // 1.2 Missing Signature on POST
  const missingSigReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "payment.captured" }),
  });
  const missingSigRes = await serverHandler.fetch(missingSigReq, {}, {});
  check("POST with missing x-razorpay-signature rejected with HTTP 400", missingSigRes.status === 400);

  // 1.3 Forged Signature on POST
  const forgedSigReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": "0000000000000000000000000000000000000000000000000000000000000000",
    },
    body: JSON.stringify({ event: "payment.captured" }),
  });
  const forgedSigRes = await serverHandler.fetch(forgedSigReq, {}, {});
  check("POST with forged x-razorpay-signature rejected with HTTP 400", forgedSigRes.status === 400);

  // 1.4 Unsupported HTTP Method
  const putReq = new Request("http://localhost:3000/api/webhooks/razorpay", { method: "PUT" });
  const putRes = await serverHandler.fetch(putReq, {}, {});
  check("Unsupported HTTP method rejected with HTTP 405", putRes.status === 405);


  // ===========================================================================
  // GATE 2 & SCENARIO A: SUCCESSFUL PAYMENT & IMMEDIATE BROWSER-CLOSE FLOW
  // ===========================================================================
  console.log("\n=== GATE 2 & SCENARIO A: SUCCESSFUL PAYMENT & BROWSER-CLOSE FLOW ===");

  // Step 1: Student creates checkout order
  const order = await createPaymentOrderInternal(supabaseAdmin, {
    subjectId: subject.id,
    studentId: student.student_id,
    authenticatedUserId: student.id,
  });
  check("Order created with server-side calculated price (₹2360)", order.amountInr === expectedTotalInr);
  check("Order created with valid Razorpay order ID", order.orderId.startsWith("order_"));

  // Check initial DB payment is 'pending'
  const initDbPay = (await dbClient.query("SELECT * FROM payments WHERE provider_order_id = $1;", [order.orderId])).rows[0];
  check("Payment recorded in DB as 'pending'", initDbPay.status === "pending");

  // Step 2: Student completes payment on Razorpay Gateway
  console.log(`  -> Executing payment on Razorpay sandbox for ${order.orderId}...`);
  const rzpPayment = await executeRealRazorpayTestPayment(config, order.orderId, order.amountInPaise, true);
  check("Razorpay payment captured on sandbox gateway", rzpPayment.gatewayStatus === "captured", `payment_id: ${rzpPayment.paymentId}`);

  // Step 3: REAL-WORLD BROWSER-CLOSE CASE:
  // The student IMMEDIATELY closes the browser tab / crashes.
  // The client callback NEVER fires.
  // Only Razorpay Server -> EduLive Webhook delivers payment.captured event.
  console.log("  -> [Simulating Browser-Close] Client callback was NOT called. Delivering webhook...");

  const webhookPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: rzpPayment.paymentId,
          order_id: order.orderId,
          amount: order.amountInPaise,
          status: "captured",
          method: "netbanking",
        },
      },
    },
  });

  const webhookSig = generateWebhookSignature(webhookPayload, webhookSecret);

  // Send raw HTTP request to /api/webhooks/razorpay endpoint
  const httpWebhookReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": webhookSig,
    },
    body: webhookPayload,
  });

  const httpWebhookRes = await serverHandler.fetch(httpWebhookReq, {}, {});
  check("HTTP POST /api/webhooks/razorpay returns HTTP 200 OK", httpWebhookRes.status === 200);
  const webhookResult = await httpWebhookRes.json();
  check("Webhook response confirms success", webhookResult.success === true);
  check("Webhook returned captured payment ID", webhookResult.paymentId === rzpPayment.paymentId);

  // Step 4: Verify DB State after webhook execution
  const postWebhookPay = (await dbClient.query("SELECT * FROM payments WHERE provider_order_id = $1;", [order.orderId])).rows[0];
  check("DB Payment state transitioned to 'paid'", postWebhookPay.status === "paid");
  check("DB Payment records gateway payment ID", postWebhookPay.provider_payment_id === rzpPayment.paymentId);
  check("DB Payment records paid_at timestamp", Boolean(postWebhookPay.paid_at));

  // Step 5: Verify Enrollment Activated
  const enrollRes = await dbClient.query("SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2;", [student.student_id, subject.id]);
  check("DB Enrollment record created", enrollRes.rowCount === 1);
  const activeEnrollment = enrollRes.rows[0];
  check("Enrollment status is 'active'", activeEnrollment.status === "active");
  check("Enrollment type is 'paid'", activeEnrollment.enrollment_type === "paid");
  check("Enrollment references paid payment record", activeEnrollment.payment_id === postWebhookPay.id);

  // Step 6: Verify Notification Delivered
  const notifRes = await dbClient.query("SELECT * FROM notifications WHERE user_id = $1 AND related_entity_id = $2;", [student.id, subject.id]);
  check("Student received billing notification via webhook", notifRes.rowCount === 1);

  // Step 7: Verify Student Later Logs In -> Has Full Content Access Under RLS
  let studentHasAccess = false;
  await dbClient.query("BEGIN;");
  try {
    await dbClient.query("SET LOCAL ROLE authenticated;");
    await dbClient.query(`SET LOCAL "request.jwt.claim.sub" = '${student.id}';`);
    const rlsCheck = await dbClient.query(
      "SELECT e.id, s.name FROM enrollments e JOIN subjects s ON s.id = e.subject_id WHERE e.student_id = $1 AND e.status = 'active';",
      [student.student_id]
    );
    studentHasAccess = rlsCheck.rows.some(r => r.name === subject.name);
  } finally {
    await dbClient.query("ROLLBACK;");
  }
  check("Student logs in later -> course content is fully accessible under RLS", studentHasAccess);


  // ===========================================================================
  // GATE 3: IDEMPOTENCY & DUPLICATE WEBHOOK HANDLING
  // ===========================================================================
  console.log("\n=== GATE 3: IDEMPOTENCY & DUPLICATE WEBHOOK HANDLING ===");

  // Re-deliver the exact same webhook (e.g. Razorpay webhook retry)
  console.log("  -> Re-delivering exact same webhook to test idempotency...");
  const dupWebhookReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": webhookSig,
    },
    body: webhookPayload,
  });

  const dupWebhookRes = await serverHandler.fetch(dupWebhookReq, {}, {});
  check("Duplicate webhook returns HTTP 200 OK", dupWebhookRes.status === 200);
  const dupResult = await dupWebhookRes.json();
  check("Duplicate webhook acknowledged as already_paid", dupResult.reason === "already_paid" || dupResult.status === "ignored");

  // Verify database record counts remain strictly 1
  const totalPayCount = await dbClient.query("SELECT COUNT(*) FROM payments WHERE provider_order_id = $1;", [order.orderId]);
  const totalEnrollCount = await dbClient.query("SELECT COUNT(*) FROM enrollments WHERE student_id = $1 AND subject_id = $2;", [student.student_id, subject.id]);
  const totalNotifCount = await dbClient.query("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND related_entity_id = $2;", [student.id, subject.id]);

  check("Database payments count remains exactly 1 (no duplicates)", Number(totalPayCount.rows[0].count) === 1);
  check("Database enrollments count remains exactly 1 (no duplicates)", Number(totalEnrollCount.rows[0].count) === 1);
  check("Database notifications count remains exactly 1 (no duplicates)", Number(totalNotifCount.rows[0].count) === 1);


  // ===========================================================================
  // GATE 4 & SCENARIO B: FAILED PAYMENT LIFECYCLE
  // ===========================================================================
  console.log("\n=== GATE 4 & SCENARIO B: FAILED PAYMENT LIFECYCLE ===");

  const failSubjectRes = await dbClient.query(
    "INSERT INTO subjects (teacher_id, name, standard, price_inr, duration_months, status) VALUES ($1, $2, 'Class 12', 1500, 6, 'published') RETURNING id, name, price_inr;",
    [teacher.id, `Failed Payment Course ${ts}`]
  );
  const failSubject = failSubjectRes.rows[0];

  const failOrder = await createPaymentOrderInternal(supabaseAdmin, {
    subjectId: failSubject.id,
    studentId: student.student_id,
    authenticatedUserId: student.id,
  });

  console.log(`  -> Simulating bank decline on Razorpay sandbox for ${failOrder.orderId}...`);
  const rzpFailResult = await executeRealRazorpayTestPayment(config, failOrder.orderId, failOrder.amountInPaise, false);
  check("Gateway marked transaction as 'failed'", rzpFailResult.gatewayStatus === "failed");

  // Deliver payment.failed webhook
  const failWebhookPayload = JSON.stringify({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: rzpFailResult.paymentId,
          order_id: failOrder.orderId,
          status: "failed",
        },
      },
    },
  });
  const failWebhookSig = generateWebhookSignature(failWebhookPayload, webhookSecret);

  const failHttpReq = new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": failWebhookSig,
    },
    body: failWebhookPayload,
  });

  const failHttpRes = await serverHandler.fetch(failHttpReq, {}, {});
  check("Failed webhook handled with HTTP 200", failHttpRes.status === 200);

  // Check DB state for failed payment
  const failedDbPay = (await dbClient.query("SELECT * FROM payments WHERE provider_order_id = $1;", [failOrder.orderId])).rows[0];
  check("Failed payment status is NOT 'paid'", failedDbPay.status !== "paid");
  check("Failed payment status is marked 'failed'", failedDbPay.status === "failed");

  // Check no enrollment created
  const failEnrollCheck = await dbClient.query("SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2;", [student.student_id, failSubject.id]);
  check("No enrollment created for failed payment", failEnrollCheck.rowCount === 0);

  // Check student has NO content access
  let failAccessGranted = true;
  await dbClient.query("BEGIN;");
  try {
    await dbClient.query("SET LOCAL ROLE authenticated;");
    await dbClient.query(`SET LOCAL "request.jwt.claim.sub" = '${student.id}';`);
    const rlsFailCheck = await dbClient.query("SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2 AND status = 'active';", [student.student_id, failSubject.id]);
    failAccessGranted = rlsFailCheck.rowCount > 0;
  } finally {
    await dbClient.query("ROLLBACK;");
  }
  check("Course access is NOT granted for failed payment", !failAccessGranted);

  // Check student can retry
  let canRetry = false;
  try {
    const retryOrder = await createPaymentOrderInternal(supabaseAdmin, {
      subjectId: failSubject.id,
      studentId: student.student_id,
      authenticatedUserId: student.id,
    });
    canRetry = Boolean(retryOrder.orderId);
  } catch {
    canRetry = false;
  }
  check("Student can safely retry checkout after failed payment", canRetry);


  // ===========================================================================
  // GATE 5 & SCENARIO C: CANCELLED PAYMENT LIFECYCLE
  // ===========================================================================
  console.log("\n=== GATE 5 & SCENARIO C: CANCELLED PAYMENT LIFECYCLE ===");

  const cancelSubjectRes = await dbClient.query(
    "INSERT INTO subjects (teacher_id, name, standard, price_inr, duration_months, status) VALUES ($1, $2, 'Class 12', 1800, 6, 'published') RETURNING id, name, price_inr;",
    [teacher.id, `Cancelled Payment Course ${ts}`]
  );
  const cancelSubject = cancelSubjectRes.rows[0];

  const cancelOrder = await createPaymentOrderInternal(supabaseAdmin, {
    subjectId: cancelSubject.id,
    studentId: student.student_id,
    authenticatedUserId: student.id,
  });

  // User dismisses modal / cancels checkout without paying
  const cancelDbPay = (await dbClient.query("SELECT * FROM payments WHERE provider_order_id = $1;", [cancelOrder.orderId])).rows[0];
  check("Cancelled/abandoned payment remains in 'pending' status", cancelDbPay.status === "pending");

  // Verify no enrollment created
  const cancelEnrollCheck = await dbClient.query("SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2;", [student.student_id, cancelSubject.id]);
  check("No enrollment created for cancelled checkout", cancelEnrollCheck.rowCount === 0);

  // Verify no content access
  let cancelAccessGranted = true;
  await dbClient.query("BEGIN;");
  try {
    await dbClient.query("SET LOCAL ROLE authenticated;");
    await dbClient.query(`SET LOCAL "request.jwt.claim.sub" = '${student.id}';`);
    const rlsCancelCheck = await dbClient.query("SELECT * FROM enrollments WHERE student_id = $1 AND subject_id = $2 AND status = 'active';", [student.student_id, cancelSubject.id]);
    cancelAccessGranted = rlsCancelCheck.rowCount > 0;
  } finally {
    await dbClient.query("ROLLBACK;");
  }
  check("Course access is NOT granted for cancelled checkout", !cancelAccessGranted);

  // Verify retry is possible
  let canRetryCancel = false;
  try {
    const retryCancelOrder = await createPaymentOrderInternal(supabaseAdmin, {
      subjectId: cancelSubject.id,
      studentId: student.student_id,
      authenticatedUserId: student.id,
    });
    canRetryCancel = Boolean(retryCancelOrder.orderId);
  } catch {
    canRetryCancel = false;
  }
  check("Student can safely retry checkout for previously cancelled course", canRetryCancel);


  // ===========================================================================
  // GATE 6: TAMPERING NEGATIVE TESTS ON WEBHOOK
  // ===========================================================================
  console.log("\n=== GATE 6: WEBHOOK TAMPERING & SECURITY RESISTANCE ===");

  // 6.1 Tampered Amount Webhook
  const tamperedAmountPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_tamper_amt_" + ts,
          order_id: cancelOrder.orderId,
          amount: 100, // 1 INR instead of ₹2124
          status: "captured",
        },
      },
    },
  });
  const tamperedSig = generateWebhookSignature(tamperedAmountPayload, webhookSecret);
  const tamperedRes = await serverHandler.fetch(new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": tamperedSig },
    body: tamperedAmountPayload,
  }), {}, {});
  check("Webhook rejects amount tampering (HTTP 400)", tamperedRes.status === 400);

  // 6.2 Non-Existent Order ID Webhook
  const nonExistentOrderPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_fake_" + ts,
          order_id: "order_non_existent_99999",
          amount: 10000,
          status: "captured",
        },
      },
    },
  });
  const nonExistentSig = generateWebhookSignature(nonExistentOrderPayload, webhookSecret);
  const nonExistentRes = await serverHandler.fetch(new Request("http://localhost:3000/api/webhooks/razorpay", {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": nonExistentSig },
    body: nonExistentOrderPayload,
  }), {}, {});
  const nonExistentJson = await nonExistentRes.json();
  check("Webhook safely ignores non-existent order (status: ignored)", nonExistentJson.result?.status === "ignored" || nonExistentJson.status === "ignored");


  // ===========================================================================
  // CLEANUP TEST RECORDS
  // ===========================================================================
  console.log("\nCleaning up test entities...");
  const subjIds = [subject.id, failSubject.id, cancelSubject.id];
  await dbClient.query("DELETE FROM notifications WHERE user_id = $1;", [student.id]);
  await dbClient.query("DELETE FROM enrollments WHERE student_id = $1;", [student.student_id]);
  await dbClient.query("DELETE FROM payments WHERE student_id = $1;", [student.student_id]);
  await dbClient.query("DELETE FROM subjects WHERE id = ANY($1);", [subjIds]);
  await dbClient.query("DELETE FROM students WHERE id = $1;", [student.student_id]);
  await dbClient.query("DELETE FROM users WHERE id = $1;", [student.id]);
  console.log("Cleanup complete: all test entities removed cleanly.\n");

  await dbClient.end();

  console.log("================================================================================");
  console.log(`E2E GATE VERIFICATION SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED (Total: ${totalChecks})`);
  console.log("================================================================================");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal E2E Gate Error:", err);
  process.exit(1);
});
