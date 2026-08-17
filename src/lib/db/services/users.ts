/**
 * User Database Service
 * Handles user-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { User } from "@/lib/db/types";

export const userService = {
  /**
   * Fetch a user by ID
   */
  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();

    if (error) {
      console.error("Error fetching user:", error);
      return null;
    }

    return data;
  },

  /**
   * Fetch a user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is expected if not found
      console.error("Error fetching user by email:", error);
    }

    return data || null;
  },

  /**
   * Update user profile (non-sensitive fields only)
   */
  async updateProfile(id: string, updates: Partial<{ name: string; phone: string }>) {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * List all users (admin only)
   */
  async listAll(filter?: { role?: string }) {
    let query = supabase.from("users").select("*").is("deleted_at", null);

    if (filter?.role) {
      query = query.eq("role", filter.role);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error listing users:", error);
      return [];
    }

    return data;
  },

  /**
   * Delete a user (soft delete)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from("users")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete user: ${handleDatabaseError(error)}`);
    }
  },
};
