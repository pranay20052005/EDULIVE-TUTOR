/**
 * Announcements Database Service
 * Handles announcement-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Announcement } from "@/lib/db/types";

export const announcementService = {
  /**
   * Fetch an announcement by ID
   */
  async getById(id: string): Promise<Announcement | null> {
    const { data, error } = await supabase
      .from("announcements")
      .select("*, creator:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching announcement:", error);
      return null;
    }

    return data;
  },

  /**
   * List published announcements
   */
  async listPublished(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from("announcements")
      .select("*, creator:users(*)")
      .eq("published", true)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error listing published announcements:", error);
      return [];
    }

    return data;
  },

  /**
   * List announcements by target audience
   */
  async listByTargetAudience(
    targetAudience: "all" | "students" | "teachers" | "admin",
  ): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from("announcements")
      .select("*, creator:users(*)")
      .eq("published", true)
      .in("target_audience", [targetAudience, "all"])
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error listing announcements by target audience:", error);
      return [];
    }

    return data;
  },

  /**
   * List announcements by creator
   */
  async listByCreator(creatorId: string): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from("announcements")
      .select("*, creator:users(*)")
      .eq("created_by", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing announcements by creator:", error);
      return [];
    }

    return data;
  },

  /**
   * Create an announcement
   */
  async create(input: {
    title: string;
    body: string;
    created_by: string;
    target_audience?: "all" | "students" | "teachers" | "admin";
    published?: boolean;
  }): Promise<Announcement> {
    const { data, error } = await supabase
      .from("announcements")
      .insert([
        {
          ...input,
          target_audience: input.target_audience || "all",
          published: input.published || false,
          published_at: input.published ? new Date().toISOString() : null,
        },
      ])
      .select("*, creator:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create announcement: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update an announcement
   */
  async update(
    id: string,
    updates: Partial<{
      title: string;
      body: string;
      target_audience: "all" | "students" | "teachers" | "admin";
      published: boolean;
    }>,
  ): Promise<Announcement> {
    const updatePayload: any = { ...updates };
    if (updates.published && !updatePayload.published_at) {
      updatePayload.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("announcements")
      .update(updatePayload)
      .eq("id", id)
      .select("*, creator:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update announcement: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Delete an announcement
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("announcements").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete announcement: ${handleDatabaseError(error)}`);
    }
  },
};
