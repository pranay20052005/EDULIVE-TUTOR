-- ============================================================
-- EduLive Complete Database Schema
-- Phase 1: Foundation
-- ============================================================

-- ============================================================
-- Enable Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS publish_status CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS question_type CASCADE;
DROP TYPE IF EXISTS class_schedule_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS test_attempt_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS enrollment_status CASCADE;

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE publish_status AS ENUM ('draft', 'published');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
CREATE TYPE question_type AS ENUM ('mcq', 'truefalse', 'short');
CREATE TYPE class_schedule_status AS ENUM ('draft', 'published', 'live', 'upcoming', 'completed', 'scheduled');
CREATE TYPE notification_type AS ENUM ('class', 'content', 'test', 'billing', 'general');
CREATE TYPE test_attempt_status AS ENUM ('in_progress', 'submitted', 'graded');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'failed');
CREATE TYPE enrollment_status AS ENUM ('active', 'pending', 'expired', 'expiring');

-- ============================================================
-- DROP EXISTING TABLES (for idempotent re-runs)
-- ============================================================
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS question_papers CASCADE;
DROP TABLE IF EXISTS recordings CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS scheduled_classes CASCADE;
DROP TABLE IF EXISTS assignment_submissions CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS test_answers CASCADE;
DROP TABLE IF EXISTS test_attempts CASCADE;
DROP TABLE IF EXISTS test_questions CASCADE;
DROP TABLE IF EXISTS tests CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS TABLE (Base for all roles)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  CONSTRAINT email_lowercase CHECK (email = LOWER(email))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================
-- STUDENTS TABLE
-- ============================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  board VARCHAR(50) NOT NULL,
  standard VARCHAR(20) NOT NULL,
  dob DATE,
  parent_name VARCHAR(255),
  parent_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_standard ON students(standard);
CREATE INDEX idx_students_board ON students(board);

-- ============================================================
-- TEACHERS TABLE
-- ============================================================
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  qualification VARCHAR(255),
  experience_years INTEGER DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_teachers_user_id ON teachers(user_id);

-- ============================================================
-- ADMINS TABLE
-- ============================================================
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_admins_user_id ON admins(user_id);

-- ============================================================
-- SUBJECTS/COURSES TABLE
-- ============================================================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  standard VARCHAR(20) NOT NULL,
  teacher_id UUID NOT NULL,
  description TEXT,
  price_inr DECIMAL(10, 2) DEFAULT 0,
  duration_months INTEGER DEFAULT 6,
  color VARCHAR(50) DEFAULT 'chart-1',
  icon VARCHAR(50) DEFAULT 'BookOpen',
  status publish_status DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX idx_subjects_teacher_id ON subjects(teacher_id);
CREATE INDEX idx_subjects_standard ON subjects(standard);
CREATE INDEX idx_subjects_status ON subjects(status);
CREATE INDEX idx_subjects_created_at ON subjects(created_at);

-- ============================================================
-- ENROLLMENTS TABLE
-- ============================================================
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status enrollment_status DEFAULT 'active',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_id)
);

CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_subject_id ON enrollments(subject_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);

-- ============================================================
-- CHAPTERS TABLE
-- ============================================================
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_min INTEGER DEFAULT 0,
  chapter_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE INDEX idx_chapters_subject_id ON chapters(subject_id);
CREATE INDEX idx_chapters_order ON chapters(chapter_order);

-- ============================================================
-- MATERIALS/STUDY NOTES TABLE
-- ============================================================
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  chapter_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_type VARCHAR(50), -- PDF, DOC, PPT, Image, Link
  file_url VARCHAR(1000),
  file_size_kb INTEGER,
  status publish_status DEFAULT 'draft',
  material_order INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_materials_subject_id ON materials(subject_id);
CREATE INDEX idx_materials_chapter_id ON materials(chapter_id);
CREATE INDEX idx_materials_created_by ON materials(created_by);
CREATE INDEX idx_materials_status ON materials(status);

-- ============================================================
-- TESTS/FACULTY TESTS TABLE
-- ============================================================
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  standard VARCHAR(20),
  description TEXT,
  instructions TEXT,
  duration_min INTEGER NOT NULL,
  total_marks INTEGER NOT NULL,
  passing_marks INTEGER,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status publish_status DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX idx_tests_subject_id ON tests(subject_id);
CREATE INDEX idx_tests_teacher_id ON tests(teacher_id);
CREATE INDEX idx_tests_status ON tests(status);
CREATE INDEX idx_tests_starts_at ON tests(starts_at);
CREATE INDEX idx_tests_ends_at ON tests(ends_at);

-- ============================================================
-- TEST QUESTIONS TABLE
-- ============================================================
CREATE TABLE test_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL,
  type question_type NOT NULL,
  text TEXT NOT NULL,
  options JSONB, -- Array of options for MCQ/TrueFalse
  correct_answer TEXT, -- For short answer
  correct_answer_index INTEGER, -- For MCQ/TrueFalse
  marks INTEGER DEFAULT 5,
  difficulty VARCHAR(50), -- easy, medium, hard
  question_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX idx_test_questions_order ON test_questions(question_order);

-- ============================================================
-- TEST ATTEMPTS TABLE
-- ============================================================
CREATE TABLE test_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL,
  student_id UUID NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  score INTEGER,
  total_marks INTEGER,
  status test_attempt_status DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_attempts_test_id ON test_attempts(test_id);
CREATE INDEX idx_test_attempts_student_id ON test_attempts(student_id);
CREATE INDEX idx_test_attempts_status ON test_attempts(status);
CREATE INDEX idx_test_attempts_started_at ON test_attempts(started_at);

-- ============================================================
-- TEST ANSWERS TABLE
-- ============================================================
CREATE TABLE test_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_answer TEXT,
  selected_answer_index INTEGER,
  is_correct BOOLEAN,
  marks_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES test_questions(id) ON DELETE CASCADE,
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_test_answers_attempt_id ON test_answers(attempt_id);
CREATE INDEX idx_test_answers_question_id ON test_answers(question_id);

-- ============================================================
-- ASSIGNMENTS TABLE
-- ============================================================
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  file_url VARCHAR(1000),
  file_name VARCHAR(255),
  due_at TIMESTAMP NOT NULL,
  max_marks INTEGER DEFAULT 0,
  status publish_status DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX idx_assignments_subject_id ON assignments(subject_id);
CREATE INDEX idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX idx_assignments_due_at ON assignments(due_at);
CREATE INDEX idx_assignments_status ON assignments(status);

-- ============================================================
-- ASSIGNMENT SUBMISSIONS TABLE
-- ============================================================
CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submission_url VARCHAR(1000),
  submission_text TEXT,
  marks_awarded INTEGER,
  feedback TEXT,
  evaluated_at TIMESTAMP,
  evaluated_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX idx_assignment_submissions_submitted_at ON assignment_submissions(submitted_at);

-- ============================================================
-- LIVE CLASSES / SCHEDULED CLASSES TABLE
-- ============================================================
CREATE TABLE scheduled_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(255),
  chapter VARCHAR(255),
  description TEXT,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  meeting_url VARCHAR(1000),
  join_link VARCHAR(1000),
  status class_schedule_status DEFAULT 'scheduled',
  cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX idx_scheduled_classes_subject_id ON scheduled_classes(subject_id);
CREATE INDEX idx_scheduled_classes_teacher_id ON scheduled_classes(teacher_id);
CREATE INDEX idx_scheduled_classes_status ON scheduled_classes(status);
CREATE INDEX idx_scheduled_classes_starts_at ON scheduled_classes(starts_at);
CREATE INDEX idx_scheduled_classes_ends_at ON scheduled_classes(ends_at);

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  session VARCHAR(100), -- Morning, Afternoon, Evening
  status attendance_status DEFAULT 'present',
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_id, attendance_date, session)
);

CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_subject_id ON attendance(subject_id);
CREATE INDEX idx_attendance_teacher_id ON attendance(teacher_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- ============================================================
-- RECORDINGS / RECORDED CLASSES TABLE
-- ============================================================
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  topic VARCHAR(255),
  description TEXT,
  video_url VARCHAR(1000),
  duration_min INTEGER DEFAULT 0,
  status publish_status DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_recordings_subject_id ON recordings(subject_id);
CREATE INDEX idx_recordings_created_by ON recordings(created_by);
CREATE INDEX idx_recordings_status ON recordings(status);

-- ============================================================
-- QUESTION PAPERS TABLE
-- ============================================================
CREATE TABLE question_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  exam_type VARCHAR(50), -- Unit test, Midterm, Final, Mock
  description TEXT,
  standard VARCHAR(20),
  duration_min INTEGER,
  total_marks INTEGER,
  available_from TIMESTAMP,
  available_until TIMESTAMP,
  file_url VARCHAR(1000),
  file_name VARCHAR(255),
  status publish_status DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE INDEX idx_question_papers_subject_id ON question_papers(subject_id);
CREATE INDEX idx_question_papers_teacher_id ON question_papers(teacher_id);
CREATE INDEX idx_question_papers_status ON question_papers(status);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type notification_type DEFAULT 'general',
  read BOOLEAN DEFAULT FALSE,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  amount_inr DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status payment_status DEFAULT 'pending',
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255) UNIQUE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_subject_id ON payments(subject_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);

-- ============================================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================================
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_inr DECIMAL(10, 2) NOT NULL,
  features JSONB, -- Array of features
  duration_days INTEGER,
  plan_kind VARCHAR(50), -- monthly, quarterly, annual
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(name)
);

CREATE INDEX idx_subscription_plans_active ON subscription_plans(active);

-- ============================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL,
  target_audience VARCHAR(50), -- all, students, teachers, admin
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_announcements_created_by ON announcements(created_by);
CREATE INDEX idx_announcements_published ON announcements(published);
CREATE INDEX idx_announcements_created_at ON announcements(created_at);

-- ============================================================
-- SETTINGS TABLE
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settings_key ON settings(setting_key);
