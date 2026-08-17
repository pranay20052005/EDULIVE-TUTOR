/**
 * Test Database Service
 * Handles test/quiz-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { FacultyTest, TestAttempt, TestQuestion } from "@/lib/db/types";

export const testService = {
  /**
   * Fetch a test by ID
   */
  async getById(id: string): Promise<FacultyTest | null> {
    const { data, error } = await supabase
      .from("tests")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching test:", error);
      return null;
    }

    return data;
  },

  /**
   * Fetch test with all questions
   */
  async getWithQuestions(
    testId: string,
  ): Promise<(FacultyTest & { questions: TestQuestion[] }) | null> {
    const test = await this.getById(testId);
    if (!test) return null;

    const { data: questions, error } = await supabase
      .from("test_questions")
      .select("*")
      .eq("test_id", testId)
      .order("question_order");

    if (error) {
      console.error("Error fetching test questions:", error);
      return { ...test, questions: [] };
    }

    return { ...test, questions: questions || [] };
  },

  /**
   * List tests for a subject
   */
  async listBySubject(
    subjectId: string,
    filter?: { status?: "draft" | "published" },
  ): Promise<FacultyTest[]> {
    let query = supabase
      .from("tests")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("subject_id", subjectId);

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error listing tests:", error);
      return [];
    }

    return data;
  },

  /**
   * List tests for a teacher
   */
  async listByTeacher(
    teacherId: string,
    filter?: { status?: "draft" | "published" },
  ): Promise<FacultyTest[]> {
    let query = supabase
      .from("tests")
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .eq("teacher_id", teacherId);

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error listing teacher tests:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a new test
   */
  async create(input: {
    subject_id: string;
    teacher_id: string;
    title: string;
    standard?: string;
    description?: string;
    instructions?: string;
    duration_min: number;
    total_marks: number;
    passing_marks: number;
    starts_at?: string;
    ends_at?: string;
    status?: "draft" | "published";
  }): Promise<FacultyTest> {
    const { data, error } = await supabase
      .from("tests")
      .insert([{ ...input, status: input.status || "draft" }])
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to create test: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update test
   */
  async update(id: string, updates: Partial<FacultyTest>): Promise<FacultyTest> {
    const { data, error } = await supabase
      .from("tests")
      .update(updates)
      .eq("id", id)
      .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
      .single();

    if (error) {
      throw new Error(`Failed to update test: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Publish/draft a test
   */
  async setStatus(id: string, status: "draft" | "published"): Promise<FacultyTest> {
    return this.update(id, { status });
  },

  /**
   * Update status alias
   */
  async updateStatus(id: string, status: "draft" | "published"): Promise<FacultyTest> {
    return this.update(id, { status });
  },

  /**
   * Get student's attempt at a test
   */
  async getStudentAttempt(testId: string, studentId: string): Promise<TestAttempt | null> {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*")
      .eq("test_id", testId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching test attempt:", error);
    }

    return data || null;
  },

  /**
   * Get all attempts for a test (teacher/admin)
   */
  async getAttempts(testId: string) {
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, student:students(*, user:users(*))")
      .eq("test_id", testId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching test attempts:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a test attempt
   */
  async createAttempt(input: {
    test_id: string;
    student_id: string;
    status?: "in-progress" | "submitted" | "graded";
  }): Promise<TestAttempt> {
    const { data, error } = await supabase
      .from("test_attempts")
      .insert([{ ...input, started_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test attempt: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Submit a test attempt
   */
  async submitAttempt(
    attemptId: string,
    marksObtained: number,
    totalMarks: number,
  ): Promise<TestAttempt> {
    const percentage = (marksObtained / totalMarks) * 100;

    const { data, error } = await supabase
      .from("test_attempts")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        marks_obtained: marksObtained,
        percentage,
      })
      .eq("id", attemptId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit test attempt: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Create a question for a test
   */
  async createQuestion(input: {
    test_id: string;
    type: string;
    text: string;
    options?: string[];
    correct_answer_index?: number;
    marks?: number;
    difficulty?: "easy" | "medium" | "hard";
    question_order?: number;
  }): Promise<TestQuestion> {
    const { data, error } = await supabase
      .from("test_questions")
      .insert([
        {
          ...input,
          marks: input.marks || 1,
          question_order: input.question_order || 1,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create question: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Delete a test (admin only)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("tests").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete test: ${handleDatabaseError(error)}`);
    }
  },
};
