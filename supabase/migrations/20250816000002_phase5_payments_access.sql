-- ============================================================================
-- EduLive Phase 5 Migration: Payments, Subscriptions & Secure Course Access
-- ============================================================================

-- 1. Ensure payment_status enum has all needed values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'completed', 'failed', 'refunded', 'cancelled');
  ELSE
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';
  END IF;
END $$;

-- 2. Enhance payments table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS provider_signature VARCHAR(255),
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

-- Create index on provider_order_id for fast lookup during verification
CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id ON public.payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 3. Enhance enrollments table
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS enrollment_type VARCHAR(50) DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_student_subject ON public.enrollments(student_id, subject_id, status);

-- 4. Update and tighten RLS policies on payments
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own_or_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin_or_system" ON public.payments;

CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_insert_authenticated"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "payments_update_admin_or_system"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Update and tighten RLS policies on enrollments
DROP POLICY IF EXISTS "enrollments_select_own" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select_teacher_subjects" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select_admin" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_own_or_admin" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_own_or_admin" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_authenticated" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_admin_or_own" ON public.enrollments;

CREATE POLICY "enrollments_select_own"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "enrollments_select_teacher_subjects"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subjects s
      JOIN public.teachers t ON t.id = s.teacher_id
      WHERE s.id = enrollments.subject_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "enrollments_select_admin"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "enrollments_insert_authenticated"
  ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "enrollments_update_admin_or_own"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
