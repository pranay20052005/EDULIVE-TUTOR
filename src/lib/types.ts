export type Role = "student" | "teacher" | "admin";
export type PublishStatus = "draft" | "published";
export type AttendanceStatus = "present" | "absent" | "late";
export type QuestionType = "mcq" | "truefalse" | "short";
export type ClassScheduleStatus = PublishStatus | "live" | "upcoming" | "completed" | "scheduled";
export type NotificationType = "class" | "content" | "test" | "billing" | "general";

export interface RoleAccount {
  id: string;
  role: Role;
  email: string;
  password: string;
  name: string;
  phone: string;
  board?: string;
  standard?: string;
  dob?: string;
  parentName?: string;
  parentPhone?: string;
  subjectIds?: string[];
}

export interface StudentProfile extends RoleAccount {
  role: "student";
  board: string;
  standard: string;
  dob: string;
  subjectIds: string[];
}

export interface TeacherProfile extends RoleAccount {
  role: "teacher";
  qualification: string;
  experienceYears: number;
  bio: string;
  standards: string[];
  subjectIds: string[];
}

export interface AdminProfile extends RoleAccount {
  role: "admin";
}

export interface Subject {
  id: string;
  name: string;
  standard: string;
  teacherId: string;
  color: string;
  icon: string;
  progress: number;
  priceINR: number;
  durationMonths: number;
  description?: string;
}

export interface SubjectChapterLesson {
  id: string;
  title: string;
  durationMin: number;
  completed?: boolean;
  progress?: number;
}

export interface SubjectChapter {
  id: string;
  subjectId: string;
  title: string;
  durationMin: number;
  order: number;
  index?: number;
  lessons: SubjectChapterLesson[];
}

export interface TeacherNote {
  id: string;
  title: string;
  subjectId: string;
  createdBy: string;
  createdAt: string;
  fileType: "PDF" | "DOC" | "PPT" | "Image" | "Link";
  fileName: string;
  status: PublishStatus;
}

export interface ScheduledClass {
  id: string;
  subjectId: string;
  teacherId: string;
  title: string;
  topic: string;
  chapter?: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingUrl: string;
  status: ClassScheduleStatus;
  createdAt: string;
  createdBy?: string;
  startsAt: string;
  endsAt: string;
  joinLink?: string;
  cancelled?: boolean;
}

export type LiveClass = ScheduledClass;

export interface FacultyAssignment {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  instructions: string;
  fileName?: string;
  createdBy: string;
  createdAt: string;
  dueAt: string;
  maxMarks: number;
  status: PublishStatus;
}

export interface QuestionPaper {
  id: string;
  subjectId: string;
  title: string;
  examType: "Unit test" | "Midterm" | "Final" | "Mock";
  description: string;
  standard: string;
  durationMin: number;
  totalMarks: number;
  availableFrom: string;
  availableUntil: string;
  createdBy: string;
  createdAt: string;
  fileName: string;
  status: PublishStatus;
}

export interface RecordedClass {
  id: string;
  subjectId: string;
  title: string;
  topic: string;
  description: string;
  createdBy: string;
  createdAt: string;
  durationMin: number;
  status: PublishStatus;
  videoUrl?: string;
  url?: string;
}

export interface StudyNote extends TeacherNote {
  chapter: string;
  description: string;
  sizeKB: number;
  uploadedAt?: string;
  type?: string;
  downloadable?: boolean;
}

export interface TestQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string | number;
  marks: number;
}

export interface FacultyTest {
  id: string;
  subjectId: string;
  title: string;
  standard: string;
  description: string;
  instructions: string;
  durationMin: number;
  totalMarks: number;
  passingMarks: number;
  startsAt: string;
  endsAt: string;
  status: PublishStatus;
  questions: TestQuestion[];
  createdAt: string;
  createdBy: string;
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
}

export interface AttendanceSession {
  id: string;
  subjectId: string;
  teacherId: string;
  date: string;
  session: string;
  notes?: string;
  records: AttendanceRecord[];
  savedAt: string;
}

export interface AttendanceSummary {
  percentage: number;
  attended: number;
  missed: number;
  learningHours: number;
  completedLessons: number;
  bySubject: Array<{
    subject: string;
    percentage: number;
    attended: number;
    missed: number;
    total: number;
  }>;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  at: string;
}

export interface Lesson {
  id: string;
  subjectId: string;
  title: string;
  durationMin: number;
  progress: number;
}

export interface ResultEntry {
  id: string;
  subjectId: string;
  title: string;
  score: number;
  total: number;
  date: string;
  takenMin: number;
  correct: number;
  wrong: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  at: string;
  type: NotificationType;
  read: boolean;
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  subjectId: string;
  amountINR: number;
  date: string;
  status: "paid" | "pending" | "failed";
  studentName: string;
  planName: string;
  method: string;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  subjectId: string;
  status: "active" | "pending" | "expired" | "expiring";
  date: string;
  studentName: string;
  planName: string;
  startedAt: string;
  expiresAt: string;
}

export interface Plan {
  id: string;
  name: string;
  priceINR: number;
  description: string;
  features: string[];
  kind: "monthly" | "quarterly" | "annual";
  cycle: string;
  active: boolean;
  includes: string[];
}

export interface RevenuePoint {
  month: string;
  revenue: number;
}

export interface ScoreTrendPoint {
  month: string;
  average?: number;
  score?: number;
}

export interface TestAttempt {
  testId: string;
  score: number;
  total: number;
  correct: number;
  total_questions: number;
  answers: Record<string, string>;
  takenAt: string;
}

export interface ContentState {
  tests: FacultyTest[];
  assignments: FacultyAssignment[];
  schedule: ScheduledClass[];
  liveClasses: ScheduledClass[];
  notes: StudyNote[];
  papers: QuestionPaper[];
  recordings: RecordedClass[];
  attendance: AttendanceSession[];
}

export type ContentCollection = keyof ContentState;
