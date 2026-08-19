/**
 * Server Functions for Payments and Course Access Control
 * Enforces server-side price lookup, anti-tampering, duplicate prevention, and cryptographic verification.
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
 */
export const createPaymentOrderFn = createServerFn({ method: "POST" })
  .validator((data: { subjectId: string; studentId: string }) => data)
  .handler(async ({ data }): Promise<CreateOrderResponse> => {
    const { subjectId, studentId } = data;
    if (!subjectId || !studentId) {
      throw new Error("Missing required parameters: subjectId and studentId are required.");
    }

    const supabase = getServerSupabase();

    // 1. Fetch authentic subject from database
    const { data: subject, error: subjectError } = await supabase
      .from("subjects")
      .select("id, name, price_inr, duration_months, status")
      .eq("id", subjectId)
      .single();

    if (subjectError || !subject) {
      throw new Error("Course not found or inactive.");
    }

    // 2. Check if student is already actively enrolled (Duplicate purchase prevention)
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .maybeSingle();

    if (existingEnrollment) {
      throw new Error("Student is already actively enrolled in this course.");
    }

    const basePrice = Number(subject.price_inr) || 0;

    // 3. Free course handling
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

    // 4. Calculate total with GST (18%) on server
    const gst = Math.round(basePrice * 0.18);
    const totalAmountInr = basePrice + gst;
    const amountInPaise = totalAmountInr * 100;

    // 5. Create Razorpay order on server
    const receipt = `rcpt_${studentId.substring(0, 8)}_${Date.now()}`;
    const rzpOrder = await createRazorpayOrder({
      amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        subject_id: subjectId,
        student_id: studentId,
        subject_name: subject.name,
      },
    });

    // 6. Record pending payment in database
    await supabase.from("payments").insert([
      {
        student_id: studentId,
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
 * Cryptographically verifies Razorpay signature and only then activates enrollment.
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

    // 2. Fetch subject duration
    const { data: subject } = await supabase
      .from("subjects")
      .select("name, duration_months")
      .eq("id", subjectId)
      .single();

    const durationMonths = subject?.duration_months || 6;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // 3. Mark payment as 'paid' / 'completed'
    const now = new Date().toISOString();
    const { data: paymentRecord, error: payError } = await supabase
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

    // 4. Activate enrollment in database
    const { error: enrollError } = await supabase.from("enrollments").upsert(
      [
        {
          student_id: studentId,
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
      console.error("Error activating enrollment:", enrollError);
      throw new Error(`Payment verified but failed to activate enrollment: ${enrollError.message}`);
    }

    // 5. Send notification to student
    const { data: studentUser } = await supabase
      .from("students")
      .select("user_id")
      .eq("id", studentId)
      .single();

    if (studentUser?.user_id) {
      await supabase.from("notifications").insert([
        {
          user_id: studentUser.user_id,
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

    // 1. Verify subject is indeed free (price_inr == 0)
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

    const durationMonths = subject.duration_months || 6;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
    const now = new Date().toISOString();

    // 2. Upsert active free enrollment
    const { error } = await supabase.from("enrollments").upsert(
      [
        {
          student_id: studentId,
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

    return {
      success: true,
      message: `Successfully enrolled in free course: ${subject.name}`,
    };
  });
