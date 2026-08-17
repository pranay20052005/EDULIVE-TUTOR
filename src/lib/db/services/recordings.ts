/**
 * Recordings Database Service
 * Handles recorded class/video-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Recording } from "@/lib/db/types";

export const recordingService = {
  /**
   * Fetch a recording by ID
   */
  async getById(id: string): Promise<Recording | null> {
    const { data, error } = await supabase
      .from("recordings")
      .select("*, subject:subjects(*), creator:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching recording:", error);
      return null;
    }

    return data;
  },

  /**
   * List recordings for a subject
   */
  async listBySubject(subjectId: string, filter?: { published?: boolean }): Promise<Recording[]> {
    let query = supabase
      .from("recordings")
      .select("*, subject:subjects(*), creator:users(*)")
      .eq("subject_id", subjectId);

    if (filter?.published) {
      query = query.eq("status", "published");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing recordings for subject:", error);
      return [];
    }

    return data;
  },

  /**
   * List recordings created by a teacher
   */
  async listByCreator(creatorId: string): Promise<Recording[]> {
    const { data, error } = await supabase
      .from("recordings")
      .select("*, subject:subjects(*), creator:users(*)")
      .eq("created_by", creatorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing recordings by creator:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List recordings for a teacher (alias for creator)
   */
  async listByTeacher(teacherId: string): Promise<Recording[]> {
    const { data, error } = await supabase
      .from("recordings")
      .select("*, subject:subjects(*)")
      .eq("created_by", teacherId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing recordings for teacher:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List all published recordings
   */
  async listPublished(): Promise<Recording[]> {
    const { data, error } = await supabase
      .from("recordings")
      .select("*, subject:subjects(*)")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing published recordings:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Create a new recording
   */
  async create(input: {
    subject_id: string;
    title: string;
    topic?: string;
    description?: string;
    video_url: string;
    duration_min?: number;
    status?: "draft" | "published";
    created_by: string;
  }): Promise<Recording> {
    const { data, error } = await supabase
      .from("recordings")
      .insert([{ ...input, status: input.status || "draft" }])
      .select("*, subject:subjects(*), creator:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create recording: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a recording
   */
  async update(
    id: string,
    updates: Partial<{
      title: string;
      topic: string;
      description: string;
      video_url: string;
      duration_min: number;
      status: "draft" | "published";
    }>,
  ): Promise<Recording> {
    const { data, error } = await supabase
      .from("recordings")
      .update(updates)
      .eq("id", id)
      .select("*, subject:subjects(*), creator:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update recording: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update recording status
   */
  async updateStatus(id: string, status: "draft" | "published"): Promise<Recording> {
    return this.update(id, { status });
  },

  /**
   * Delete a recording
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("recordings").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete recording: ${handleDatabaseError(error)}`);
    }
  },
};
