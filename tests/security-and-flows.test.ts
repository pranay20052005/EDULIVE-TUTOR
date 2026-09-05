/**
 * EduLive — Production Security, Payments & Test Assessment Test Suite
 * Imports and exercises the REAL production implementations from:
 *   - src/lib/server/razorpay.ts
 *   - src/lib/server/payment-functions.ts
 *   - src/lib/server/test-functions.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { verifyRazorpaySignature, getRazorpayConfig } from "../src/lib/server/razorpay.ts";

import {
  evaluateTestAnswers,
  validateTestTimingAndAvailability,
  submitTestAttemptInternal,
  type AuthoritativeQuestion,
} from "../src/lib/server/test-functions.ts";

import {
  verifyPaymentInternal,
  createPaymentOrderInternal,
  authenticateAndResolveStudent,
  resolveStudentIdentity,
} from "../src/lib/server/payment-functions.ts";

// ============================================================================
// SUITE 1: Cryptographic Verification (Real Production Implementation)
// ============================================================================
describe("SUITE 1: Real Gateway Cryptographic Verification", () => {
  const testSecret = "sec_test_mock_secret_key_889900";

  test("Valid HMAC SHA256 signature passes verification", () => {
    const orderId = "order_123456";
    const paymentId = "pay_654321";
    const body = `${orderId}|${paymentId}`;

    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    const prevKey = process.env.RAZORPAY_KEY_ID;
    try {
      process.env.RAZORPAY_KEY_SECRET = testSecret;
      process.env.RAZORPAY_KEY_ID = "rzp_test_mock";

      const validSignature = crypto.createHmac("sha256", testSecret).update(body).digest("hex");

      const isValid = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: validSignature,
      });

      assert.equal(isValid, true, "Real verifyRazorpaySignature must pass for valid HMAC");
    } finally {
      process.env.RAZORPAY_KEY_SECRET = prevSecret;
      process.env.RAZORPAY_KEY_ID = prevKey;
    }
  });

  test("Forged or tampered signature is rejected", () => {
    const orderId = "order_123456";
    const paymentId = "pay_654321";
    const forgedSignature = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    const prevKey = process.env.RAZORPAY_KEY_ID;
    try {
      process.env.RAZORPAY_KEY_SECRET = testSecret;
      process.env.RAZORPAY_KEY_ID = "rzp_test_mock";

      const isValid = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: forgedSignature,
      });

      assert.equal(isValid, false, "Real verifyRazorpaySignature must reject tampered signature");
    } finally {
      process.env.RAZORPAY_KEY_SECRET = prevSecret;
      process.env.RAZORPAY_KEY_ID = prevKey;
    }
  });

  test("Signature with buffer length mismatch safely returns false without throwing", () => {
    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    const prevKey = process.env.RAZORPAY_KEY_ID;
    try {
      process.env.RAZORPAY_KEY_SECRET = testSecret;
      process.env.RAZORPAY_KEY_ID = "rzp_test_mock";

      assert.doesNotThrow(() => {
        const isValid = verifyRazorpaySignature({
          orderId: "order_1",
          paymentId: "pay_1",
          signature: "short_invalid_sig",
        });
        assert.equal(isValid, false, "Short signature should return false safely");
      });
    } finally {
      process.env.RAZORPAY_KEY_SECRET = prevSecret;
      process.env.RAZORPAY_KEY_ID = prevKey;
    }
  });

  test("Production mode rejects simulated signatures when gateway keys are missing", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    const prevKey = process.env.RAZORPAY_KEY_ID;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_KEY_ID;

      const isValid = verifyRazorpaySignature({
        orderId: "order_sim_1",
        paymentId: "pay_sim_1",
        signature: "sig_test_fake_token_123",
      });

      assert.equal(
        isValid,
        false,
        "Production environment must reject simulated signature when keys are missing",
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.RAZORPAY_KEY_SECRET = prevSecret;
      process.env.RAZORPAY_KEY_ID = prevKey;
    }
  });
});

// ============================================================================
// SUITE 2: Server-Side Test Grading Engine (Real Production Implementation)
// ============================================================================
describe("SUITE 2: Real Server-Side Test Grading Engine", () => {
  const sampleQuestions: AuthoritativeQuestion[] = [
    {
      id: "q1",
      type: "mcq",
      text: "What is the unit of force?",
      marks: 5,
      correct_answer_index: 2,
      options: ["Joule", "Watt", "Newton", "Pascal"],
    },
    {
      id: "q2",
      type: "truefalse",
      text: "Electrons carry positive charge.",
      marks: 3,
      correct_answer_index: 1,
      options: ["True", "False"],
    },
    {
      id: "q3",
      type: "short",
      text: "Name the process by which plants make food.",
      marks: 2,
      correct_answer: "Photosynthesis",
    },
  ];

  test("Full marks awarded when all MCQ, truefalse, and short answers are correct", () => {
    const answers = {
      q1: "2",
      q2: "1",
      q3: "photosynthesis",
    };

    const evaluation = evaluateTestAnswers({ questions: sampleQuestions, answers });
    assert.equal(evaluation.score, 10);
    assert.equal(evaluation.totalMarks, 10);
    assert.equal(evaluation.percentage, 100);
    assert.equal(evaluation.correctCount, 3);
    assert.equal(
      evaluation.questionResults.every((r) => r.isCorrect),
      true,
    );
  });

  test("Partial marks calculated accurately for mixed answers", () => {
    const answers = {
      q1: "2", // Correct (5 marks)
      q2: "0", // Incorrect (0 marks)
      q3: "respiration", // Incorrect (0 marks)
    };

    const evaluation = evaluateTestAnswers({ questions: sampleQuestions, answers });
    assert.equal(evaluation.score, 5);
    assert.equal(evaluation.totalMarks, 10);
    assert.equal(evaluation.percentage, 50);
    assert.equal(evaluation.correctCount, 1);
  });

  test("Empty or unsubmitted questions receive 0 marks without error", () => {
    const answers = {};

    const evaluation = evaluateTestAnswers({ questions: sampleQuestions, answers });
    assert.equal(evaluation.score, 0);
    assert.equal(evaluation.totalMarks, 10);
    assert.equal(evaluation.percentage, 0);
    assert.equal(evaluation.correctCount, 0);
  });

  test("Malformed answers or invalid question IDs do not crash evaluation or inflate score", () => {
    const answers = {
      q1: "invalid_non_numeric",
      q2: "-99",
      fake_question_999: "Newton",
    };

    const evaluation = evaluateTestAnswers({ questions: sampleQuestions, answers });
    assert.equal(evaluation.score, 0);
    assert.equal(evaluation.totalMarks, 10);
    assert.equal(evaluation.percentage, 0);
    assert.equal(evaluation.correctCount, 0);
  });
});

// ============================================================================
// SUITE 3: Assessment Timing & Duration Enforcement (Real Production Implementation)
// ============================================================================
describe("SUITE 3: Test Timing, Availability & Duration Rules", () => {
  test("Rejects test that has not started yet (starts_at in future)", () => {
    const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();
    const testRecord = {
      status: "published",
      starts_at: futureTime,
      ends_at: new Date(Date.now() + 7200 * 1000).toISOString(),
      duration_min: 60,
    };

    assert.throws(
      () => validateTestTimingAndAvailability({ test: testRecord, now: new Date() }),
      /Test has not started yet/,
    );
  });

  test("Rejects test that has already ended (ends_at in past)", () => {
    const pastStart = new Date(Date.now() - 7200 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 3600 * 1000).toISOString();
    const testRecord = {
      status: "published",
      starts_at: pastStart,
      ends_at: pastEnd,
      duration_min: 60,
    };

    assert.throws(
      () => validateTestTimingAndAvailability({ test: testRecord, now: new Date() }),
      /Test has ended/,
    );
  });

  test("Rejects test with unpublished or draft status", () => {
    const testRecord = {
      status: "draft",
      duration_min: 60,
    };

    assert.throws(
      () => validateTestTimingAndAvailability({ test: testRecord, now: new Date() }),
      /Test is not published/,
    );
  });

  test("Rejects submission when duration has expired beyond grace period", () => {
    const testRecord = {
      status: "published",
      duration_min: 30, // 30 minutes
    };

    // Attempt started 35 minutes ago (exceeds 30 min + 2 min grace period)
    const attemptRecord = {
      started_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      status: "in_progress",
    };

    assert.throws(
      () =>
        validateTestTimingAndAvailability({
          test: testRecord,
          attempt: attemptRecord,
          now: new Date(),
        }),
      /Test duration has expired/,
    );
  });

  test("Allows submission when duration is within allowed window (including grace period)", () => {
    const testRecord = {
      status: "published",
      duration_min: 30,
    };

    // Attempt started 25 minutes ago
    const attemptRecord = {
      started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      status: "in_progress",
    };

    assert.doesNotThrow(() => {
      validateTestTimingAndAvailability({
        test: testRecord,
        attempt: attemptRecord,
        now: new Date(),
      });
    });
  });
});

// ============================================================================
// HELPER: Mock Supabase Client for Business Logic Unit & Security Testing
// ============================================================================
function createMockSupabase(initialDb: {
  users?: any[];
  students?: any[];
  subjects?: any[];
  enrollments?: any[];
  payments?: any[];
  tests?: any[];
  test_attempts?: any[];
  test_questions?: any[];
  test_answers?: any[];
  notifications?: any[];
}) {
  const db: Record<string, any[]> = {
    users: initialDb.users ? [...initialDb.users] : [],
    students: initialDb.students ? [...initialDb.students] : [],
    subjects: initialDb.subjects ? [...initialDb.subjects] : [],
    enrollments: initialDb.enrollments ? [...initialDb.enrollments] : [],
    payments: initialDb.payments ? [...initialDb.payments] : [],
    tests: initialDb.tests ? [...initialDb.tests] : [],
    test_attempts: initialDb.test_attempts ? [...initialDb.test_attempts] : [],
    test_questions: initialDb.test_questions ? [...initialDb.test_questions] : [],
    test_answers: initialDb.test_answers ? [...initialDb.test_answers] : [],
    notifications: initialDb.notifications ? [...initialDb.notifications] : [],
  };

  const client: any = {
    _db: db,
    from(table: string) {
      const rows = db[table] || [];
      const currentFilter: Array<(row: any) => boolean> = [];
      let selectFields: string | null = null;
      let orderField: string | null = null;
      let ascending = true;
      let pendingUpdates: any = null;
      let isDelete = false;

      function executeQuery() {
        if (isDelete) {
          db[table] = rows.filter((r) => !currentFilter.every((fn) => fn(r)));
          return { data: null, error: null };
        }
        if (pendingUpdates) {
          const filtered = rows.filter((r) => currentFilter.every((fn) => fn(r)));
          for (const r of filtered) {
            Object.assign(r, pendingUpdates);
          }
          return { data: filtered, error: null };
        }
        let result = rows.filter((r) => currentFilter.every((fn) => fn(r)));
        if (orderField) {
          result = [...result].sort((a, b) => {
            const va = a[orderField!];
            const vb = b[orderField!];
            return ascending ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
          });
        }
        return { data: result, error: null };
      }

      const builder: any = {
        select(fields = "*") {
          selectFields = fields;
          return builder;
        },
        eq(col: string, val: any) {
          currentFilter.push((row: any) => row[col] === val);
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orderField = col;
          ascending = opts?.ascending !== false;
          return builder;
        },
        update(updates: any) {
          pendingUpdates = updates;
          return builder;
        },
        delete() {
          isDelete = true;
          return builder;
        },
        then(resolve: any, reject: any) {
          try {
            resolve(executeQuery());
          } catch (e) {
            if (reject) reject(e);
            else throw e;
          }
        },
        async maybeSingle() {
          const { data } = executeQuery();
          return { data: Array.isArray(data) ? data[0] || null : data, error: null };
        },
        async single() {
          const { data } = executeQuery();
          const item = Array.isArray(data) ? data[0] : data;
          if (!item) {
            return { data: null, error: { message: `Record not found in ${table}` } };
          }
          return { data: item, error: null };
        },
        async insert(items: any[] | any) {
          const toInsert = Array.isArray(items) ? items : [items];
          const created: any[] = [];
          for (const item of toInsert) {
            const row = { id: item.id || `mock_${table}_${Date.now()}_${Math.random()}`, ...item };
            db[table].push(row);
            created.push(row);
          }
          const res = created.length === 1 ? created[0] : created;
          return {
            data: res,
            error: null,
            then(resolve: any) {
              resolve({ data: res, error: null });
            },
            select() {
              return {
                data: res,
                error: null,
                then(resolve: any) {
                  resolve({ data: res, error: null });
                },
                async single() {
                  return { data: created[0], error: null };
                },
                async maybeSingle() {
                  return { data: created[0] || null, error: null };
                },
              };
            },
          };
        },
        async upsert(items: any[] | any) {
          const toInsert = Array.isArray(items) ? items : [items];
          for (const item of toInsert) {
            const existingIdx = db[table].findIndex(
              (r) =>
                (r.student_id &&
                  item.student_id &&
                  r.subject_id &&
                  item.subject_id &&
                  r.student_id === item.student_id &&
                  r.subject_id === item.subject_id) ||
                (r.user_id && item.user_id && r.user_id === item.user_id) ||
                (r.id && item.id && r.id === item.id),
            );
            if (existingIdx >= 0) {
              db[table][existingIdx] = { ...db[table][existingIdx], ...item };
            } else {
              db[table].push({ id: item.id || `upsert_${Date.now()}`, ...item });
            }
          }
          return {
            data: toInsert[0],
            error: null,
            then(resolve: any) {
              resolve({ data: toInsert[0], error: null });
            },
            select() {
              return {
                data: toInsert[0],
                error: null,
                then(resolve: any) {
                  resolve({ data: toInsert[0], error: null });
                },
                async single() {
                  return { data: toInsert[0], error: null };
                },
                async maybeSingle() {
                  return { data: toInsert[0] || null, error: null };
                },
              };
            },
          };
        },
      };

      return builder;
    },
    auth: {
      async getUser(token: string) {
        if (token === "valid_student_jwt_token") {
          return {
            data: {
              user: {
                id: "usr_student_1",
                email: "student1@example.com",
                user_metadata: { role: "student", name: "Alice Student" },
              },
            },
            error: null,
          };
        }
        if (token === "valid_student_2_jwt_token") {
          return {
            data: {
              user: {
                id: "usr_student_2",
                email: "student2@example.com",
                user_metadata: { role: "student", name: "Bob Student" },
              },
            },
            error: null,
          };
        }
        if (token === "teacher_jwt_token") {
          return {
            data: {
              user: {
                id: "usr_teacher_1",
                email: "teacher@example.com",
                user_metadata: { role: "teacher", name: "Prof Teacher" },
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: { message: "Invalid token" } };
      },
    },
  };

  return client;
}

// ============================================================================
// SUITE 4: Real Server Payment Verification Lifecycle (verifyPaymentInternal)
// ============================================================================
describe("SUITE 4: Real Server Payment Verification Lifecycle", () => {
  const basePrice = 1000;
  const gst = Math.round(basePrice * 0.18);
  const totalAmountInr = basePrice + gst; // 1180
  const validSecret = "test_rzp_secret_123456";

  function setupPaymentEnv() {
    process.env.RAZORPAY_KEY_SECRET = validSecret;
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.NODE_ENV = "test";

    return createMockSupabase({
      users: [
        { id: "usr_student_1", email: "student1@example.com", name: "Alice", role: "student" },
        { id: "usr_student_2", email: "student2@example.com", name: "Bob", role: "student" },
        { id: "usr_teacher_1", email: "teacher@example.com", name: "Prof", role: "teacher" },
      ],
      students: [
        { id: "stu_1", user_id: "usr_student_1" },
        { id: "stu_2", user_id: "usr_student_2" },
      ],
      subjects: [
        { id: "sub_physics", name: "Physics Class 10", price_inr: basePrice, duration_months: 6 },
        { id: "sub_chemistry", name: "Chemistry Class 10", price_inr: 800, duration_months: 6 },
      ],
      payments: [
        {
          id: "pay_rec_1",
          student_id: "stu_1",
          subject_id: "sub_physics",
          amount_inr: totalAmountInr,
          provider_order_id: "order_correct_1",
          status: "pending",
        },
        {
          id: "pay_rec_wrong_amt",
          student_id: "stu_1",
          subject_id: "sub_physics",
          amount_inr: 500, // Tampered amount
          provider_order_id: "order_wrong_amt",
          status: "pending",
        },
        {
          id: "pay_rec_failed",
          student_id: "stu_1",
          subject_id: "sub_physics",
          amount_inr: totalAmountInr,
          provider_order_id: "order_failed_status",
          status: "failed",
        },
        {
          id: "pay_rec_already_paid",
          student_id: "stu_1",
          subject_id: "sub_physics",
          amount_inr: totalAmountInr,
          provider_order_id: "order_already_paid",
          status: "paid",
        },
      ],
      enrollments: [],
    });
  }

  test("Valid payment: verifies HMAC, marks payment as 'paid', activates enrollment", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_correct_1";
    const paymentId = "pay_rzp_999";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await verifyPaymentInternal(mockSupabase, {
      orderId,
      paymentId,
      signature,
      subjectId: "sub_physics",
      studentId: "stu_1",
      authToken: "valid_student_jwt_token",
    });

    assert.equal(result.success, true);
    assert.equal(result.enrolled, true);

    // Verify DB state
    const payment = mockSupabase._db.payments.find((p: any) => p.provider_order_id === orderId);
    assert.equal(payment.status, "paid");
    assert.equal(payment.provider_payment_id, paymentId);

    const enrollment = mockSupabase._db.enrollments.find(
      (e: any) => e.student_id === "stu_1" && e.subject_id === "sub_physics",
    );
    assert.ok(enrollment, "Enrollment must be active in DB");
    assert.equal(enrollment.status, "active");
  });

  test("Invalid signature: rejects verification, updates payment to 'failed', blocks enrollment", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_correct_1";
    const paymentId = "pay_rzp_999";
    const forgedSignature = "forged_invalid_hmac_hex_string_12345";

    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature: forgedSignature,
        subjectId: "sub_physics",
        studentId: "stu_1",
        authToken: "valid_student_jwt_token",
      });
    }, /Payment signature verification failed/);

    const payment = mockSupabase._db.payments.find((p: any) => p.provider_order_id === orderId);
    assert.equal(payment.status, "failed");
    assert.equal(mockSupabase._db.enrollments.length, 0, "No enrollment should be created");
  });

  test("Nonexistent order: rejects verification when order does not exist", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_does_not_exist";
    const paymentId = "pay_1";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature,
        subjectId: "sub_physics",
        studentId: "stu_1",
        authToken: "valid_student_jwt_token",
      });
    }, /Payment order not found/);
  });

  test("Wrong student (hijack attempt): rejects payment when payment record belongs to another student", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_correct_1"; // belongs to stu_1
    const paymentId = "pay_rzp_999";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // stu_2 tries to claim stu_1's order
    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature,
        subjectId: "sub_physics",
        studentId: "stu_2",
        authToken: "valid_student_2_jwt_token",
      });
    }, /Payment does not belong to the authenticated student/);
  });

  test("Wrong subject (course tampering): rejects payment when subject mismatch detected", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_correct_1"; // order is for sub_physics
    const paymentId = "pay_rzp_999";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Client requests verification for sub_chemistry instead
    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature,
        subjectId: "sub_chemistry",
        studentId: "stu_1",
        authToken: "valid_student_jwt_token",
      });
    }, /Payment record does not match the requested course/);
  });

  test("Wrong amount (price tampering): rejects payment when recorded amount does not match price", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_wrong_amt";
    const paymentId = "pay_rzp_999";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature,
        subjectId: "sub_physics",
        studentId: "stu_1",
        authToken: "valid_student_jwt_token",
      });
    }, /Payment amount mismatch detected/);
  });

  test("Non-pending order: rejects verification when order is already failed", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_failed_status";
    const paymentId = "pay_rzp_999";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature,
        subjectId: "sub_physics",
        studentId: "stu_1",
        authToken: "valid_student_jwt_token",
      });
    }, /Cannot verify payment with status "failed"/);
  });

  test("Replay protection & Idempotency: repeated verification of paid order succeeds without duplicate writes", async () => {
    const mockSupabase = setupPaymentEnv();
    // Add active enrollment for stu_1 in sub_physics
    mockSupabase._db.enrollments.push({
      id: "enr_existing",
      student_id: "stu_1",
      subject_id: "sub_physics",
      status: "active",
    });

    const orderId = "order_already_paid";
    const paymentId = "pay_rzp_already_verified";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await verifyPaymentInternal(mockSupabase, {
      orderId,
      paymentId,
      signature,
      subjectId: "sub_physics",
      studentId: "stu_1",
      authToken: "valid_student_jwt_token",
    });

    assert.equal(result.success, true);
    assert.equal(result.enrolled, true);
    assert.match(result.message, /Payment already verified/);
    assert.equal(mockSupabase._db.enrollments.length, 1, "Must not create duplicate enrollments");
  });

  test("Unauthorized user: rejects non-student accounts attempting to verify payment", async () => {
    const mockSupabase = setupPaymentEnv();
    const orderId = "order_correct_1";
    const paymentId = "pay_rzp_999";
    const signature = crypto
      .createHmac("sha256", validSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    await assert.rejects(async () => {
      await verifyPaymentInternal(mockSupabase, {
        orderId,
        paymentId,
        signature,
        subjectId: "sub_physics",
        authToken: "teacher_jwt_token",
      });
    }, /cannot perform student actions/);
  });
});

// ============================================================================
// SUITE 5: Real Server Assessment Submission & Ownership (submitTestAttemptInternal)
// ============================================================================
describe("SUITE 5: Real Server Assessment Submission & Anti-Tampering", () => {
  function setupTestEnv() {
    return createMockSupabase({
      users: [
        { id: "usr_student_1", email: "student1@example.com", name: "Alice", role: "student" },
        { id: "usr_student_2", email: "student2@example.com", name: "Bob", role: "student" },
      ],
      students: [
        { id: "stu_1", user_id: "usr_student_1" },
        { id: "stu_2", user_id: "usr_student_2" },
      ],
      subjects: [{ id: "sub_science", name: "General Science", price_inr: 0 }],
      enrollments: [
        { id: "enr_1", student_id: "stu_1", subject_id: "sub_science", status: "active" },
        // student 2 is NOT enrolled
      ],
      tests: [
        {
          id: "test_exam_1",
          subject_id: "sub_science",
          title: "Mid-Term Science Exam",
          total_marks: 10,
          duration_min: 45,
          status: "published",
        },
      ],
      test_questions: [
        {
          id: "tq_1",
          test_id: "test_exam_1",
          type: "mcq",
          text: "What is H2O?",
          marks: 5,
          correct_answer_index: 0,
          options: ["Water", "Oxygen"],
          question_order: 1,
        },
        {
          id: "tq_2",
          test_id: "test_exam_1",
          type: "short",
          text: "Formula of carbon dioxide",
          marks: 5,
          correct_answer: "CO2",
          question_order: 2,
        },
      ],
      test_attempts: [
        {
          id: "att_in_progress",
          test_id: "test_exam_1",
          student_id: "stu_1",
          status: "in_progress",
          started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        },
        {
          id: "att_student_2",
          test_id: "test_exam_1",
          student_id: "stu_2",
          status: "in_progress",
          started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
      ],
      test_answers: [],
    });
  }

  test("Valid submission: authoritatively evaluates answers and updates attempt to 'graded'", async () => {
    const mockSupabase = setupTestEnv();

    const result = await submitTestAttemptInternal(mockSupabase, {
      testId: "test_exam_1",
      studentId: "stu_1",
      authToken: "valid_student_jwt_token",
      answers: {
        tq_1: "0", // Correct (5 marks)
        tq_2: "co2", // Correct (5 marks)
      },
    });

    assert.equal(result.status, "graded");
    assert.equal(result.score, 10);
    assert.equal(result.totalMarks, 10);
    assert.equal(result.percentage, 100);
    assert.equal(result.correctCount, 2);

    const updatedAttempt = mockSupabase._db.test_attempts.find(
      (a: any) => a.id === "att_in_progress",
    );
    assert.equal(updatedAttempt.status, "graded");
    assert.equal(updatedAttempt.score, 10);
    assert.equal(mockSupabase._db.test_answers.length, 2);
  });

  test("Partial submission: calculates authoritative score based strictly on correct answers", async () => {
    const mockSupabase = setupTestEnv();

    const result = await submitTestAttemptInternal(mockSupabase, {
      testId: "test_exam_1",
      studentId: "stu_1",
      authToken: "valid_student_jwt_token",
      answers: {
        tq_1: "0", // Correct (5 marks)
        tq_2: "wrong", // Incorrect (0 marks)
      },
    });

    assert.equal(result.score, 5);
    assert.equal(result.percentage, 50);
    assert.equal(result.correctCount, 1);
  });

  test("Unenrolled student rejection: cannot submit attempt without active enrollment", async () => {
    const mockSupabase = setupTestEnv();

    await assert.rejects(async () => {
      await submitTestAttemptInternal(mockSupabase, {
        testId: "test_exam_1",
        studentId: "stu_2",
        authToken: "valid_student_2_jwt_token",
        answers: {},
      });
    }, /Student is not actively enrolled/);
  });

  test("Attempt impersonation rejection: student cannot submit another student's attempt", async () => {
    const mockSupabase = setupTestEnv();

    // Client passes student 2's ID using student 1's auth session
    await assert.rejects(async () => {
      await submitTestAttemptInternal(mockSupabase, {
        testId: "test_exam_1",
        studentId: "stu_2",
        authToken: "valid_student_jwt_token",
        answers: {},
      });
    }, /does not match the authenticated student/);
  });

  test("Replay prevention: rejects submission when attempt is already 'graded'", async () => {
    const mockSupabase = setupTestEnv();

    const att = mockSupabase._db.test_attempts.find((a: any) => a.id === "att_in_progress");
    if (att) att.status = "graded";

    await assert.rejects(async () => {
      await submitTestAttemptInternal(mockSupabase, {
        testId: "test_exam_1",
        studentId: "stu_1",
        authToken: "valid_student_jwt_token",
        answers: { tq_1: "0" },
      });
    }, /already been submitted and finalized/);
  });
});
