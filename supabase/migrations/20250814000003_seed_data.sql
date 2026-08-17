-- ============================================================
-- EduLive Development Seed Data
-- Phase 1: Foundation - DEVELOPMENT ONLY
-- ============================================================

-- WARNING: This seed data is for DEVELOPMENT ONLY
-- Never use in production with real credentials

-- ============================================================
-- SEED USERS
-- ============================================================

INSERT INTO users (id, email, password_hash, role, name, phone, created_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'student@edulive.app', crypt('demo1234', gen_salt('bf')), 'student', 'Aarav Sharma', '+91 98765 43210', NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'ananya@edulive.app', crypt('demo1234', gen_salt('bf')), 'student', 'Ananya Singh', '+91 91234 98765', NOW()),
  ('550e8400-e29b-41d4-a716-446655440011', 'teacher@edulive.app', crypt('demo1234', gen_salt('bf')), 'teacher', 'Neha Kapoor', '+91 98765 12345', NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', 'rohit@edulive.app', crypt('demo1234', gen_salt('bf')), 'teacher', 'Rohit Mehta', '+91 98111 22222', NOW()),
  ('550e8400-e29b-41d4-a716-446655440021', 'admin@edulive.app', crypt('demo1234', gen_salt('bf')), 'admin', 'Ishita Nair', '+91 98989 00000', NOW())
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SEED STUDENTS
-- ============================================================

INSERT INTO students (id, user_id, board, standard, dob, parent_name, parent_phone, created_at)
VALUES 
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'CBSE', '10th', '2009-05-15'::DATE, 'Raj Sharma', '+91 98123 45678', NOW()),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'CBSE', '10th', '2010-01-12'::DATE, 'Saurabh Singh', '+91 98200 20000', NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- SEED TEACHERS
-- ============================================================

INSERT INTO teachers (id, user_id, qualification, experience_years, bio, created_at)
VALUES 
  ('750e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440011', 'M.Sc. Mathematics, B.Ed.', 8, 'Specializes in building confidence in foundational and board-level mathematics.', NOW()),
  ('750e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440012', 'M.Sc. Chemistry, M.Phil.', 10, 'Helps students connect concepts to practical applications and exam techniques.', NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- SEED ADMINS
-- ============================================================

INSERT INTO admins (id, user_id, created_at)
VALUES 
  ('850e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440021', NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- SEED SUBJECTS/COURSES
-- ============================================================

INSERT INTO subjects (id, name, code, standard, teacher_id, description, price_inr, duration_months, color, icon, status, created_at)
VALUES 
  ('f50e8400-e29b-41d4-a716-446655440001', 'Mathematics', 'MATH-10', '10th', '750e8400-e29b-41d4-a716-446655440011', 'Build strong algebra, geometry and arithmetic fundamentals.', 2499, 6, 'chart-1', 'Maths', 'published', NOW()),
  ('f50e8400-e29b-41d4-a716-446655440002', 'Physics', 'PHY-10', '10th', '750e8400-e29b-41d4-a716-446655440011', 'Conceptual clarity and numericals for motion, force and energy.', 2699, 6, 'chart-2', 'Physics', 'published', NOW()),
  ('f50e8400-e29b-41d4-a716-446655440003', 'Chemistry', 'CHEM-10', '10th', '750e8400-e29b-41d4-a716-446655440012', 'Master the language of atoms, reactions and solutions.', 2399, 6, 'chart-3', 'Chemistry', 'published', NOW()),
  ('f50e8400-e29b-41d4-a716-446655440004', 'Biology', 'BIO-12', '12th', '750e8400-e29b-41d4-a716-446655440012', 'Human physiology, genetics and practical biology.', 2999, 8, 'chart-4', 'Biology', 'published', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED ENROLLMENTS
-- ============================================================

INSERT INTO enrollments (id, student_id, subject_id, enrolled_at, status, expires_at, created_at)
VALUES 
  ('a50e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', NOW(), 'active', NOW() + INTERVAL '6 months', NOW()),
  ('a50e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440002', NOW(), 'active', NOW() + INTERVAL '6 months', NOW()),
  ('a50e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440003', NOW(), 'active', NOW() + INTERVAL '6 months', NOW()),
  ('a50e8400-e29b-41d4-a716-446655440004', '650e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440001', NOW(), 'active', NOW() + INTERVAL '6 months', NOW()),
  ('a50e8400-e29b-41d4-a716-446655440005', '650e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440004', NOW(), 'active', NOW() + INTERVAL '8 months', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED CHAPTERS
-- ============================================================

INSERT INTO chapters (id, subject_id, title, description, duration_min, chapter_order, created_at)
VALUES 
  ('b50e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', 'Linear Equations', 'Introduction to linear equations and solutions', 120, 1, NOW()),
  ('b50e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440001', 'Quadratic Equations', 'Quadratic formulas and factorization methods', 150, 2, NOW()),
  ('b50e8400-e29b-41d4-a716-446655440003', 'f50e8400-e29b-41d4-a716-446655440002', 'Motion in One Dimension', 'Displacement, velocity, and acceleration', 180, 1, NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED TESTS
-- ============================================================

INSERT INTO tests (id, subject_id, teacher_id, title, standard, description, instructions, duration_min, total_marks, passing_marks, starts_at, ends_at, status, created_at)
VALUES 
  ('c50e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440011', 'Algebra Checkpoint', '10th', 'Covers linear equations and identities.', 'All questions are compulsory. There is no negative marking.', 30, 20, 10, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 'published', NOW()),
  ('c50e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440011', 'Physics Quiz', '10th', 'Motion and forces basics', 'Answer all questions carefully.', 20, 15, 8, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 'published', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED TEST QUESTIONS
-- ============================================================

INSERT INTO test_questions (id, test_id, type, text, options, correct_answer_index, marks, difficulty, question_order, created_at)
VALUES 
  ('d50e8400-e29b-41d4-a716-446655440001', 'c50e8400-e29b-41d4-a716-446655440001', 'mcq', 'Solve: 2x + 3 = 11', '["2", "3", "4", "5"]'::JSONB, 2, 5, 'easy', 1, NOW()),
  ('d50e8400-e29b-41d4-a716-446655440002', 'c50e8400-e29b-41d4-a716-446655440001', 'short', 'State the distributive law.', NULL, NULL, 5, 'medium', 2, NOW()),
  ('d50e8400-e29b-41d4-a716-446655440003', 'c50e8400-e29b-41d4-a716-446655440001', 'truefalse', 'Velocity is a scalar quantity.', '["True", "False"]'::JSONB, 1, 5, 'easy', 3, NOW()),
  ('d50e8400-e29b-41d4-a716-446655440004', 'c50e8400-e29b-41d4-a716-446655440002', 'mcq', 'What is acceleration?', '["Rate of change of velocity", "Rate of change of distance", "Distance traveled", "Speed of object"]'::JSONB, 0, 5, 'easy', 1, NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED ASSIGNMENTS
-- ============================================================

INSERT INTO assignments (id, subject_id, teacher_id, title, description, instructions, due_at, max_marks, status, created_at)
VALUES 
  ('e50e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440011', 'Linear Equations Worksheet', 'Practice solving equations and word problems.', 'Submit a clear PDF with steps.', NOW() + INTERVAL '2 days', 25, 'published', NOW()),
  ('e50e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440011', 'Newton''s Laws Problem Set', 'Apply Newton''s laws to real-world scenarios.', 'Submit solutions with diagrams.', NOW() + INTERVAL '3 days', 30, 'published', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED SCHEDULED CLASSES
-- ============================================================

INSERT INTO scheduled_classes (id, subject_id, teacher_id, title, topic, chapter, description, starts_at, ends_at, meeting_url, status, created_at)
VALUES 
  ('a60e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440011', 'Quadratic Equations Revision', 'Quadratic Equations', 'Algebra', 'Revision and Q&A session.', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 'https://meet.example.com/class1', 'live', NOW()),
  ('a60e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440011', 'Motion in One Dimension', 'Kinematics Basics', 'Motion', 'Understanding velocity and acceleration.', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 1 hour', 'https://meet.example.com/class2', 'scheduled', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED MATERIALS
-- ============================================================

INSERT INTO materials (id, subject_id, chapter_id, title, description, file_type, file_url, file_size_kb, status, material_order, created_by, created_at)
VALUES 
  ('a70e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', 'b50e8400-e29b-41d4-a716-446655440001', 'Chapter 1 Notes', 'Core practice notes for equations and identities.', 'PDF', 'https://storage.example.com/notes/ch1.pdf', 2400, 'published', 1, '550e8400-e29b-41d4-a716-446655440011', NOW()),
  ('a70e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440001', 'b50e8400-e29b-41d4-a716-446655440002', 'Quadratic Formulas Reference', 'Key formulas and their applications.', 'PDF', 'https://storage.example.com/notes/quadratic.pdf', 1500, 'published', 1, '550e8400-e29b-41d4-a716-446655440011', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED RECORDINGS
-- ============================================================

INSERT INTO recordings (id, subject_id, title, topic, description, video_url, duration_min, status, created_by, created_at)
VALUES 
  ('a80e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', 'Algebra Fundamentals', 'Linear Equations', 'Complete lesson on solving linear equations.', 'https://videos.example.com/algebra1.mp4', 45, 'published', '550e8400-e29b-41d4-a716-446655440011', NOW()),
  ('a80e8400-e29b-41d4-a716-446655440002', 'f50e8400-e29b-41d4-a716-446655440002', 'Motion Basics', 'Velocity and Acceleration', 'Introduction to kinematics.', 'https://videos.example.com/physics1.mp4', 50, 'published', '550e8400-e29b-41d4-a716-446655440011', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED QUESTION PAPERS
-- ============================================================

INSERT INTO question_papers (id, subject_id, teacher_id, title, exam_type, description, standard, duration_min, total_marks, available_from, available_until, status, created_at)
VALUES 
  ('a90e8400-e29b-41d4-a716-446655440001', 'f50e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440011', 'Unit Test 1', 'Unit test', 'Algebra and arithmetic revision test.', '10th', 45, 40, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days', 'published', NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED SUBSCRIPTION PLANS
-- ============================================================

INSERT INTO subscription_plans (id, name, description, price_inr, features, duration_days, plan_kind, active, created_at)
VALUES 
  ('b00e8400-e29b-41d4-a716-446655440001', 'Basic', 'Access to basic courses', 0, '["Access to 1-2 courses", "Limited live classes", "Community support"]'::JSONB, 30, 'monthly', TRUE, NOW()),
  ('b00e8400-e29b-41d4-a716-446655440002', 'Pro', 'Professional learning pack', 4999, '["Access to all courses", "Unlimited live classes", "Priority support", "Certificate of completion"]'::JSONB, 30, 'monthly', TRUE, NOW()),
  ('b00e8400-e29b-41d4-a716-446655440003', 'Premium', 'Premium plus personal guidance', 9999, '["Everything in Pro", "1-on-1 mentoring", "Advanced materials", "Test preparation"]'::JSONB, 30, 'monthly', TRUE, NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED ANNOUNCEMENTS
-- ============================================================

INSERT INTO announcements (id, title, body, created_by, target_audience, published, published_at, created_at)
VALUES 
  ('b10e8400-e29b-41d4-a716-446655440001', 'Platform Update', 'We have launched new features including live coding sessions and peer collaboration tools.', '550e8400-e29b-41d4-a716-446655440021', 'all', TRUE, NOW(), NOW()),
  ('b10e8400-e29b-41d4-a716-446655440002', 'Teacher Onboarding', 'New teachers can now create and publish courses directly. Check the documentation.', '550e8400-e29b-41d4-a716-446655440021', 'teachers', TRUE, NOW(), NOW())
ON CONFLICT DO NOTHING;
