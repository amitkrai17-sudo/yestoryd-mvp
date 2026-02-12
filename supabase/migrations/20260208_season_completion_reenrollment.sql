-- ============================================================
-- Migration: Season Completion + Re-enrollment Infrastructure
-- Date: 2026-02-08
-- Purpose: Support season completion flow, re-enrollment nudges
-- ============================================================

-- 1. Update enrollment status constraint to include season_completed
-- First check if constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'enrollments_status_check'
  ) THEN
    ALTER TABLE enrollments DROP CONSTRAINT enrollments_status_check;
  END IF;
END $$;

-- Re-add with season_completed
ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
  CHECK (status IN ('active', 'completed', 'season_completed', 'cancelled', 'paused', 'pending', 'pending_start'));

-- 2. Add re-enrollment tracking columns
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS previous_enrollment_id UUID REFERENCES enrollments(id);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_continuation BOOLEAN DEFAULT FALSE;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS season_completed_at TIMESTAMPTZ;

-- 3. Add completed_at to season_roadmaps if not exists
ALTER TABLE season_roadmaps ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. Create re-enrollment nudge tracking table
CREATE TABLE IF NOT EXISTS re_enrollment_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  nudge_number INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  channel TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nudges_status_scheduled
  ON re_enrollment_nudges(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_nudges_child
  ON re_enrollment_nudges(child_id);

-- 5. RLS for nudges table
ALTER TABLE re_enrollment_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on re_enrollment_nudges"
  ON re_enrollment_nudges
  FOR ALL
  USING (true)
  WITH CHECK (true);
