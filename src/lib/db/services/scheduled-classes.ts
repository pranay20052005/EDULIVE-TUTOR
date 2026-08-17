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

    return data;
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

    return data;
  },

  /**
   * List upcoming/live classes for a student's enrolled subjects
   */
  async listUpcomingForStudent(studentId: string): Promise<ScheduledClass[]> {
    const { data, error } = await supabase.rpc("get_student_upcoming_classes", {
      student_id_param: studentId,
    });

    if (error) {
      console.error("Error listing upcoming classes for student:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Create a new scheduled class
   */
  async create(input: {
    subject_id: string;
    teacher_id: string;
    title: string;
    topic?: string;
    chapter?: string;
    description?: string;
    starts_at: string;
    ends_at: string;
    meeting_url?: string;
    status?: "scheduled" | "live" | "completed" | "draft";
  }): Promise<ScheduledClass> {
    const { data, error } = await supabase
      .from("scheduled_classes")
      .insert([{ ...input, status: input.status || "scheduled" }])
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
      status: "scheduled" | "live" | "completed" | "draft" | "cancelled" | "published" | "upcoming";
    }>,
  ): Promise<ScheduledClass> {
    const { data, error } = await supabase
      .from("scheduled_classes")
      .update(updates)
      .eq("id", id)
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update scheduled class: ${handleDatabaseError(error)}`);
    }

    return data;
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
