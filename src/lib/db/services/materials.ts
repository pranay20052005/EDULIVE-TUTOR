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
   * Upload study note / material file to Supabase Storage
   */
  async uploadFile(
    file: File,
    userId?: string,
  ): Promise<{ url: string; path: string; name: string; sizeKB: number; fileType: string }> {
    let uid = userId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData?.user?.id || "faculty";
    }
    const rawExt = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `teacher/${uid}/notes/${Date.now()}_${sanitizedName}`;

    let fileType = "PDF";
    if (["doc", "docx"].includes(rawExt)) fileType = "DOC";
    else if (["ppt", "pptx"].includes(rawExt)) fileType = "PPT";
    else if (["xls", "xlsx"].includes(rawExt)) fileType = "XLS";
    else if (["png", "jpg", "jpeg", "webp", "gif"].includes(rawExt)) fileType = "Image";
    else if (["txt"].includes(rawExt)) fileType = "TXT";

    const { error: uploadError } = await supabase.storage.from("materials").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      throw new Error(`Failed to upload note file: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("materials").getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      path: filePath,
      name: file.name,
      sizeKB: Math.round(file.size / 1024) || 1,
      fileType,
    };
  },

  /**
   * List materials created by a teacher or belonging to assigned subjects
   */
  async listByTeacher(teacherUserId?: string, subjectIds?: string[]): Promise<Material[]> {
    let uid = teacherUserId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData?.user?.id;
    }

    let query = supabase
      .from("materials")
      .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)");

    if (uid && subjectIds && subjectIds.length > 0) {
      query = query.or(`created_by.eq.${uid},subject_id.in.(${subjectIds.join(",")})`);
    } else if (uid) {
      query = query.eq("created_by", uid);
    } else if (subjectIds && subjectIds.length > 0) {
      query = query.in("subject_id", subjectIds);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

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
    material_order?: number;
    created_by?: string;
  }): Promise<Material> {
    let createdBy = input.created_by;
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      createdBy = authData.user.id;
    }

    const { data, error } = await supabase
      .from("materials")
      .insert([
        {
          ...input,
          created_by: createdBy,
          material_order: input.material_order ?? 1,
          status: input.status || "draft",
        },
      ])
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
