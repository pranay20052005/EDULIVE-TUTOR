/**
 * Server Functions for Payments and Course Access Control
 * Enforces server-side price lookup, anti-tampering, duplicate prevention, cryptographic verification,
 * and authentic student identity resolution for PostgreSQL foreign key constraints.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createRazorpayOrder, verifyRazorpaySignature, getRazorpayConfig } from "./razorpay";

function getServerSupabase() {
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
 * Robust server-side student identity resolution
 * Resolves the genuine public.students.id from any valid student identifier (students.id, users.id, or auth.users.id).
 * Guarantees that enrollments.student_id foreign key constraint is satisfied without fake IDs.
 */
export async function resolveStudentIdentity(
  supabase: ReturnType<typeof getServerSupabase>,
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
    const res: ResolvedStudent = {
      studentId: byStudentId.id,
      userId: byStudentId.user_id,
      userEmail: (byStudentId.user as any)?.email || "",
      userName: (byStudentId.user as any)?.name || "Student",
    };
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Payment Identity Resolved via students.id]:`, {
        authUserId: res.userId,
        userId: res.userId,
        studentId: res.studentId,
      });
    }
    return res;
  }

  // 2. Try finding by students.user_id (in case public.users.id or auth.users.id was passed)
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
    const res: ResolvedStudent = {
      studentId: byUserId.id,
      userId: byUserId.user_id,
      userEmail: (byUserId.user as any)?.email || "",
      userName: (byUserId.user as any)?.name || "Student",
    };
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Payment Identity Resolved via students.user_id]:`, {
        authUserId: res.userId,
        userId: res.userId,
        studentId: res.studentId,
      });
    }
    return res;
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

    // Auto-heal / create the legitimate students row for this student user
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
      // If it already existed due to a race condition, try one more fetch
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

    const res: ResolvedStudent = {
      studentId: createdStudent.id,
      userId: userRec.id,
      userEmail: userRec.email,
      userName: userRec.name,
    };
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Payment Identity Created & Resolved for student user]:`, {
        authUserId: res.userId,
        userId: res.userId,
        studentId: res.studentId,
      });
    }
    return res;
  }

  // 4. Try finding in Supabase Auth by auth.users.id
  const { data: authUser } = await supabase.auth.admin.getUserById(identifier);
  if (authUser?.user) {
    const meta = authUser.user.user_metadata || {};
    const role = (meta.role as string) || "student";
    if (role !== "student") {
      throw new Error(`Accounts with role "${role}" cannot enroll in courses.`);
    }

    // Ensure users row exists
    await supabase.from("users").upsert(
      {
        id: authUser.user.id,
        email: (authUser.user.email || "").toLowerCase(),
        role: "student",
        name: meta.name || authUser.user.email?.split("@")[0] || "Student",
        phone: meta.phone || "",
      },
      { onConflict: "id" },
    );

    // Ensure students row exists
    let { data: finalStudent } = await supabase
      .from("students")
      .select("id, user_id")
      .eq("user_id", authUser.user.id)
      .maybeSingle();

    if (!finalStudent) {
      const { data: insertedStudent } = await supabase
        .from("students")
        .insert({
          user_id: authUser.user.id,
          board: meta.board || "",
          standard: meta.standard || "",
        })
        .select("id, user_id")
        .single();
      finalStudent = insertedStudent;
    }

    if (finalStudent) {
      const res: ResolvedStudent = {
        studentId: finalStudent.id,
        userId: authUser.user.id,
        userEmail: authUser.user.email || "",
        userName: meta.name || "Student",
      };
      if (process.env.NODE_ENV !== "production") {
        console.log(`[Payment Identity Resolved via auth.users.id]:`, {
          authUserId: res.userId,
          userId: res.userId,
          studentId: res.studentId,
        });
      }
      return res;
    }
  }

  throw new Error("Student profile not found. Please log in with a valid student account.");
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
 * Server Function: Create Payment Order
 * Queries the authentic price from the database, preventing any client-side amount tampering.
 * Resolves the genuine student ID server-side before persisting pending payment.
 */
export const createPaymentOrderFn = createServerFn({ method: "POST" })
  .validator((data: { subjectId: string; studentId: string }) => data)
  .handler(async ({ data }): Promise<CreateOrderResponse> => {
    const { subjectId, studentId } = data;
    if (!subjectId || !studentId) {
      throw new Error("Missing required parameters: subjectId and studentId are required.");
    }

    const supabase = getServerSupabase();

    // 1. Resolve authentic student identity server-side
    const studentInfo = await resolveStudentIdentity(supabase, studentId);
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
    await supabase.from("payments").insert([
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
  });

export interface VerifyPaymentResponse {
  success: boolean;
  paymentId: string;
  subjectId: string;
  enrolled: boolean;
  message: string;
}

/**
 * Server Function: Verify Payment & Activate Enrollment
 * Cryptographically verifies Razorpay signature, resolves authentic student ID,
 * and activates enrollment while maintaining payment atomicity.
 */
export const verifyPaymentFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      orderId: string;
      paymentId: string;
      signature: string;
      subjectId: string;
      studentId: string;
      paymentMethod?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<VerifyPaymentResponse> => {
    const { orderId, paymentId, signature, subjectId, studentId, paymentMethod } = data;
    const supabase = getServerSupabase();

    // 1. Verify Razorpay cryptographic signature
    const isValidSignature = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
    });

    if (!isValidSignature) {
      // Record failed payment
      await supabase
        .from("payments")
        .update({
          status: "failed",
          provider_payment_id: paymentId,
          provider_signature: signature,
        })
        .eq("provider_order_id", orderId);

      throw new Error("Payment signature verification failed. Enrollment was not activated.");
    }

    // 2. Resolve authentic student identity server-side
    const studentInfo = await resolveStudentIdentity(supabase, studentId);
    const authenticStudentId = studentInfo.studentId;

    // 3. Fetch subject duration & price
    const { data: subject } = await supabase
      .from("subjects")
      .select("name, duration_months, price_inr")
      .eq("id", subjectId)
      .single();

    const durationMonths = subject?.duration_months || 6;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // 4. Mark payment as 'paid' / 'completed'
    const now = new Date().toISOString();
    let { data: paymentRecord } = await supabase
      .from("payments")
      .update({
        status: "paid",
        provider_payment_id: paymentId,
        provider_signature: signature,
        payment_method: paymentMethod || "upi",
        paid_at: now,
      })
      .eq("provider_order_id", orderId)
      .select()
      .maybeSingle();

    if (!paymentRecord) {
      const basePrice = Number(subject?.price_inr) || 0;
      const gst = Math.round(basePrice * 0.18);
      const totalAmountInr = basePrice + gst;

      const { data: insertedPayment } = await supabase
        .from("payments")
        .insert([
          {
            student_id: authenticStudentId,
            subject_id: subjectId,
            amount_inr: totalAmountInr,
            currency: "INR",
            provider: "razorpay",
            provider_order_id: orderId,
            provider_payment_id: paymentId,
            provider_signature: signature,
            status: "paid",
            payment_method: paymentMethod || "upi",
            paid_at: now,
          },
        ])
        .select()
        .maybeSingle();

      paymentRecord = insertedPayment;
    }

    // 5. Activate enrollment in database using authentic student_id
    const { error: enrollError } = await supabase.from("enrollments").upsert(
      [
        {
          student_id: authenticStudentId,
          subject_id: subjectId,
          status: "active",
          enrolled_at: now,
          expires_at: expiresAt.toISOString(),
          enrollment_type: "paid",
          payment_id: paymentRecord?.id,
        },
      ],
      { onConflict: "student_id,subject_id" },
    );

    if (enrollError) {
      console.error("Error activating enrollment:", enrollError, {
        authenticStudentId,
        subjectId,
        paymentId: paymentRecord?.id,
      });
      throw new Error(
        `Payment verified (${paymentId}) but failed to activate enrollment: ${enrollError.message}. Payment details have been preserved for reconciliation.`,
      );
    }

    // 6. Send notification to student
    if (studentInfo.userId) {
      await supabase.from("notifications").insert([
        {
          user_id: studentInfo.userId,
          title: "Enrollment Activated! 🎉",
          message: `Your enrollment in ${subject?.name || "the course"} is now active. You have full access to live classes, recordings, and notes.`,
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
      message: `Successfully enrolled in ${subject?.name || "course"}`,
    };
  });

/**
 * Server Function: Enroll in Free Course
 */
export const enrollFreeCourseFn = createServerFn({ method: "POST" })
  .validator((data: { subjectId: string; studentId: string }) => data)
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    const { subjectId, studentId } = data;
    const supabase = getServerSupabase();

    // 1. Resolve authentic student identity server-side
    const studentInfo = await resolveStudentIdentity(supabase, studentId);
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
  });
