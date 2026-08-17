/**
 * Materials Database Service
 * Handles study notes/materials-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Material } from "@/lib/db/types";

export const materialService = {
  /**
   * Fetch a material by ID
   */
  async getById(id: string): Promise<Material | null> {
    const { data, error } = await supabase
      .from("materials")
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching material:", error);
      return null;
    }

    return data;
  },

  /**
   * List materials for a subject
   */
  async listBySubject(subjectId: string, filter?: { published?: boolean }): Promise<Material[]> {
    let query = supabase
      .from("materials")
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
      .eq("subject_id", subjectId)
      .order("material_order", { ascending: true });

    if (filter?.published) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error listing materials for subject:", error);
      return [];
    }

    return data;
  },

  /**
   * List materials for a chapter
   */
  async listByChapter(chapterId: string, filter?: { published?: boolean }): Promise<Material[]> {
    let query = supabase
      .from("materials")
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
      .eq("chapter_id", chapterId)
      .order("material_order", { ascending: true });

    if (filter?.published) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error listing materials for chapter:", error);
      return [];
    }

    return data;
  },

  /**
   * List materials created by a teacher
   */
  async listByTeacher(teacherId: string): Promise<Material[]> {
    const { data, error } = await supabase
      .from("materials")
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
      .eq("created_by", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing materials for teacher:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Create a new material
   */
  async create(input: {
    subject_id: string;
    chapter_id?: string;
    title: string;
    description?: string;
    file_type: string;
    file_url: string;
    file_size_kb?: number;
    status?: "draft" | "published";
    material_order: number;
    created_by: string;
  }): Promise<Material> {
    const { data, error } = await supabase
      .from("materials")
      .insert([{ ...input, status: input.status || "draft" }])
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create material: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a material
   */
  async update(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      file_url: string;
      file_type: string;
      file_size_kb: number;
      material_order: number;
      status: "draft" | "published";
    }>,
  ): Promise<Material> {
    const { data, error } = await supabase
      .from("materials")
      .update(updates)
      .eq("id", id)
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update material: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update material status
   */
  async updateStatus(id: string, status: "draft" | "published"): Promise<Material> {
    return this.update(id, { status });
  },

  /**
   * Delete a material
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("materials").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete material: ${handleDatabaseError(error)}`);
    }
  },
};
