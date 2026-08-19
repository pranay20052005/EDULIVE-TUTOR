/**
 * Payments Database Service
 * Handles payment-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Payment } from "@/lib/db/types";

export const paymentService = {
  /**
   * Fetch a payment by ID
   */
  async getById(id: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from("payments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching payment:", error);
      return null;
    }

    return data;
  },

  /**
   * Fetch payment by Razorpay provider order ID
   */
  async getByOrderId(orderId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from("payments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .eq("provider_order_id", orderId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching payment by order ID:", error);
      return null;
    }

    return data;
  },

  /**
   * List all payments (admin)
   */
  async listAll(filter?: { status?: string }): Promise<Payment[]> {
    let query = supabase
      .from("payments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*)");

    if (filter?.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing all payments:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List payments for a student (Payment history)
   */
  async listByStudent(studentId: string, filter?: { status?: string }): Promise<Payment[]> {
    let query = supabase
      .from("payments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .eq("student_id", studentId);

    if (filter?.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing payments for student:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List payments for a subject
   */
  async listBySubject(subjectId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from("payments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing payments for subject:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Get payment by transaction ID
   */
  async getByTransactionId(transactionId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from("payments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching payment by transaction ID:", error);
      return null;
    }

    return data;
  },

  /**
   * Create a payment record
   */
  async create(input: {
    student_id: string;
    subject_id?: string;
    plan_id?: string;
    amount_inr: number;
    currency?: string;
    provider?: string;
    provider_order_id?: string;
    provider_payment_id?: string;
    provider_signature?: string;
    transaction_id?: string;
    payment_method?: "card" | "upi" | "wallet" | "bank_transfer" | "netbanking" | string;
    status?: "pending" | "paid" | "completed" | "failed" | "refunded" | "cancelled";
  }): Promise<Payment> {
    const { data, error } = await supabase
      .from("payments")
      .insert([
        {
          ...input,
          currency: input.currency || "INR",
          provider: input.provider || "razorpay",
          status: input.status || "pending",
        },
      ])
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    id: string,
    status: "pending" | "paid" | "completed" | "failed" | "refunded" | "cancelled",
    extra?: {
      transactionId?: string;
      providerPaymentId?: string;
      providerSignature?: string;
    },
  ): Promise<Payment> {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (extra?.transactionId) {
      updates.transaction_id = extra.transactionId;
    }
    if (extra?.providerPaymentId) {
      updates.provider_payment_id = extra.providerPaymentId;
    }
    if (extra?.providerSignature) {
      updates.provider_signature = extra.providerSignature;
    }
    if (status === "paid" || status === "completed") {
      updates.paid_at = new Date().toISOString();
    } else if (status === "refunded") {
      updates.refunded_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("payments")
      .update(updates)
      .eq("id", id)
      .select("*, student:students(*, user:users(*)), subject:subjects(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update payment status: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Get Admin Revenue Summary with zero-safe math
   */
  async getAdminRevenueSummary(): Promise<{
    totalRevenue: number;
    pendingAmount: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    refundedCount: number;
  }> {
    const { data: payments, error } = await supabase.from("payments").select("amount_inr, status");

    if (error || !payments) {
      console.error("Error calculating revenue summary:", error);
      return {
        totalRevenue: 0,
        pendingAmount: 0,
        paidCount: 0,
        pendingCount: 0,
        failedCount: 0,
        refundedCount: 0,
      };
    }

    let totalRevenue = 0;
    let pendingAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let refundedCount = 0;

    for (const p of payments) {
      const amt = Number(p.amount_inr) || 0;
      if (p.status === "paid" || p.status === "completed") {
        totalRevenue += amt;
        paidCount++;
      } else if (p.status === "pending") {
        pendingAmount += amt;
        pendingCount++;
      } else if (p.status === "failed" || p.status === "cancelled") {
        failedCount++;
      } else if (p.status === "refunded") {
        refundedCount++;
      }
    }

    return {
      totalRevenue,
      pendingAmount,
      paidCount,
      pendingCount,
      failedCount,
      refundedCount,
    };
  },

  /**
   * Get total revenue by subject
   */
  async getRevenueBySubject(subjectId: string): Promise<number> {
    const { data, error } = await supabase
      .from("payments")
      .select("amount_inr")
      .eq("subject_id", subjectId)
      .in("status", ["paid", "completed"]);

    if (error) {
      console.error("Error calculating revenue by subject:", error);
      return 0;
    }

    return (data || []).reduce((sum, payment) => sum + (Number(payment.amount_inr) || 0), 0);
  },
};
