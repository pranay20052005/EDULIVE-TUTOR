/**
 * Supabase Database Types
 * Auto-generated types for database schema
 * Generated from schema defined in migrations
 */

export type Role = "student" | "teacher" | "admin";
export type QuestionType = "mcq" | "short" | "truefalse";
export type PublishStatus = "draft" | "published";
export type EnrollmentStatus = "active" | "expired" | "inactive";
export type AttendanceStatus = "present" | "absent" | "late";
export type ClassScheduleStatus =
  "draft" | "published" | "live" | "upcoming" | "completed" | "scheduled" | "cancelled";
export type NotificationType = "class" | "content" | "test" | "billing" | "general";
export type MaterialFileType = "PDF" | "Video" | "Image" | "Document" | "Link";
export type PlanKind = "monthly" | "quarterly" | "annual";

/**
 * Core User entity
 */
export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone?: string;
  profile_picture_url?: string;
  verified: boolean;
  verified_at?: string;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

/**
 * Student profile extending User
 */
export interface Student {
  id: string;
  user_id: string;
  board?: string;
  standard?: string;
  dob?: string;
  parent_name?: string;
  parent_phone?: string;
  user?: User;
  created_at: string;
  updated_at?: string;
}

/**
 * Teacher profile extending User
 */
export interface Teacher {
  id: string;
  user_id: string;
  qualification?: string;
  experience_years?: number;
  bio?: string;
  user?: User;
  created_at: string;
  updated_at?: string;
}

/**
 * Admin profile extending User
 */
export interface Admin {
  id: string;
  user_id: string;
  user?: User;
  created_at: string;
  updated_at?: string;
}

/**
 * Subject/Course
 */
export interface Subject {
  id: string;
  name: string;
  code?: string;
  standard?: string;
  teacher_id?: string;
  description?: string;
  price_inr: number;
  duration_months?: number;
  color?: string;
  icon?: string;
  status: PublishStatus;
  teacher?: Teacher;
  created_at: string;
  updated_at?: string;
}

/**
 * Enrollment record linking Student to Subject
 */
export interface Enrollment {
  id: string;
  student_id: string;
  subject_id: string;
  enrolled_at: string;
  status: EnrollmentStatus;
  expires_at?: string;
  student?: Student;
  subject?: Subject;
  created_at: string;
  updated_at?: string;
}

/**
 * Chapter within a Subject
 */
export interface Chapter {
  id: string;
  subject_id: string;
  title: string;
  description?: string;
  duration_min?: number;
  chapter_order: number;
  subject?: Subject;
  created_at: string;
  updated_at?: string;
}

/**
 * Test/Quiz entity
 */
export interface FacultyTest {
  id: string;
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
  status: PublishStatus;
  subject?: Subject;
  teacher?: Teacher;
  created_at: string;
  updated_at?: string;
}

/**
 * Test question
 */
export interface TestQuestion {
  id: string;
  test_id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // JSON array stringified as JSONB
  correct_answer_index?: number;
  marks: number;
  difficulty?: "easy" | "medium" | "hard";
  question_order: number;
  test?: FacultyTest;
  created_at: string;
  updated_at?: string;
}

/**
 * Student's test attempt
 */
export interface TestAttempt {
  id: string;
  test_id: string;
  student_id: string;
  status: "in-progress" | "submitted" | "graded";
  marks_obtained?: number;
  percentage?: number;
  started_at: string;
  submitted_at?: string;
  graded_at?: string;
  student?: Student;
  test?: FacultyTest;
  created_at: string;
  updated_at?: string;
}

/**
 * Student's answer to a test question
 */
export interface TestAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  student_answer?: string;
  is_correct?: boolean;
  marks_obtained?: number;
  time_taken_sec?: number;
  attempt?: TestAttempt;
  question?: TestQuestion;
  created_at: string;
  updated_at?: string;
}

/**
 * Assignment
 */
export interface FacultyAssignment {
  id: string;
  subject_id: string;
  teacher_id: string;
  title: string;
  description?: string;
  instructions?: string;
  file_url?: string;
  file_name?: string;
  due_at: string;
  max_marks: number;
  status: PublishStatus;
  subject?: Subject;
  teacher?: Teacher;
  created_at: string;
  updated_at?: string;
}

export type Assignment = FacultyAssignment;

/**
 * Assignment submission
 */
export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text?: string;
  file_url?: string;
  status?: string;
  submitted_at: string;
  marks?: number;
  feedback?: string;
  graded_at?: string;
  assignment?: FacultyAssignment;
  student?: Student;
  created_at: string;
  updated_at?: string;
}

/**
 * Scheduled/Live class
 */
export interface ScheduledClass {
  id: string;
  subject_id: string;
  teacher_id: string;
  title: string;
  topic?: string;
  chapter?: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  meeting_url?: string;
  status: ClassScheduleStatus;
  subject?: Subject;
  teacher?: Teacher;
  created_at: string;
  updated_at?: string;
}

export type LiveClass = ScheduledClass;

/**
 * Attendance record
 */
export interface Attendance {
  id: string;
  student_id: string;
  teacher_id: string;
  class_id?: string;
  subject_id: string;
  status: AttendanceStatus;
  marked_at: string;
  student?: Student;
  teacher?: Teacher;
  subject?: Subject;
  created_at: string;
  updated_at?: string;
}

/**
 * Recorded class/lecture
 */
export interface Recording {
  id: string;
  subject_id: string;
  title: string;
  topic?: string;
  description?: string;
  video_url: string;
  duration_min?: number;
  status: PublishStatus;
  created_by: string;
  subject?: Subject;
  created_at: string;
  updated_at?: string;
}

/**
 * Student's watch progress on a recorded class
 */
export interface StudentRecordingProgress {
  id: string;
  student_id: string;
  recording_id: string;
  progress_percent: number;
  watched_seconds: number;
  completed: boolean;
  last_watched_at: string;
  recording?: Recording;
  created_at: string;
  updated_at?: string;
}

/**
 * Course material (PDF, video, notes, etc.)
 */
export interface Material {
  id: string;
  subject_id: string;
  chapter_id?: string;
  title: string;
  description?: string;
  file_type: MaterialFileType;
  file_url: string;
  file_size_kb?: number;
  status: PublishStatus;
  material_order: number;
  created_by: string;
  chapter?: Chapter;
  subject?: Subject;
  created_at: string;
  updated_at?: string;
}

/**
 * Question paper
 */
export interface QuestionPaper {
  id: string;
  subject_id: string;
  teacher_id: string;
  title: string;
  exam_type?: string;
  description?: string;
  standard?: string;
  duration_min?: number;
  total_marks: number;
  available_from?: string;
  available_until?: string;
  file_url?: string;
  file_name?: string;
  file_path?: string;
  status: PublishStatus;
  subject?: Subject;
  teacher?: Teacher;
  created_at: string;
  updated_at?: string;
}

/**
 * Notification
 */
export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  body?: string;
  at?: string;
  related_entity_id?: string;
  related_entity_type?: string;
  read: boolean;
  read_at?: string;
  user?: User;
  created_at: string;
  updated_at?: string;
}

/**
 * Payment record
 */
export interface Payment {
  id: string;
  student_id: string;
  subject_id?: string;
  amount_inr: number;
  currency: string;
  payment_method: "card" | "upi" | "wallet" | "bank_transfer" | "netbanking" | string;
  payment_id?: string; // External payment ID from gateway
  status: "pending" | "paid" | "completed" | "failed" | "refunded";
  paid_at?: string;
  refunded_at?: string;
  student?: Student;
  subject?: Subject;
  created_at: string;
  updated_at?: string;
}

/**
 * Subscription plan
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price_inr: number;
  features?: string[]; // JSON array as JSONB
  duration_days?: number;
  plan_kind?: PlanKind;
  active?: boolean;
  is_active?: boolean;
  billing_cycle?: string;
  standard?: string;
  cycle?: string;
  kind?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Announcement
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_by: string;
  target_audience: "all" | "students" | "teachers" | "admins";
  published: boolean;
  published_at?: string;
  creator?: User;
  created_at: string;
  updated_at?: string;
}

/**
 * System settings
 */
export interface Setting {
  id: string;
  key: string;
  value: string;
  setting_type: "string" | "number" | "boolean" | "json";
  description?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
}
