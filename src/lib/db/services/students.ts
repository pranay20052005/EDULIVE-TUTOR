/**
 * Student Database Service
 * Handles student-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Student } from "@/lib/db/types";

export const studentService = {
  /**
   * Fetch a student by ID
   */
  async getById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from("students")
      .select("*, user:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching student:", error);
      return null;
    }

    return data;
  },

  /**
   * Fetch student by user ID
   */
  async getByUserId(userId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from("students")
      .select("*, user:users(*)")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching student by user ID:", error);
      return null;
    }

    return data;
  },

  /**
   * Create a new student profile
   */
  async create(input: {
    user_id: string;
    board?: string;
    standard?: string;
    dob?: string;
    parent_name?: string;
    parent_phone?: string;
  }) {
    const { data, error } = await supabase.from("students").insert([input]).select().single();

    if (error) {
      throw new Error(`Failed to create student: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update student profile
   */
  async update(id: string, updates: Partial<Student>) {
    const { data, error } = await supabase
      .from("students")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update student: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * List all students (admin/teacher only)
   */
  async listAll(filter?: { standard?: string; board?: string }) {
    let query = supabase.from("students").select("*, user:users(*)");

    if (filter?.standard) {
      query = query.eq("standard", filter.standard);
    }

    if (filter?.board) {
      query = query.eq("board", filter.board);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error listing students:", error);
      return [];
    }

    return data;
  },

  /**
   * Get student's enrollments
   */
  async getEnrollments(studentId: string) {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*, subject:subjects(*, teacher:teachers(*, user:users(*)))")
      .eq("student_id", studentId)
      .eq("status", "active");

    if (error) {
      console.error("Error fetching student enrollments:", error);
      return [];
    }

    return data;
  },

  /**
   * Check if student is enrolled in a subject
   */
  async isEnrolledInSubject(studentId: string, subjectId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .eq("status", "active");

    if (error) {
      console.error("Error checking enrollment:", error);
      return false;
    }

    return (count ?? 0) > 0;
  },
};
