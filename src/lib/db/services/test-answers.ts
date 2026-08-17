/**
 * Test Answers Database Service
 * Handles student answers to test questions
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { TestAnswer } from "@/lib/db/types";

export const testAnswerService = {
  /**
   * Fetch a test answer by ID
   */
  async getById(id: string): Promise<TestAnswer | null> {
    const { data, error } = await supabase
      .from("test_answers")
      .select("*, attempt:test_attempts(*), question:test_questions(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching test answer:", error);
      return null;
    }

    return data;
  },

  /**
   * Get answer for a specific attempt and question
   */
  async getAnswerForQuestion(attemptId: string, questionId: string): Promise<TestAnswer | null> {
    const { data, error } = await supabase
      .from("test_answers")
      .select("*, attempt:test_attempts(*), question:test_questions(*)")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .single();

    if (error) {
      console.error("Error fetching test answer for question:", error);
      return null;
    }

    return data;
  },

  /**
   * List answers for a test attempt
   */
  async listByAttempt(attemptId: string): Promise<TestAnswer[]> {
    const { data, error } = await supabase
      .from("test_answers")
      .select("*, attempt:test_attempts(*), question:test_questions(*)")
      .eq("attempt_id", attemptId);

    if (error) {
      console.error("Error listing test answers for attempt:", error);
      return [];
    }

    return data;
  },

  /**
   * Submit an answer to a test question
   */
  async submitAnswer(input: {
    attempt_id: string;
    question_id: string;
    selected_answer?: string | undefined;
    selected_answer_index?: number | undefined;
  }): Promise<TestAnswer> {
    const { data, error } = await supabase
      .from("test_answers")
      .upsert([input], { onConflict: "attempt_id,question_id" })
      .select("*, attempt:test_attempts(*), question:test_questions(*)")
      .single();

    if (error) {
      throw new Error(`Failed to submit test answer: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Grade an answer (calculate correctness and marks)
   */
  async gradeAnswer(
    id: string,
    input: {
      is_correct: boolean;
      marks_awarded: number;
    },
  ): Promise<TestAnswer> {
    const { data, error } = await supabase
      .from("test_answers")
      .update(input)
      .eq("id", id)
      .select("*, attempt:test_attempts(*), question:test_questions(*)")
      .single();

    if (error) {
      throw new Error(`Failed to grade test answer: ${handleDatabaseError(error)}`);
    }

    return data;
  },
};
