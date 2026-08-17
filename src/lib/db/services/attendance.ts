/**
 * Attendance Database Service
 * Handles attendance-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { Attendance } from "@/lib/db/types";

export const attendanceService = {
  /**
   * Fetch an attendance record by ID
   */
  async getById(id: string): Promise<Attendance | null> {
    const { data, error } = await supabase
      .from("attendance")
      .select("*, student:students(*), subject:subjects(*), teacher:teachers(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching attendance:", error);
      return null;
    }

    return data;
  },

  /**
   * List attendance for a student
   */
  async listByStudent(studentId: string, filter?: { subjectId?: string }): Promise<Attendance[]> {
    let query = supabase
      .from("attendance")
      .select(
        "*, student:students(*, user:users(*)), subject:subjects(*), teacher:teachers(*, user:users(*))",
      )
      .eq("student_id", studentId);

    if (filter?.subjectId) {
      query = query.eq("subject_id", filter.subjectId);
    }

    const { data, error } = await query.order("attendance_date", { ascending: false });

    if (error) {
      console.error("Error listing attendance for student:", error);
      return [];
    }

    return data;
  },

  /**
   * Get attendance summary for a student
   */
  async getSummaryByStudent(
    studentId: string,
    subjectId?: string,
  ): Promise<{
    totalClasses: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    percentage: number;
  } | null> {
    let query = supabase.from("attendance").select("status").eq("student_id", studentId);

    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error getting attendance summary:", error);
      return null;
    }

    const total = data.length;
    if (total === 0) return null;

    const presentCount = data.filter((a) => a.status === "present").length;
    const lateCount = data.filter((a) => a.status === "late").length;
    const absentCount = data.filter((a) => a.status === "absent").length;
    const percentage = Math.round(((presentCount + lateCount * 0.5) / total) * 100);

    return {
      totalClasses: total,
      presentCount,
      absentCount,
      lateCount,
      percentage,
    };
  },

  /**
   * List attendance for a class
   */
  async listBySubject(subjectId: string, teacherId?: string): Promise<Attendance[]> {
    let query = supabase
      .from("attendance")
      .select("*, student:students(*, user:users(*)), subject:subjects(*), teacher:teachers(*)")
      .eq("subject_id", subjectId);

    if (teacherId) {
      query = query.eq("teacher_id", teacherId);
    }

    const { data, error } = await query.order("attendance_date", { ascending: false });

    if (error) {
      console.error("Error listing attendance for subject:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List all attendance for a teacher
   */
  async listByTeacher(teacherId: string): Promise<Attendance[]> {
    const { data, error } = await supabase
      .from("attendance")
      .select("*, student:students(*, user:users(*)), subject:subjects(*), teacher:teachers(*)")
      .eq("teacher_id", teacherId)
      .order("attendance_date", { ascending: false });

    if (error) {
      console.error("Error listing attendance for teacher:", error);
      return [];
    }

    return data || [];
  },

  /**
   * List all attendance records (admin)
   */
  async listAll(): Promise<Attendance[]> {
    const { data, error } = await supabase
      .from("attendance")
      .select("*, student:students(*, user:users(*)), subject:subjects(*), teacher:teachers(*)")
      .order("attendance_date", { ascending: false });

    if (error) {
      console.error("Error listing all attendance records:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Mark attendance for a student
   */
  async markAttendance(input: {
    student_id: string;
    subject_id: string;
    teacher_id: string;
    attendance_date: string;
    status: "present" | "absent" | "late";
    session?: string | undefined;
    notes?: string | undefined;
  }): Promise<Attendance> {
    const { data, error } = await supabase
      .from("attendance")
      .upsert([input], { onConflict: "student_id,subject_id,attendance_date,session" })
      .select("*, student:students(*), subject:subjects(*), teacher:teachers(*)")
      .single();

    if (error) {
      throw new Error(`Failed to mark attendance: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Bulk mark attendance
   */
  async markAttendanceBulk(
    records: Array<{
      student_id: string;
      subject_id: string;
      teacher_id: string;
      attendance_date: string;
      status: "present" | "absent" | "late";
      session?: string;
    }>,
  ): Promise<Attendance[]> {
    const { data, error } = await supabase
      .from("attendance")
      .upsert(records, { onConflict: "student_id,subject_id,attendance_date,session" })
      .select("*, student:students(*), subject:subjects(*), teacher:teachers(*)");

    if (error) {
      throw new Error(`Failed to mark attendance in bulk: ${handleDatabaseError(error)}`);
    }

    return data;
  },
};
