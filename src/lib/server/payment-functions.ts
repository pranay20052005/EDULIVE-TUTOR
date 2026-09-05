/**
 * Server Functions for Payments and Course Access Control
 * Enforces server-side price lookup, anti-tampering, duplicate prevention, cryptographic verification,
 * and authentic student identity resolution for PostgreSQL foreign key constraints.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  getRazorpayConfig,
} from "./razorpay.ts";

export function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export interface ResolvedStudent {
  studentId: string;
  userId: string;
  userEmail: string;
  userName: string;
}

/**
 * Extract auth token from request context or payload
 */
export async function extractAuthToken(payloadToken?: string): Promise<string | undefined> {
  if (payloadToken && payloadToken.trim()) {
    return payloadToken.trim();
  }
  try {
    const serverModule = await import("@tanstack/react-start/server");
    if (serverModule?.getRequestHeader) {
      const authHeader = serverModule.getRequestHeader("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7).trim();
      }
    }
  } catch {
    // Outside active request context or running in test environment
  }
  return undefined;
}

/**
 * Authenticate caller and resolve their authentic student record.
 * Never trusts client-supplied studentId without server-side ownership verification.
 */
export async function authenticateAndResolveStudent(
  supabase: SupabaseClient<any, any, any>,
  params: {
    authToken?: string;
    clientStudentId?: string;
    explicitUserId?: string;
  },
): Promise<ResolvedStudent> {
  const { authToken, clientStudentId, explicitUserId } = params;

  let verifiedUserId: string | undefined = explicitUserId;

  // 1. If explicit user ID not provided, verify via Supabase Auth JWT
  if (!verifiedUserId && authToken) {
    const { data: authData, error: authErr } = await supabase.auth.getUser(authToken);
    if (authErr || !authData?.user) {
      throw new Error(
        `Authentication failed: Invalid or expired session token (${authErr?.message || "User not found"}).`,
      );
    }
    verifiedUserId = authData.user.id;
  }

  // 2. If we have a verified user ID, resolve their student record authoritatively
  if (verifiedUserId) {
    // Check role in users table
    const { data: userRec } = await supabase
      .from("users")
      .select("id, email, name, role")
      .eq("id", verifiedUserId)
      .maybeSingle();

    if (userRec && userRec.role !== "student") {
      throw new Error(`Accounts with role "${userRec.role}" cannot perform student actions.`);
    }

    // Find student record linked to this user
    let { data: studentRec } = await supabase
      .from("students")
      .select("id, user_id")
      .eq("user_id", verifiedUserId)
      .maybeSingle();

    // Auto-create student row if missing for a valid student user
    if (!studentRec) {
      const { data: newStudent, error: createErr } = await supabase
        .from("students")
        .insert({
          user_id: verifiedUserId,
          board: "",
          standard: "",
        })
        .select("id, user_id")
        .single();

      if (createErr || !newStudent) {
        throw new Error(
          `Failed to initialize student profile: ${createErr?.message || "Unknown error"}`,
        );
      }
      studentRec = newStudent;
    }

    // Check ownership against client-provided ID (Anti-Impersonation Check)
    if (
      clientStudentId &&
      clientStudentId !== studentRec.id &&
      clientStudentId !== verifiedUserId
    ) {
      throw new Error(
        "Unauthorized: Client-provided studentId does not match the authenticated student.",
      );
    }

    return {
      studentId: studentRec.id,
      userId: verifiedUserId,
      userEmail: userRec?.email || "",
      userName: userRec?.name || "Student",
    };
  }

  // 3. Fallback resolution if neither token nor explicitUserId was supplied
  // Only permitted in non-production environments when clientStudentId is explicitly passed
  if (clientStudentId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Authentication required: Missing active session token.");
    }
    return resolveStudentIdentity(supabase, clientStudentId);
  }

  throw new Error("Authentication required: No authenticated user session found.");
}

/**
 * Robust server-side student identity resolution
 * Resolves the genuine public.students.id from any valid student identifier (students.id, users.id, or auth.users.id).
 * Guarantees that enrollments.student_id foreign key constraint is satisfied without fake IDs.
 */
export async function resolveStudentIdentity(
  supabase: SupabaseClient<any, any, any>,
  identifier: string,
): Promise<ResolvedStudent> {
  if (!identifier) {
    throw new Error("Student identity is required.");
  }

  // 1. Try finding by students.id
  const { data: byStudentId } = await supabase
    .from("students")
    .select("id, user_id, user:users(id, email, name, role)")
    .eq("id", identifier)
    .maybeSingle();

  if (byStudentId) {
    const userRole = (byStudentId.user as any)?.role;
    if (userRole && userRole !== "student") {
      throw new Error(`Accounts with role "${userRole}" cannot enroll in courses.`);
    }
    return {
      studentId: byStudentId.id,
      userId: byStudentId.user_id,
      userEmail: (byStudentId.user as any)?.email || "",
      userName: (byStudentId.user as any)?.name || "Student",
    };
  }

  // 2. Try finding by students.user_id
  const { data: byUserId } = await supabase
    .from("students")
    .select("id, user_id, user:users(id, email, name, role)")
    .eq("user_id", identifier)
    .maybeSingle();

  if (byUserId) {
    const userRole = (byUserId.user as any)?.role;
    if (userRole && userRole !== "student") {
      throw new Error(`Accounts with role "${userRole}" cannot enroll in courses.`);
    }
    return {
      studentId: byUserId.id,
      userId: byUserId.user_id,
      userEmail: (byUserId.user as any)?.email || "",
      userName: (byUserId.user as any)?.name || "Student",
    };
  }

  // 3. Try finding in users table by id
  const { data: userRec } = await supabase
    .from("users")
    .select("id, email, name, role")
    .eq("id", identifier)
    .maybeSingle();

  if (userRec) {
    if (userRec.role !== "student") {
      throw new Error(`Accounts with role "${userRec.role}" cannot enroll in courses.`);
    }

    const { data: createdStudent, error: createStudentErr } = await supabase
      .from("students")
      .insert({
        user_id: userRec.id,
        board: "",
        standard: "",
      })
      .select("id, user_id")
      .single();

    if (createStudentErr || !createdStudent) {
      const { data: retryStudent } = await supabase
        .from("students")
        .select("id, user_id")
        .eq("user_id", userRec.id)
        .maybeSingle();

      if (retryStudent) {
        return {
          studentId: retryStudent.id,
          userId: userRec.id,
          userEmail: userRec.email,
          userName: userRec.name,
        };
      }
      throw new Error(
        `Failed to resolve or create student profile: ${createStudentErr?.message || "Unknown error"}`,
      );
    }

    return {
      studentId: createdStudent.id,
      userId: userRec.id,
      userEmail: userRec.email,
      userName: userRec.name,
    };
  }

  throw new Error("Student profile not found. Please log in with a valid student account.");
}

export interface CreateOrderParams {
  subjectId: string;
  studentId?: string;
  authToken?: string;
  authenticatedUserId?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  amountInr: number;
  amountInPaise: number;
  currency: string;
  keyId: string;
  isFree: boolean;
  subjectName: string;
  isPendingConfig?: boolean;
}

/**
 * Core business logic for creating a payment order.
 * Can be called directly by server functions and automated test suites.
 */
export async function createPaymentOrderInternal(
  supabase: SupabaseClient<any, any, any>,
  params: CreateOrderParams,
): Promise<CreateOrderResponse> {
  const { subjectId, studentId, authToken, authenticatedUserId } = params;
  if (!subjectId) {
    throw new Error("Missing required parameter: subjectId is required.");
  }

  // 1. Resolve authentic student identity server-side
  const studentInfo = await authenticateAndResolveStudent(supabase, {
    authToken,
    clientStudentId: studentId,
    explicitUserId: authenticatedUserId,
  });
  const authenticStudentId = studentInfo.studentId;

  // 2. Fetch authentic subject from database
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name, price_inr, duration_months, status")
    .eq("id", subjectId)
    .single();

  if (subjectError || !subject) {
    throw new Error("Course not found or inactive.");
  }

  // 3. Check if student is already actively enrolled (Duplicate purchase prevention)
  const { data: existingEnrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", authenticStudentId)
    .eq("subject_id", subjectId)
    .eq("status", "active")
    .maybeSingle();

  if (existingEnrollment) {
    throw new Error("Student is already actively enrolled in this course.");
  }

  const basePrice = Number(subject.price_inr) || 0;

  // 4. Free course handling
  if (basePrice === 0) {
    return {
      orderId: `free_${subjectId}_${Date.now()}`,
      amountInr: 0,
      amountInPaise: 0,
      currency: "INR",
      keyId: "",
      isFree: true,
      subjectName: subject.name,
    };
  }

  // 5. Calculate total with GST (18%) on server
  const gst = Math.round(basePrice * 0.18);
  const totalAmountInr = basePrice + gst;
  const amountInPaise = totalAmountInr * 100;

  // 6. Create Razorpay order on server
  const receipt = `rcpt_${authenticStudentId.substring(0, 8)}_${Date.now()}`;
  const rzpOrder = await createRazorpayOrder({
    amountInPaise,
    currency: "INR",
    receipt,
    notes: {
      subject_id: subjectId,
      student_id: authenticStudentId,
      subject_name: subject.name,
    },
  });

  // 7. Record pending payment in database with verified student_id
  const { error: insertErr } = await supabase.from("payments").insert([
    {
      student_id: authenticStudentId,
      subject_id: subjectId,
      amount_inr: totalAmountInr,
      currency: "INR",
      provider: "razorpay",
      provider_order_id: rzpOrder.id,
      status: "pending",
      payment_method: "upi",
    },
  ]);

  if (insertErr) {
    throw new Error(`Failed to record pending payment: ${insertErr.message}`);
  }

  const rzpConfig = getRazorpayConfig();

  return {
    orderId: rzpOrder.id,
    amountInr: totalAmountInr,
    amountInPaise,
    currency: "INR",
    keyId: rzpConfig.keyId || "rzp_test_placeholder",
    isFree: false,
    subjectName: subject.name,
    isPendingConfig: rzpOrder.isPendingConfig,
  };
}

/**
 * Server Function: Create Payment Order
 */
export const createPaymentOrderFn = createServerFn({ method: "POST" })
  .validator((data: { subjectId: string; studentId?: string; authToken?: string }) => data)
  .handler(async ({ data }): Promise<CreateOrderResponse> => {
    const supabase = getServerSupabase();
    const token = await extractAuthToken(data.authToken);
    return createPaymentOrderInternal(supabase, {
      ...data,
      authToken: token,
    });
  });

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
  subjectId: string;
  studentId?: string;
  paymentMethod?: string;
  authToken?: string;
  authenticatedUserId?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  paymentId: string;
  subjectId: string;
  enrolled: boolean;
  message: string;
}

/**
 * Core business logic for verifying payment and activating course enrollment.
 * Can be called directly by server functions and automated test suites.
 */
export async function verifyPaymentInternal(
  supabase: SupabaseClient<any, any, any>,
  params: VerifyPaymentParams,
): Promise<VerifyPaymentResponse> {
  const {
    orderId,
    paymentId,
    signature,
    subjectId,
    studentId,
    paymentMethod,
    authToken,
    authenticatedUserId,
  } = params;

  if (!orderId || !paymentId || !signature || !subjectId) {
    throw new Error("Missing required verification parameters.");
  }

  // 1. Resolve authentic student identity server-side
  const studentInfo = await authenticateAndResolveStudent(supabase, {
    authToken,
    clientStudentId: studentId,
    explicitUserId: authenticatedUserId,
  });
  const authenticStudentId = studentInfo.studentId;

  // 2. Cryptographically verify Razorpay signature
  const isValidSignature = verifyRazorpaySignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isValidSignature) {
    // Record failed payment in DB if order exists and is still pending
    await supabase
      .from("payments")
      .update({
        status: "failed",
        provider_payment_id: paymentId,
        provider_signature: signature,
      })
      .eq("provider_order_id", orderId)
      .eq("status", "pending");

    throw new Error("Payment signature verification failed. Enrollment was not activated.");
  }

  // 3. Fetch existing payment record by orderId
  const { data: paymentRecord } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_order_id", orderId)
    .maybeSingle();

  if (!paymentRecord) {
    throw new Error("Payment order not found.");
  }

  // 4. Verify Identity: The payment must belong to the authenticated student
  if (paymentRecord.student_id !== authenticStudentId) {
    throw new Error("Unauthorized: Payment does not belong to the authenticated student.");
  }

  // 5. Verify Subject: The payment must be for the requested subject
  if (paymentRecord.subject_id !== subjectId) {
    throw new Error("Payment record does not match the requested course.");
  }

  // 6. Fetch authoritative subject price & details
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, duration_months, price_inr")
    .eq("id", subjectId)
    .single();

  if (!subject) {
    throw new Error("Course not found.");
  }

  const basePrice = Number(subject.price_inr) || 0;
  const gst = Math.round(basePrice * 0.18);
  const expectedTotalInr = basePrice + gst;

  // 7. Verify Amount: Ensure recorded payment matches authoritative calculated price
  if (Number(paymentRecord.amount_inr) !== expectedTotalInr) {
    throw new Error("Payment amount mismatch detected.");
  }

  // 8. Replay Protection & Idempotency
  if (paymentRecord.status === "paid") {
    // Payment was already successfully verified and processed
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("student_id", authenticStudentId)
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .maybeSingle();

    if (existingEnrollment) {
      return {
        success: true,
        paymentId,
        subjectId,
        enrolled: true,
        message: "Payment already verified and enrollment is active.",
      };
    }
  } else if (paymentRecord.status !== "pending") {
    throw new Error(`Cannot verify payment with status "${paymentRecord.status}".`);
  }

  const durationMonths = subject?.duration_months || 6;
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
  const now = new Date().toISOString();

  // 9. Atomic Payment State Transition (only update if status is still pending or existing paid)
  if (paymentRecord.status === "pending") {
    const { error: updateErr } = await supabase
      .from("payments")
      .update({
        status: "paid",
        provider_payment_id: paymentId,
        provider_signature: signature,
        payment_method: paymentMethod || "upi",
        paid_at: now,
      })
      .eq("id", paymentRecord.id)
      .eq("status", "pending");

    if (updateErr) {
      throw new Error(`Failed to update payment status: ${updateErr.message}`);
    }
  }

  // 10. Activate Enrollment (Idempotent upsert)
  const { error: enrollError } = await supabase.from("enrollments").upsert(
    [
      {
        student_id: authenticStudentId,
        subject_id: subjectId,
        status: "active",
        enrolled_at: now,
        expires_at: expiresAt.toISOString(),
        enrollment_type: "paid",
        payment_id: paymentRecord.id,
      },
    ],
    { onConflict: "student_id,subject_id" },
  );

  if (enrollError) {
    throw new Error(
      `Payment verified (${paymentId}) but failed to activate enrollment: ${enrollError.message}. Payment has been preserved for reconciliation.`,
    );
  }

  // 11. Send notification to student
  if (studentInfo.userId) {
    await supabase.from("notifications").insert([
      {
        user_id: studentInfo.userId,
        title: "Enrollment Activated! 🎉",
        message: `Your enrollment in ${subject.name} is now active. You have full access to live classes, recordings, and notes.`,
        type: "billing",
        read: false,
        related_entity_id: subjectId,
        related_entity_type: "subject",
      },
    ]);
  }

  return {
    success: true,
    paymentId,
    subjectId,
    enrolled: true,
    message: `Successfully enrolled in ${subject.name}`,
  };
}

/**
 * Server Function: Verify Payment & Activate Enrollment
 */
export const verifyPaymentFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      orderId: string;
      paymentId: string;
      signature: string;
      subjectId: string;
      studentId?: string;
      paymentMethod?: string;
      authToken?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<VerifyPaymentResponse> => {
    const supabase = getServerSupabase();
    const token = await extractAuthToken(data.authToken);
    return verifyPaymentInternal(supabase, {
      ...data,
      authToken: token,
    });
  });

export interface EnrollFreeCourseParams {
  subjectId: string;
  studentId?: string;
  authToken?: string;
  authenticatedUserId?: string;
}

/**
 * Core business logic for free course enrollment
 */
export async function enrollFreeCourseInternal(
  supabase: SupabaseClient<any, any, any>,
  params: EnrollFreeCourseParams,
): Promise<{ success: boolean; message: string }> {
  const { subjectId, studentId, authToken, authenticatedUserId } = params;

  // 1. Resolve authentic student identity server-side
  const studentInfo = await authenticateAndResolveStudent(supabase, {
    authToken,
    clientStudentId: studentId,
    explicitUserId: authenticatedUserId,
  });
  const authenticStudentId = studentInfo.studentId;

  // 2. Verify subject is indeed free (price_inr == 0)
  const { data: subject } = await supabase
    .from("subjects")
    .select("name, price_inr, duration_months")
    .eq("id", subjectId)
    .single();

  if (!subject) {
    throw new Error("Course not found.");
  }

  if (Number(subject.price_inr) > 0) {
    throw new Error("This course is a paid course. Payment is required.");
  }

  // 3. Check duplicate enrollment
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", authenticStudentId)
    .eq("subject_id", subjectId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    throw new Error("Student is already actively enrolled in this course.");
  }

  const durationMonths = subject.duration_months || 6;
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
  const now = new Date().toISOString();

  // 4. Upsert active free enrollment
  const { error } = await supabase.from("enrollments").upsert(
    [
      {
        student_id: authenticStudentId,
        subject_id: subjectId,
        status: "active",
        enrolled_at: now,
        expires_at: expiresAt.toISOString(),
        enrollment_type: "free",
      },
    ],
    { onConflict: "student_id,subject_id" },
  );

  if (error) {
    throw new Error(`Failed to activate free enrollment: ${error.message}`);
  }

  // 5. Send notification to student
  if (studentInfo.userId) {
    await supabase.from("notifications").insert([
      {
        user_id: studentInfo.userId,
        title: "Free Course Enrolled! 🎉",
        message: `You are now enrolled in ${subject.name}. Enjoy learning!`,
        type: "billing",
        read: false,
        related_entity_id: subjectId,
        related_entity_type: "subject",
      },
    ]);
  }

  return {
    success: true,
    message: `Successfully enrolled in free course: ${subject.name}`,
  };
}

/**
 * Server Function: Enroll in Free Course
 */
export const enrollFreeCourseFn = createServerFn({ method: "POST" })
  .validator((data: { subjectId: string; studentId?: string; authToken?: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    const supabase = getServerSupabase();
    const token = await extractAuthToken(data.authToken);
    return enrollFreeCourseInternal(supabase, {
      ...data,
      authToken: token,
    });
  });

export interface WebhookResult {
  status: "success" | "ignored" | "handled_failure";
  event?: string;
  reason?: string;
  paymentId?: string;
  subjectId?: string;
}

/**
 * Core business logic for processing Razorpay Webhooks
 * Verifies HMAC signature, validates event payload, verifies student & subject identity,
 * authoritatively validates price, updates payment status, and idempotently activates enrollments.
 */
export async function handleRazorpayWebhookInternal(
  supabase: SupabaseClient<any, any, any>,
  params: {
    rawBody: string;
    signature: string;
  },
): Promise<WebhookResult> {
  const { rawBody, signature } = params;

  if (!rawBody || !signature) {
    throw new Error("Missing webhook raw body or signature.");
  }

  // 1. Verify HMAC-SHA256 signature using the configured webhook secret
  const isValid = verifyWebhookSignature({ rawBody, signature });
  if (!isValid) {
    throw new Error("Invalid Razorpay webhook signature.");
  }

  // 2. Parse payload safely
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err: any) {
    throw new Error(`Malformed JSON in webhook body: ${err.message}`);
  }

  const event = payload?.event;
  if (!event) {
    return { status: "ignored", reason: "missing_event_type" };
  }

  // 3. Process payment events
  if (event === "payment.captured" || event === "order.paid") {
    const paymentEntity = payload?.payload?.payment?.entity;
    if (!paymentEntity) {
      return { status: "ignored", reason: "missing_payment_entity", event };
    }

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;
    const amountPaise = paymentEntity.amount;

    if (!orderId) {
      return { status: "ignored", reason: "missing_order_id", event };
    }

    // Lookup payment record
    const { data: paymentRecord, error: fetchErr } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_order_id", orderId)
      .maybeSingle();

    if (fetchErr || !paymentRecord) {
      return { status: "ignored", reason: "order_not_found", event };
    }

    // Verify student exists in students table
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("id, user_id")
      .eq("id", paymentRecord.student_id)
      .maybeSingle();

    if (studentErr || !student) {
      throw new Error("Associated student record not found in database.");
    }

    // Authoritative subject and price validation
    const { data: subject, error: subjectErr } = await supabase
      .from("subjects")
      .select("id, name, duration_months, price_inr")
      .eq("id", paymentRecord.subject_id)
      .maybeSingle();

    if (subjectErr || !subject) {
      throw new Error("Associated course/subject not found in database.");
    }

    const basePrice = Number(subject.price_inr) || 0;
    const expectedGst = Math.round(basePrice * 0.18);
    const expectedTotalInr = basePrice + expectedGst;
    const expectedAmountPaise = expectedTotalInr * 100;

    // Verify recorded amount matches authoritative subject price
    if (Number(paymentRecord.amount_inr) !== expectedTotalInr) {
      throw new Error(
        `Payment record amount mismatch: Expected ₹${expectedTotalInr}, recorded ₹${paymentRecord.amount_inr}.`,
      );
    }

    // Verify gateway amount matches expected paise
    if (amountPaise && amountPaise !== expectedAmountPaise) {
      throw new Error(
        `Payment amount mismatch: Expected ${expectedAmountPaise} paise, received ${amountPaise} paise.`,
      );
    }

    // Idempotency: If already marked paid, return success without duplicate processing
    if (paymentRecord.status === "paid") {
      // Ensure enrollment is active
      const { data: existingEnroll } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("student_id", paymentRecord.student_id)
        .eq("subject_id", paymentRecord.subject_id)
        .eq("status", "active")
        .maybeSingle();

      if (!existingEnroll) {
        const durationMonths = subject.duration_months || 6;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
        await supabase.from("enrollments").upsert(
          [
            {
              student_id: paymentRecord.student_id,
              subject_id: paymentRecord.subject_id,
              status: "active",
              enrolled_at: paymentRecord.paid_at || new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              enrollment_type: "paid",
              payment_id: paymentRecord.id,
            },
          ],
          { onConflict: "student_id,subject_id" },
        );
      }

      return {
        status: "ignored",
        reason: "already_paid",
        event,
        paymentId,
        subjectId: paymentRecord.subject_id,
      };
    }

    const now = new Date().toISOString();

    // Atomically transition payment to paid
    const { error: updateErr } = await supabase
      .from("payments")
      .update({
        status: "paid",
        provider_payment_id: paymentId,
        provider_signature: signature,
        paid_at: now,
      })
      .eq("id", paymentRecord.id)
      .eq("status", "pending");

    if (updateErr) {
      throw new Error(`Failed to update payment status: ${updateErr.message}`);
    }

    // Activate enrollment idempotently
    const durationMonths = subject.duration_months || 6;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    const { error: enrollErr } = await supabase.from("enrollments").upsert(
      [
        {
          student_id: paymentRecord.student_id,
          subject_id: paymentRecord.subject_id,
          status: "active",
          enrolled_at: now,
          expires_at: expiresAt.toISOString(),
          enrollment_type: "paid",
          payment_id: paymentRecord.id,
        },
      ],
      { onConflict: "student_id,subject_id" },
    );

    if (enrollErr) {
      throw new Error(`Payment updated but enrollment activation failed: ${enrollErr.message}`);
    }

    // Look up student user_id for notification with deduplication
    if (student.user_id) {
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", student.user_id)
        .eq("related_entity_id", paymentRecord.subject_id)
        .eq("type", "billing")
        .maybeSingle();

      if (!existingNotif) {
        await supabase.from("notifications").insert([
          {
            user_id: student.user_id,
            title: "Payment Received! 🎉",
            message: `Your payment was captured and enrollment in ${subject.name} has been activated.`,
            type: "billing",
            read: false,
            related_entity_id: paymentRecord.subject_id,
            related_entity_type: "subject",
          },
        ]);
      }
    }

    return {
      status: "success",
      event,
      paymentId,
      subjectId: paymentRecord.subject_id,
    };
  }

  if (event === "payment.failed") {
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    if (orderId) {
      // Transition only if still pending
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("provider_order_id", orderId)
        .eq("status", "pending");
    }
    return { status: "handled_failure", event };
  }

  return { status: "ignored", reason: "unhandled_event", event };
}

/**
 * Server Function: Razorpay Webhook Handler
 */
export const handleRazorpayWebhookFn = createServerFn({ method: "POST" })
  .validator((data: { rawBody: string; signature: string }) => data)
  .handler(async ({ data }): Promise<WebhookResult> => {
    const supabase = getServerSupabase();
    return handleRazorpayWebhookInternal(supabase, data);
  });
