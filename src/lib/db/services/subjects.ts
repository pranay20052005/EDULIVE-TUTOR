/**
 * Subject/Course Database Service
 * Handles course/subject-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Subject } from "@/lib/db/types";

export const subjectService = {
  /**
   * Fetch a subject by ID
   */
  async getById(id: string): Promise<Subject | null> {
    const { data, error } = await supabase
      .from("subjects")
      .select("*, teacher:teachers(*, user:users(*))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching subject:", error);
      return null;
    }

    return data;
  },

  /**
   * List all subjects (admin / catalogue management)
   */
  async listAll(filter?: { standard?: string }): Promise<Subject[]> {
    let query = supabase
      .from("subjects")
      .select("*, teacher:teachers(*, user:users(*))")
      .order("created_at", { ascending: false });

    if (filter?.standard) {
      query = query.eq("standard", filter.standard);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error listing all subjects:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List all published subjects
   */
  async listPublished(filter?: { standard?: string; searchText?: string }): Promise<Subject[]> {
    let query = supabase
      .from("subjects")
      .select("*, teacher:teachers(*, user:users(*))")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (filter?.standard) {
      query = query.eq("standard", filter.standard);
    }

    if (filter?.searchText) {
      query = query.ilike("name", `%${filter.searchText}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error listing published subjects:", error);
      return [];
    }

    return data;
  },

  /**
   * List subjects for a specific teacher
   */
  async listByTeacher(teacherId: string): Promise<Subject[]> {
    const { data, error } = await supabase
      .from("subjects")
      .select("*, teacher:teachers(*, user:users(*))")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing teacher subjects:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a new subject
   */
  async create(input: {
    name: string;
    code?: string | undefined;
    standard?: string | undefined;
    teacher_id?: string | undefined;
    description?: string | undefined;
    price_inr?: number | undefined;
    duration_months?: number | undefined;
    color?: string | undefined;
    icon?: string | undefined;
    status?: "draft" | "published" | undefined;
  }): Promise<Subject> {
    const { data, error } = await supabase
      .from("subjects")
      .insert([{ ...input, status: input.status || "draft" }])
      .select("*, teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to create subject: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update subject
   */
  async update(id: string, updates: Partial<Subject>): Promise<Subject> {
    const { data, error } = await supabase
      .from("subjects")
      .update(updates)
      .eq("id", id)
      .select("*, teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update subject: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Publish/draft a subject
   */
  async setStatus(id: string, status: "draft" | "published"): Promise<Subject> {
    return this.update(id, { status });
  },

  /**
   * Get subject enrollments
   */
  async getEnrollments(subjectId: string) {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, student:students(*, user:users(*))")
      .eq("subject_id", subjectId)
      .eq("status", "active");

    if (error) {
      console.error("Error fetching subject enrollments:", error);
      return [];
    }

    return data;
  },

  /**
   * Get subject content (materials, tests, assignments)
   */
  async getContent(subjectId: string) {
    const [materials, tests, assignments, chapters] = await Promise.all([
      supabase
        .from("materials")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .order("material_order"),
      supabase.from("tests").select("*").eq("subject_id", subjectId).eq("status", "published"),
      supabase
        .from("assignments")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("status", "published"),
      supabase.from("chapters").select("*").eq("subject_id", subjectId).order("chapter_order"),
    ]);

    return {
      materials: materials.data || [],
      tests: tests.data || [],
      assignments: assignments.data || [],
      chapters: chapters.data || [],
    };
  },

  /**
   * Check if a subject has dependent student or financial records
   */
  async hasDependentRecords(id: string): Promise<{ hasRecords: boolean; reason?: string }> {
    const [enrollments, payments] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("subject_id", id),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("subject_id", id),
    ]);

    const enrollCount = enrollments.count || 0;
    const payCount = payments.count || 0;

    if (enrollCount > 0 || payCount > 0) {
      const parts: string[] = [];
      if (enrollCount > 0) parts.push(`${enrollCount} student enrollment(s)`);
      if (payCount > 0) parts.push(`${payCount} payment transaction(s)`);
      return {
        hasRecords: true,
        reason: `Cannot delete this subject because it has ${parts.join(" and ")}. You can set its status to Draft/Deactivated instead to preserve student records.`,
      };
    }

    return { hasRecords: false };
  },

  /**
   * Delete a subject (admin only) safely checking for dependencies
   */
  async delete(id: string, force = false): Promise<void> {
    if (!force) {
      const check = await this.hasDependentRecords(id);
      if (check.hasRecords) {
        throw new Error(check.reason);
      }
    }

    const { error } = await supabase.from("subjects").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete subject: ${handleDatabaseError(error)}`);
    }
  },
};
