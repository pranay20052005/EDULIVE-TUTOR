/**
 * Recordings Database Service
 * Handles recorded class/video-related database operations and storage
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

    return data || [];
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
   * List recordings for a teacher
   */
  async listByTeacher(teacherIdOrUserId?: string, subjectIds?: string[]): Promise<Recording[]> {
    let uid = teacherIdOrUserId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData?.user?.id;
    }

    let query = supabase.from("recordings").select("*, subject:subjects(*), creator:users(*)");

    if (uid && subjectIds && subjectIds.length > 0) {
      query = query.or(`created_by.eq.${uid},subject_id.in.(${subjectIds.join(",")})`);
    } else if (uid) {
      query = query.eq("created_by", uid);
    } else if (subjectIds && subjectIds.length > 0) {
      query = query.in("subject_id", subjectIds);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

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
   * List published recordings for specified subject IDs
   */
  async listPublishedBySubjects(subjectIds: string[]): Promise<Recording[]> {
    if (!subjectIds.length) return [];

    const { data, error } = await supabase
      .from("recordings")
      .select("*, subject:subjects(*)")
      .eq("status", "published")
      .in("subject_id", subjectIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing published recordings by subjects:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Upload recording video file to Supabase Storage
   */
  async uploadVideoFile(file: File, userId?: string): Promise<{ url: string; path: string }> {
    let uid = userId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData?.user?.id || "faculty";
    }
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `teacher/${uid}/recordings/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload video: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("recordings").getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      path: filePath,
    };
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
    created_by?: string;
  }): Promise<Recording> {
    let createdBy = input.created_by;
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      createdBy = authData.user.id;
    }

    const { data, error } = await supabase
      .from("recordings")
      .insert([{ ...input, created_by: createdBy, status: input.status || "draft" }])
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
      subject_id: string;
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
      .update({ ...updates, updated_at: new Date().toISOString() })
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
