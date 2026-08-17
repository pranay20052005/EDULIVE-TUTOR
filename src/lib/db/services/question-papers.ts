/**
 * Question Papers Database Service
 * Handles question paper-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { QuestionPaper } from "@/lib/db/types";

export const questionPaperService = {
  /**
   * Fetch a question paper by ID
   */
  async getById(id: string): Promise<QuestionPaper | null> {
    const { data, error } = await supabase
      .from("question_papers")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching question paper:", error);
      return null;
    }

    return data;
  },

  /**
   * List question papers for a subject
   */
  async listBySubject(
    subjectId: string,
    filter?: { published?: boolean },
  ): Promise<QuestionPaper[]> {
    let query = supabase
      .from("question_papers")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("subject_id", subjectId);

    if (filter?.published) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing question papers for subject:", error);
      return [];
    }

    return data;
  },

  /**
   * List question papers by teacher
   */
  async listByTeacher(teacherId: string): Promise<QuestionPaper[]> {
    const { data, error } = await supabase
      .from("question_papers")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing question papers by teacher:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a new question paper
   */
  async create(input: {
    subject_id: string;
    teacher_id: string;
    title: string;
    exam_type?: string | undefined;
    description?: string | undefined;
    standard?: string | undefined;
    duration_min?: number | undefined;
    total_marks: number;
    available_from?: string | undefined;
    available_until?: string | undefined;
    file_url?: string | undefined;
    file_name?: string | undefined;
    status?: "draft" | "published";
  }): Promise<QuestionPaper> {
    const { data, error } = await supabase
      .from("question_papers")
      .insert([{ ...input, status: input.status || "draft" }])
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to create question paper: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a question paper
   */
  async update(
    id: string,
    updates: Partial<{
      title: string;
      exam_type: string | undefined;
      description: string | undefined;
      duration_min: number;
      total_marks: number;
      available_from: string | undefined;
      available_until: string | undefined;
      file_url: string;
      status: "draft" | "published";
    }>,
  ): Promise<QuestionPaper> {
    const { data, error } = await supabase
      .from("question_papers")
      .update(updates)
      .eq("id", id)
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update question paper: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update question paper status
   */
  async updateStatus(id: string, status: "draft" | "published"): Promise<QuestionPaper> {
    return this.update(id, { status });
  },

  /**
   * Delete a question paper
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("question_papers").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete question paper: ${handleDatabaseError(error)}`);
    }
  },
};
