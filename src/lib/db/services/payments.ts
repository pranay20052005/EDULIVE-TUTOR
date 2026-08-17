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
      .select("*, student:students(*), subject:subjects(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching payment:", error);
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

    if (filter?.status) {
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
   * List payments for a student
   */
  async listByStudent(studentId: string, filter?: { status?: string }): Promise<Payment[]> {
    let query = supabase
      .from("payments")
      .select("*, student:students(*), subject:subjects(*)")
      .eq("student_id", studentId);

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing payments for student:", error);
      return [];
    }

    return data;
  },

  /**
   * List payments for a subject
   */
  async listBySubject(subjectId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from("payments")
      .select("*, student:students(*), subject:subjects(*)")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing payments for subject:", error);
      return [];
    }

    return data;
  },

  /**
   * Get payment by transaction ID
   */
  async getByTransactionId(transactionId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from("payments")
      .select("*, student:students(*), subject:subjects(*)")
      .eq("transaction_id", transactionId)
      .single();

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
    amount_inr: number;
    currency?: string;
    payment_method?: "card" | "upi" | "wallet" | "bank_transfer" | "netbanking" | string;
    status?: "pending" | "paid" | "completed" | "failed" | "refunded";
  }): Promise<Payment> {
    const { data, error } = await supabase
      .from("payments")
      .insert([
        {
          ...input,
          currency: input.currency || "INR",
          status: input.status || "paid",
        },
      ])
      .select("*, student:students(*), subject:subjects(*)")
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
    status: "pending" | "paid" | "completed" | "failed" | "refunded",
    transactionId?: string,
  ): Promise<Payment> {
    const updates: any = { status };
    if (transactionId) {
      updates.transaction_id = transactionId;
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
      .select("*, student:students(*), subject:subjects(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update payment status: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Get total revenue by subject
   */
  async getRevenueBySubject(subjectId: string): Promise<number> {
    const { data, error } = await supabase
      .from("payments")
      .select("amount_inr")
      .eq("subject_id", subjectId)
      .eq("status", "completed");

    if (error) {
      console.error("Error calculating revenue by subject:", error);
      return 0;
    }

    return data.reduce((sum, payment) => sum + (payment.amount_inr || 0), 0);
  },
};
