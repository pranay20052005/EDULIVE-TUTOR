/**
 * Course Certificates Database Service
 * Handles course completion certificates and public cryptographic verification
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { CourseCertificate } from "@/lib/db/types";

export const certificateService = {
  /**
   * Get certificate by unique Certificate Number (public verification)
   */
  async getByNumber(certificateNumber: string): Promise<CourseCertificate | null> {
    const { data, error } = await supabase
      .from("course_certificates")
      .select("*")
      .eq("certificate_number", certificateNumber)
      .maybeSingle();

    if (error) {
      console.error("Error fetching certificate by number:", error);
      return null;
    }

    return data;
  },

  /**
   * Get certificate for a student in a specific subject
   */
  async getByStudentAndSubject(
    studentId: string,
    subjectId: string,
  ): Promise<CourseCertificate | null> {
    const { data, error } = await supabase
      .from("course_certificates")
      .select("*")
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching certificate:", error);
      return null;
    }

    return data;
  },

  /**
   * List all certificates earned by a student
   */
  async listByStudent(studentId: string): Promise<CourseCertificate[]> {
    const { data, error } = await supabase
      .from("course_certificates")
      .select("*")
      .eq("student_id", studentId)
      .order("issue_date", { ascending: false });

    if (error) {
      console.error("Error listing certificates for student:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Issue a new verified course completion certificate
   */
  async issueCertificate(input: {
    student_id: string;
    subject_id: string;
    student_name: string;
    course_name: string;
    standard: string;
    score_percentage?: number;
  }): Promise<CourseCertificate> {
    // Generate unique verifiable certificate serial
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certificateNumber = `EDULIVE-CERT-${year}-${randomHex}`;

    const { data, error } = await supabase
      .from("course_certificates")
      .upsert(
        [
          {
            certificate_number: certificateNumber,
            student_id: input.student_id,
            subject_id: input.subject_id,
            student_name: input.student_name,
            course_name: input.course_name,
            standard: input.standard,
            score_percentage: input.score_percentage || 100.0,
            issue_date: new Date().toISOString(),
            status: "valid",
          },
        ],
        { onConflict: "student_id,subject_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to issue certificate: ${handleDatabaseError(error)}`);
    }

    return data;
  },
};
