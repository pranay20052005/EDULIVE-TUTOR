/**
 * Recording Watch Progress Database Service
 * Handles persistence and retrieval of student recording progress
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { StudentRecordingProgress } from "@/lib/db/types";

export const recordingProgressService = {
  /**
   * Get progress for a specific student and recording
   */
  async getProgress(
    studentId: string,
    recordingId: string,
  ): Promise<StudentRecordingProgress | null> {
    const { data, error } = await supabase
      .from("student_recording_progress")
      .select("*, recording:recordings(*)")
      .eq("student_id", studentId)
      .eq("recording_id", recordingId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching recording progress:", error);
      return null;
    }

    return data;
  },

  /**
   * List all progress records for a student
   */
  async listForStudent(studentId: string): Promise<StudentRecordingProgress[]> {
    const { data, error } = await supabase
      .from("student_recording_progress")
      .select("*, recording:recordings(*)")
      .eq("student_id", studentId);

    if (error) {
      console.error("Error listing recording progress for student:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Upsert watch progress
   */
  async saveProgress(input: {
    student_id: string;
    recording_id: string;
    progress_percent: number;
    watched_seconds: number;
    completed?: boolean;
  }): Promise<StudentRecordingProgress> {
    const { data, error } = await supabase
      .from("student_recording_progress")
      .upsert(
        {
          student_id: input.student_id,
          recording_id: input.recording_id,
          progress_percent: Math.min(100, Math.max(0, Math.round(input.progress_percent))),
          watched_seconds: Math.max(0, Math.round(input.watched_seconds)),
          completed: input.completed ?? input.progress_percent >= 90,
          last_watched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,recording_id" },
      )
      .select("*, recording:recordings(*)")
      .single();

    if (error) {
      throw new Error(`Failed to save recording progress: ${handleDatabaseError(error)}`);
    }

    return data;
  },
};
