/**
 * Teachers Database Service
 * Handles teacher profile database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Teacher } from "@/lib/db/types";

export const teacherService = {
  /**
   * Fetch a teacher by ID
   */
  async getById(id: string): Promise<Teacher | null> {
    const { data, error } = await supabase
      .from("teachers")
      .select("*, user:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching teacher:", error);
      return null;
    }

    return data;
  },

  /**
   * Fetch a teacher by user ID
   */
  async getByUserId(userId: string): Promise<Teacher | null> {
    const { data, error } = await supabase
      .from("teachers")
      .select("*, user:users(*)")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching teacher by user ID:", error);
      return null;
    }

    return data;
  },

  /**
   * List all teachers
   */
  async listAll(): Promise<Teacher[]> {
    const { data, error } = await supabase
      .from("teachers")
      .select("*, user:users(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing teachers:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Create a new teacher profile
   */
  async create(input: {
    user_id: string;
    qualification?: string;
    experience_years?: number;
    bio?: string;
  }): Promise<Teacher> {
    const { data, error } = await supabase
      .from("teachers")
      .insert([input])
      .select("*, user:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create teacher: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a teacher profile
   */
  async update(id: string, updates: Partial<Teacher>): Promise<Teacher> {
    const { data, error } = await supabase
      .from("teachers")
      .update(updates)
      .eq("id", id)
      .select("*, user:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update teacher: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Delete a teacher
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("teachers").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete teacher: ${handleDatabaseError(error)}`);
    }
  },
};
