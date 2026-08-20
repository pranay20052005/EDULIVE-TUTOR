/**
 * Enrollment Database Service
 * Handles enrollment-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Enrollment } from "@/lib/db/types";

export const enrollmentService = {
  /**
   * Fetch an enrollment by ID
   */
  async getById(id: string): Promise<Enrollment | null> {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*), payment:payments(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching enrollment:", error);
      return null;
    }

    return data;
  },

  /**
   * List all enrollments (admin)
   */
  async listAll(filter?: { status?: string }): Promise<Enrollment[]> {
    let query = supabase
      .from("enrollments")
      .select("*, student:students(*, user:users(*)), subject:subjects(*), payment:payments(*)");

    if (filter?.status && filter.status !== "all") {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing all enrollments:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Check if student is actively enrolled in subject
   */
  async isEnrolled(studentId: string, subjectId: string): Promise<boolean> {
    if (!studentId || !subjectId) return false;

    const { count, error } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .eq("status", "active");

    if ((count === 0 || count === null) && !error) {
      const { data: studentRow } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", studentId)
        .maybeSingle();

      if (studentRow?.id && studentRow.id !== studentId) {
        const retry = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("student_id", studentRow.id)
          .eq("subject_id", subjectId)
          .eq("status", "active");
        return (retry.count ?? 0) > 0;
      }
    }

    if (error) {
      console.error("Error checking enrollment:", error);
      return false;
    }

    return (count ?? 0) > 0;
  },

  /**
   * Get student's enrollments
   */
  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    if (!studentId) return [];

    const { data, error } = await supabase
      .from("enrollments")
      .select("*, subject:subjects(*, teacher:teachers(*, user:users(*)))")
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    // Fallback: If no records found, studentId might be a user_id. Look up matching students.id.
    if ((!data || data.length === 0) && !error) {
      const { data: studentRow } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", studentId)
        .maybeSingle();

      if (studentRow?.id && studentRow.id !== studentId) {
        const retry = await supabase
          .from("enrollments")
          .select("*, subject:subjects(*, teacher:teachers(*, user:users(*)))")
          .eq("student_id", studentRow.id)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        if (retry.data && retry.data.length > 0) {
          return retry.data;
        }
      }
    }

    if (error) {
      console.error("Error fetching student enrollments:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Get subject's enrollments
   */
  async getSubjectEnrollments(subjectId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, student:students(*, user:users(*))")
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subject enrollments:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Create an enrollment
   */
  async create(input: {
    student_id: string;
    subject_id: string;
    status?: "active" | "expired" | "inactive" | "pending";
    expires_at?: string;
    enrollment_type?: "paid" | "free" | "manual_admin" | "subscription" | string;
    payment_id?: string;
  }): Promise<Enrollment> {
    // Check if already enrolled
    const existing = await this.isEnrolled(input.student_id, input.subject_id);

    if (existing) {
      throw new Error("Student is already enrolled in this subject");
    }

    const { data, error } = await supabase
      .from("enrollments")
      .insert([
        {
          ...input,
          status: input.status || "active",
          enrollment_type: input.enrollment_type || "paid",
          enrolled_at: new Date().toISOString(),
        },
      ])
      .select(
        "*, subject:subjects(*, teacher:teachers(*, user:users(*))), student:students(*, user:users(*))",
      )
      .single();

    if (error) {
      throw new Error(`Failed to create enrollment: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Manual enrollment by Admin (audited with enrollment_type = 'manual_admin')
   */
  async adminManualEnroll(input: {
    student_id: string;
    subject_id: string;
    duration_months?: number;
  }): Promise<Enrollment> {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (input.duration_months || 6));

    const { data, error } = await supabase
      .from("enrollments")
      .upsert(
        [
          {
            student_id: input.student_id,
            subject_id: input.subject_id,
            status: "active",
            enrolled_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            enrollment_type: "manual_admin",
          },
        ],
        { onConflict: "student_id,subject_id" },
      )
      .select("*, subject:subjects(*), student:students(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to manually enroll student: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update enrollment
   */
  async update(id: string, updates: Partial<Enrollment>): Promise<Enrollment> {
    const { data, error } = await supabase
      .from("enrollments")
      .update(updates)
      .eq("id", id)
      .select(
        "*, subject:subjects(*, teacher:teachers(*, user:users(*))), student:students(*, user:users(*))",
      )
      .single();

    if (error) {
      throw new Error(`Failed to update enrollment: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Deactivate an enrollment
   */
  async deactivate(id: string): Promise<Enrollment> {
    return this.update(id, { status: "inactive" as any });
  },

  /**
   * Delete an enrollment
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("enrollments").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete enrollment: ${handleDatabaseError(error)}`);
    }
  },

  /**
   * Get enrollment count for a subject
   */
  async getEnrollmentCount(subjectId: string): Promise<number> {
    const { count, error } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subjectId)
      .eq("status", "active");

    if (error) {
      console.error("Error getting enrollment count:", error);
      return 0;
    }

    return count ?? 0;
  },

  /**
   * Bulk enroll students in a subject (admin/teacher)
   */
  async bulkEnroll(studentIds: string[], subjectId: string): Promise<Enrollment[]> {
    const enrollments = studentIds.map((studentId) => ({
      student_id: studentId,
      subject_id: subjectId,
      status: "active" as const,
      enrollment_type: "manual_admin",
      enrolled_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("enrollments")
      .insert(enrollments)
      .select("*, subject:subjects(*), student:students(*)");

    if (error) {
      throw new Error(`Failed to bulk enroll students: ${handleDatabaseError(error)}`);
    }

    return data || [];
  },
};
