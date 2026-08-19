/**
 * Scheduled Classes (Live Classes) Database Service
 * Handles scheduled classes/live sessions database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { ScheduledClass } from "@/lib/db/types";

export const scheduledClassService = {
  /**
   * Fetch a scheduled class by ID
   */
  async getById(id: string): Promise<ScheduledClass | null> {
    const { data, error } = await supabase
      .from("scheduled_classes")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching scheduled class:", error);
      return null;
    }

    return data;
  },

  /**
   * List all scheduled classes (admin / platform monitor)
   */
  async listAll(filter?: { status?: string }): Promise<ScheduledClass[]> {
    let query = supabase
      .from("scheduled_classes")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))");

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("starts_at", { ascending: true });

    if (error) {
      console.error("Error listing all scheduled classes:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List scheduled classes for a subject
   */
  async listBySubject(subjectId: string, filter?: { status?: string }): Promise<ScheduledClass[]> {
    let query = supabase
      .from("scheduled_classes")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("subject_id", subjectId);

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("starts_at", { ascending: true });

    if (error) {
      console.error("Error listing scheduled classes for subject:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List scheduled classes for multiple subjects
   */
  async listBySubjects(subjectIds: string[]): Promise<ScheduledClass[]> {
    if (!subjectIds.length) return [];

    const { data, error } = await supabase
      .from("scheduled_classes")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .in("subject_id", subjectIds)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("Error listing scheduled classes by subjects:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List scheduled classes for a teacher
   */
  async listByTeacher(teacherId: string, filter?: { status?: string }): Promise<ScheduledClass[]> {
    let query = supabase
      .from("scheduled_classes")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("teacher_id", teacherId);

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("starts_at", { ascending: true });

    if (error) {
      console.error("Error listing scheduled classes for teacher:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List classes for a student's enrolled subjects
   */
  async listForStudent(studentId: string): Promise<ScheduledClass[]> {
    const { data: enrollments, error: enrollError } = await supabase
      .from("enrollments")
      .select("subject_id")
      .eq("student_id", studentId)
      .eq("status", "active");

    if (enrollError || !enrollments || enrollments.length === 0) {
      return [];
    }

    const subjectIds = enrollments.map((e: any) => e.subject_id);
    return this.listBySubjects(subjectIds);
  },

  /**
   * Verify if a student has an active enrollment in a class's subject
   */
  async isStudentEnrolled(studentId: string, classId: string): Promise<boolean> {
    const cls = await this.getById(classId);
    if (!cls) return false;

    const { data, error } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("subject_id", cls.subject_id)
      .eq("status", "active")
      .maybeSingle();

    return !error && !!data;
  },

  /**
   * Create a new scheduled class
   */
  async create(input: {
    subject_id: string;
    teacher_id?: string;
    title: string;
    topic?: string;
    chapter?: string;
    description?: string;
    starts_at: string;
    ends_at: string;
    meeting_url?: string;
    status?: "scheduled" | "live" | "completed" | "draft";
  }): Promise<ScheduledClass> {
    let teacherId = input.teacher_id;
    if (!teacherId) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: tRow } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", authData.user.id)
          .single();
        if (tRow) teacherId = tRow.id;
      }
    }

    const { data, error } = await supabase
      .from("scheduled_classes")
      .insert([{ ...input, teacher_id: teacherId, status: input.status || "scheduled" }])
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to create scheduled class: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a scheduled class
   */
  async update(
    id: string,
    updates: Partial<{
      subject_id: string;
      title: string;
      topic: string;
      chapter: string;
      description: string;
      starts_at: string;
      ends_at: string;
      meeting_url: string;
      cancelled: boolean;
      status: "scheduled" | "live" | "completed" | "draft" | "cancelled" | "published" | "upcoming";
    }>,
  ): Promise<ScheduledClass> {
    const { data, error } = await supabase
      .from("scheduled_classes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update scheduled class: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Start a class (mark live)
   */
  async startClass(id: string): Promise<ScheduledClass> {
    return this.update(id, { status: "live" });
  },

  /**
   * End a class (mark completed)
   */
  async endClass(id: string): Promise<ScheduledClass> {
    return this.update(id, { status: "completed" });
  },

  /**
   * Cancel a class
   */
  async cancelClass(id: string): Promise<ScheduledClass> {
    return this.update(id, { status: "cancelled", cancelled: true });
  },

  /**
   * Update status of a scheduled class
   */
  async updateStatus(
    id: string,
    status: "scheduled" | "live" | "completed" | "draft" | "cancelled" | "published" | "upcoming",
  ): Promise<ScheduledClass> {
    return this.update(id, { status });
  },

  /**
   * Delete a scheduled class
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("scheduled_classes").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete scheduled class: ${handleDatabaseError(error)}`);
    }
  },
};
