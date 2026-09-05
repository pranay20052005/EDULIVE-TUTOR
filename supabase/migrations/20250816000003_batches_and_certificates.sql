-- Migration 008: Batches and Course Completion Certificates

-- 1. Create Batches Table
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  standard TEXT NOT NULL,
  timing TEXT,
  capacity INT DEFAULT 50,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Batch Students Association Table
CREATE TABLE IF NOT EXISTS public.batch_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, student_id)
);

-- 3. Add batch_id to scheduled_classes and assignments if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'scheduled_classes' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE public.scheduled_classes ADD COLUMN batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create Course Certificates Table
CREATE TABLE IF NOT EXISTS public.course_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number TEXT UNIQUE NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  standard TEXT NOT NULL,
  score_percentage NUMERIC(5,2) DEFAULT 100.00,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_url TEXT,
  status TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, subject_id)
);

-- 5. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_batches_subject ON public.batches(subject_id);
CREATE INDEX IF NOT EXISTS idx_batches_teacher ON public.batches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_batch ON public.batch_students(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_students_student ON public.batch_students(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.course_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.course_certificates(certificate_number);

-- 6. Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for Batches
DROP POLICY IF EXISTS "batches_select_policy" ON public.batches;
CREATE POLICY "batches_select_policy" ON public.batches
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.teachers WHERE id = batches.teacher_id AND user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.batch_students bs
      JOIN public.students s ON bs.student_id = s.id
      WHERE bs.batch_id = batches.id AND s.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.students s ON e.student_id = s.id
      WHERE e.subject_id = batches.subject_id AND s.user_id = auth.uid() AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "batches_all_admin_teacher" ON public.batches;
CREATE POLICY "batches_all_admin_teacher" ON public.batches
  FOR ALL USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.teachers WHERE (id = batches.teacher_id OR user_id = auth.uid()))
  );

-- 8. RLS Policies for Batch Students
DROP POLICY IF EXISTS "batch_students_select_policy" ON public.batch_students;
CREATE POLICY "batch_students_select_policy" ON public.batch_students
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.students s WHERE s.id = batch_students.student_id AND s.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.batches b
      JOIN public.teachers t ON b.teacher_id = t.id
      WHERE b.id = batch_students.batch_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "batch_students_all_admin_teacher" ON public.batch_students;
CREATE POLICY "batch_students_all_admin_teacher" ON public.batch_students
  FOR ALL USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.batches b
      JOIN public.teachers t ON b.teacher_id = t.id
      WHERE b.id = batch_students.batch_id AND t.user_id = auth.uid()
    )
  );

-- 9. RLS Policies for Course Certificates
DROP POLICY IF EXISTS "certificates_select_policy" ON public.course_certificates;
CREATE POLICY "certificates_select_policy" ON public.course_certificates
  FOR SELECT USING (
    true -- Public verification of certificates by number or ID
  );

DROP POLICY IF EXISTS "certificates_manage_policy" ON public.course_certificates;
CREATE POLICY "certificates_manage_policy" ON public.course_certificates
  FOR ALL USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.students s WHERE s.id = course_certificates.student_id AND s.user_id = auth.uid()
    )
  );
