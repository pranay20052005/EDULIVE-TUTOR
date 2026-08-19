/**
 * Assignments Database Service
 * Handles assignment-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { FacultyAssignment } from "@/lib/db/types";

export const assignmentService = {
  /**
   * Fetch an assignment by ID
   */
  async getById(id: string): Promise<FacultyAssignment | null> {
    const { data, error } = await supabase
      .from("assignments")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching assignment:", error);
      return null;
    }

    return data;
  },

  /**
   * List assignments for a subject
   */
  async listBySubject(
    subjectId: string,
    filter?: { published?: boolean },
  ): Promise<FacultyAssignment[]> {
    let query = supabase
      .from("assignments")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("subject_id", subjectId)
      .order("due_at", { ascending: true });

    if (filter?.published) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error listing assignments for subject:", error);
      return [];
    }

    return data;
  },

  /**
   * List assignments for a teacher
   */
  async listByTeacher(teacherId: string): Promise<FacultyAssignment[]> {
    const { data, error } = await supabase
      .from("assignments")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing assignments for teacher:", error);
      return [];
    }

    return data;
  },

  /**
   * Upload assignment attachment to Supabase Storage
   */
  async uploadAttachment(
    file: File,
    userId?: string,
  ): Promise<{ url: string; path: string; name: string; sizeKB: number }> {
    let uid = userId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData?.user?.id || "faculty";
    }
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `teacher/${uid}/assignments/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from("assignments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload assignment attachment: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("assignments").getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      path: filePath,
      name: file.name,
      sizeKB: Math.round(file.size / 1024) || 1,
    };
  },

  /**
   * Create a new assignment
   */
  async create(input: {
    subject_id: string;
    teacher_id?: string;
    title: string;
    description?: string;
    instructions?: string;
    file_url?: string;
    file_name?: string;
    due_at: string;
    max_marks?: number;
    status?: "draft" | "published";
  }): Promise<FacultyAssignment> {
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
      .from("assignments")
      .insert([{ ...input, teacher_id: teacherId, status: input.status || "draft" }])
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to create assignment: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update an assignment
   */
  async update(
    id: string,
    updates: Partial<{
      subject_id: string;
      title: string;
      description: string;
      instructions: string;
      file_url: string;
      file_name: string;
      due_at: string;
      max_marks: number;
      status: "draft" | "published";
    }>,
  ): Promise<FacultyAssignment> {
    const { data, error } = await supabase
      .from("assignments")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update assignment: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update status of an assignment
   */
  async updateStatus(id: string, status: "draft" | "published"): Promise<FacultyAssignment> {
    return this.update(id, { status });
  },

  /**
   * Delete an assignment
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("assignments").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete assignment: ${handleDatabaseError(error)}`);
    }
  },
};
