/**
 * Test Attempts Database Service
 * Handles student test attempts
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { TestAttempt } from "@/lib/db/types";

export const testAttemptService = {
  /**
   * Fetch a test attempt by ID
   */
  async getById(id: string): Promise<TestAttempt | null> {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, student:students(*), test:tests(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching test attempt:", error);
      return null;
    }

    return data;
  },

  /**
   * Get a student's attempt for a test
   */
  async getStudentAttempt(testId: string, studentId: string): Promise<TestAttempt | null> {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, student:students(*), test:tests(*)")
      .eq("test_id", testId)
      .eq("student_id", studentId)
      .single();

    if (error) {
      console.error("Error fetching student test attempt:", error);
      return null;
    }

    return data;
  },

  /**
   * List test attempts for a student
   */
  async listByStudent(studentId: string): Promise<TestAttempt[]> {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, student:students(*), test:tests(*)")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error listing test attempts for student:", error);
      return [];
    }

    return data;
  },

  /**
   * List test attempts for a test
   */
  async listByTest(testId: string): Promise<TestAttempt[]> {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, student:students(*), test:tests(*)")
      .eq("test_id", testId)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error listing test attempts for test:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a new test attempt
   */
  async create(input: { test_id: string; student_id: string }): Promise<TestAttempt> {
    const { data, error } = await supabase
      .from("test_attempts")
      .insert([input])
      .select("*, student:students(*), test:tests(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create test attempt: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Alias for create
   */
  async createAttempt(input: { test_id: string; student_id: string }): Promise<TestAttempt> {
    return this.create(input);
  },

  /**
   * Submit a test attempt
   */
  async submitAttempt(
    id: string,
    marks_obtained?: number,
    percentage?: number,
  ): Promise<TestAttempt> {
    const updates: Record<string, any> = {
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };
    if (marks_obtained !== undefined) updates["marks_obtained"] = marks_obtained;
    if (percentage !== undefined) updates["percentage"] = percentage;

    const { data, error } = await supabase
      .from("test_attempts")
      .update(updates)
      .eq("id", id)
      .select("*, student:students(*), test:tests(*)")
      .single();

    if (error) {
      throw new Error(`Failed to submit test attempt: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Grade a test attempt
   */
  async gradeAttempt(
    id: string,
    input: {
      marks_obtained: number;
      percentage: number;
    },
  ): Promise<TestAttempt> {
    const { data, error } = await supabase
      .from("test_attempts")
      .update({
        status: "graded",
        ...input,
      })
      .eq("id", id)
      .select("*, student:students(*), test:tests(*)")
      .single();

    if (error) {
      throw new Error(`Failed to grade test attempt: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * List all test attempts (admin)
   */
  async listAll(): Promise<TestAttempt[]> {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, student:students(*, user:users(*)), test:tests(*)")
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Error listing all test attempts:", error);
      return [];
    }

    return data || [];
  },
};
