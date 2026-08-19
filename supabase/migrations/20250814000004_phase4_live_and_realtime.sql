-- ============================================================
-- EDULIVE PHASE 4 MIGRATION: LIVE CLASSES, RECORDING PROGRESS & REALTIME
-- ============================================================

-- 1. Create student_recording_progress table if not exists
CREATE TABLE IF NOT EXISTS student_recording_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL,
  recording_id UUID NOT NULL,
  progress_percent INTEGER DEFAULT 0,
  watched_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE,
  UNIQUE(student_id, recording_id)
);

CREATE INDEX IF NOT EXISTS idx_student_recording_progress_student ON student_recording_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_recording_progress_recording ON student_recording_progress(recording_id);

-- 2. Enable RLS on student_recording_progress
ALTER TABLE student_recording_progress ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for student_recording_progress
DROP POLICY IF EXISTS "student_recording_progress_select_own" ON student_recording_progress;
DROP POLICY IF EXISTS "student_recording_progress_insert_own" ON student_recording_progress;
DROP POLICY IF EXISTS "student_recording_progress_update_own" ON student_recording_progress;

CREATE POLICY "student_recording_progress_select_own" ON student_recording_progress
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "student_recording_progress_insert_own" ON student_recording_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "student_recording_progress_update_own" ON student_recording_progress
  FOR UPDATE TO authenticated
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  )
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- 4. RLS Policies for scheduled_classes (Ensure Complete CRUD for Teachers & Admins)
DROP POLICY IF EXISTS "scheduled_classes_select_published" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_select_own_teacher" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_insert_teacher" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_insert_admin_or_teacher" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_update_admin_or_teacher" ON scheduled_classes;
DROP POLICY IF EXISTS "scheduled_classes_delete_admin_or_teacher" ON scheduled_classes;

CREATE POLICY "scheduled_classes_select_published" ON scheduled_classes
  FOR SELECT
  USING (
    status != 'draft'
    OR teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "scheduled_classes_insert_admin_or_teacher" ON scheduled_classes
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "scheduled_classes_update_admin_or_teacher" ON scheduled_classes
  FOR UPDATE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  )
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "scheduled_classes_delete_admin_or_teacher" ON scheduled_classes
  FOR DELETE TO authenticated
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- 5. RLS Policies for recordings (Ensure Complete CRUD for Teachers & Admins)
DROP POLICY IF EXISTS "recordings_select_published" ON recordings;
DROP POLICY IF EXISTS "recordings_select_own_teacher" ON recordings;
DROP POLICY IF EXISTS "recordings_insert_teacher" ON recordings;
DROP POLICY IF EXISTS "recordings_insert_admin_or_teacher" ON recordings;
DROP POLICY IF EXISTS "recordings_update_admin_or_teacher" ON recordings;
DROP POLICY IF EXISTS "recordings_delete_admin_or_teacher" ON recordings;

CREATE POLICY "recordings_select_published" ON recordings
  FOR SELECT
  USING (
    status = 'published'
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "recordings_insert_admin_or_teacher" ON recordings
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "recordings_update_admin_or_teacher" ON recordings
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

CREATE POLICY "recordings_delete_admin_or_teacher" ON recordings
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );

-- 6. RLS Policies for notifications (Allow inserting notification to users)
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON notifications;

CREATE POLICY "notifications_insert_authenticated" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 7. Safe Idempotent Realtime Publication Configuration
DO $$
BEGIN
  -- Add scheduled_classes to publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'scheduled_classes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_classes;
  END IF;

  -- Add notifications to publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  -- Add recordings to publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE recordings;
  END IF;

  -- Add student_recording_progress to publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'student_recording_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE student_recording_progress;
  END IF;
END $$;
