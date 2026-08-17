/**
 * Chapter Database Service
 * Handles chapter-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Chapter } from "@/lib/db/types";

export const chapterService = {
  /**
   * Fetch a chapter by ID
   */
  async getById(id: string): Promise<Chapter | null> {
    const { data, error } = await supabase
      .from("chapters")
      .select("*, subject:subjects(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching chapter:", error);
      return null;
    }

    return data;
  },

  /**
   * List chapters for a subject
   */
  async listBySubject(subjectId: string): Promise<Chapter[]> {
    const { data, error } = await supabase
      .from("chapters")
      .select("*, subject:subjects(*)")
      .eq("subject_id", subjectId)
      .order("chapter_order", { ascending: true });

    if (error) {
      console.error("Error listing chapters for subject:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a new chapter
   */
  async create(input: {
    subject_id: string;
    title: string;
    description?: string;
    duration_min?: number;
    chapter_order: number;
  }): Promise<Chapter> {
    const { data, error } = await supabase
      .from("chapters")
      .insert([input])
      .select("*, subject:subjects(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create chapter: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a chapter
   */
  async update(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      duration_min: number;
      chapter_order: number;
    }>,
  ): Promise<Chapter> {
    const { data, error } = await supabase
      .from("chapters")
      .update(updates)
      .eq("id", id)
      .select("*, subject:subjects(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update chapter: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Delete a chapter
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("chapters").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete chapter: ${handleDatabaseError(error)}`);
    }
  },
};
