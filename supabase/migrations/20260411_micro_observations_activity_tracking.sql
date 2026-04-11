-- ============================================================
-- Migration: Add activity tracking columns to micro_observations
-- Purpose: Support unified MicroNotePanel (sidebar + fullscreen)
--          with activity-driven capture and per-activity timing
-- ============================================================

-- 1. Add capture_mode column (replaces observation_type for new captures)
ALTER TABLE micro_observations
  ADD COLUMN IF NOT EXISTS capture_mode TEXT;

-- 2. Add activity tracking columns
ALTER TABLE micro_observations
  ADD COLUMN IF NOT EXISTS activity_name TEXT,
  ADD COLUMN IF NOT EXISTS activity_index SMALLINT,
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS skill_id UUID REFERENCES el_skills(id);

-- 3. Add CHECK constraint for capture_mode
ALTER TABLE micro_observations
  ADD CONSTRAINT micro_observations_capture_mode_check
  CHECK (capture_mode IS NULL OR capture_mode IN (
    'full_grid', 'quick_all', 'voice_moment',
    'word_capture', 'free_note', 'activity_complete'
  ));

-- 4. Index for skill_id lookups
CREATE INDEX IF NOT EXISTS idx_micro_observations_skill_id
  ON micro_observations(skill_id) WHERE skill_id IS NOT NULL;

-- 5. Backfill capture_mode from existing observation_type for legacy rows
-- (non-blocking, runs on existing data)
UPDATE micro_observations SET capture_mode = CASE
  WHEN observation_type = 'strength' THEN 'full_grid'
  WHEN observation_type = 'struggle' THEN 'full_grid'
  WHEN observation_type = 'word' THEN 'word_capture'
  WHEN observation_type = 'note' THEN 'free_note'
  ELSE NULL
END WHERE capture_mode IS NULL;
