/**
 * Assignment Submissions Database Service
 * Handles student assignment submissions
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { AssignmentSubmission } from "@/lib/db/types";

export const assignmentSubmissionService = {
  /**
   * Fetch an assignment submission by ID
   */
  async getById(id: string): Promise<AssignmentSubmission | null> {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select("*, assignment:assignments(*), student:students(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching assignment submission:", error);
      return null;
    }

    return data;
  },

  /**
   * Get a student's submission for an assignment
   */
  async getStudentSubmission(
    assignmentId: string,
    studentId: string,
  ): Promise<AssignmentSubmission | null> {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select("*, assignment:assignments(*), student:students(*)")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId)
      .single();

    if (error) {
      console.error("Error fetching student assignment submission:", error);
      return null;
    }

    return data;
  },

  /**
   * List submissions for a student
   */
  async listByStudent(studentId: string): Promise<AssignmentSubmission[]> {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select("*, assignment:assignments(*), student:students(*)")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error listing submissions for student:", error);
      return [];
    }

    return data;
  },

  /**
   * List submissions for an assignment
   */
  async listByAssignment(assignmentId: string): Promise<AssignmentSubmission[]> {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .select("*, assignment:assignments(*), student:students(*)")
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error listing submissions for assignment:", error);
      return [];
    }

    return data;
  },

  /**
   * Submit an assignment
   */
  async submitAssignment(input: {
    assignment_id: string;
    student_id: string;
    submission_text?: string | undefined;
    submission_url?: string | undefined;
  }): Promise<AssignmentSubmission> {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .upsert([input], { onConflict: "assignment_id,student_id" })
      .select("*, assignment:assignments(*), student:students(*)")
      .single();

    if (error) {
      throw new Error(`Failed to submit assignment: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Grade a submission
   */
  async gradeSubmission(
    id: string,
    input: {
      marks_awarded: number;
      feedback?: string;
    },
  ): Promise<AssignmentSubmission> {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .update({
        ...input,
        evaluated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, assignment:assignments(*), student:students(*)")
      .single();

    if (error) {
      throw new Error(`Failed to grade assignment submission: ${handleDatabaseError(error)}`);
    }

    return data;
  },
};
