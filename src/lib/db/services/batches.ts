/**
 * Batches Database Service
 * Handles cohort / batch management for subjects and students
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Batch, BatchStudent } from "@/lib/db/types";

export const batchService = {
  /**
   * Fetch all batches (admin)
   */
  async listAll(filter?: { subjectId?: string; standard?: string }): Promise<Batch[]> {
    let query = supabase
      .from("batches")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))");

    if (filter?.subjectId) {
      query = query.eq("subject_id", filter.subjectId);
    }
    if (filter?.standard) {
      query = query.eq("standard", filter.standard);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing batches:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Fetch batches for a subject
   */
  async listBySubject(subjectId: string): Promise<Batch[]> {
    const { data, error } = await supabase
      .from("batches")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("subject_id", subjectId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching batches for subject:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Fetch batches assigned to a teacher
   */
  async listByTeacher(teacherId: string): Promise<Batch[]> {
    const { data, error } = await supabase
      .from("batches")
      .select("*, subject:subjects(*)")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching batches for teacher:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Get single batch by ID with student associations
   */
  async getById(id: string): Promise<Batch | null> {
    const { data, error } = await supabase
      .from("batches")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching batch by ID:", error);
      return null;
    }

    return data;
  },

  /**
   * Create a new batch
   */
  async create(input: {
    subject_id: string;
    name: string;
    standard: string;
    timing?: string;
    capacity?: number;
    teacher_id?: string;
  }): Promise<Batch> {
    const { data, error } = await supabase
      .from("batches")
      .insert([
        {
          ...input,
          capacity: input.capacity || 50,
          status: "active",
        },
      ])
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to create batch: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update batch details
   */
  async update(id: string, updates: Partial<Batch>): Promise<Batch> {
    const { data, error } = await supabase
      .from("batches")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update batch: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Delete batch
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("batches").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete batch: ${handleDatabaseError(error)}`);
    }
  },

  /**
   * Get students assigned to a batch
   */
  async getBatchStudents(batchId: string): Promise<BatchStudent[]> {
    const { data, error } = await supabase
      .from("batch_students")
      .select("*, student:students(*, user:users(*))")
      .eq("batch_id", batchId);

    if (error) {
      console.error("Error fetching batch students:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Assign a student to a batch
   */
  async assignStudent(batchId: string, studentId: string): Promise<BatchStudent> {
    const { data, error } = await supabase
      .from("batch_students")
      .upsert([{ batch_id: batchId, student_id: studentId }], {
        onConflict: "batch_id,student_id",
      })
      .select("*, student:students(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to assign student to batch: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Remove a student from a batch
   */
  async removeStudent(batchId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from("batch_students")
      .delete()
      .eq("batch_id", batchId)
      .eq("student_id", studentId);

    if (error) {
      throw new Error(`Failed to remove student from batch: ${handleDatabaseError(error)}`);
    }
  },
};
