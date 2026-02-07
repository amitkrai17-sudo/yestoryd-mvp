-- ============================================================================
-- MINI CHALLENGE - COMPLETE SCHEMA MIGRATION
-- Date: 2026-02-06
-- Purpose: Add ALL columns needed for Mini Challenge feature
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add mini challenge tracking to children table
-- ============================================================================
ALTER TABLE children
ADD COLUMN IF NOT EXISTS mini_challenge_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mini_challenge_data JSONB;

COMMENT ON COLUMN children.mini_challenge_completed IS 'True if child completed mini challenge after assessment';
COMMENT ON COLUMN children.mini_challenge_data IS 'Stores: quiz_score, video_watched, xp_earned, topic, time_spent, completed_at';

-- 2. Add mini challenge columns to elearning_units table
-- ============================================================================
ALTER TABLE elearning_units
ADD COLUMN IF NOT EXISTS is_mini_challenge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS goal_area TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Create index for efficient mini challenge queries
CREATE INDEX IF NOT EXISTS idx_elearning_mini_challenge
ON elearning_units(is_mini_challenge, goal_area)
WHERE is_mini_challenge = true;

COMMENT ON COLUMN elearning_units.is_mini_challenge IS 'True if this unit is a mini challenge (not a regular quest)';
COMMENT ON COLUMN elearning_units.goal_area IS 'Learning goal this addresses: reading, grammar, comprehension, creative_writing, speaking, etc.';
COMMENT ON COLUMN elearning_units.video_url IS 'URL to video content (YouTube embed or direct video URL)';

-- 3. Verify all columns were added
-- ============================================================================
SELECT
  'children' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'children'
AND column_name LIKE '%mini_challenge%'

UNION ALL

SELECT
  'elearning_units' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'elearning_units'
AND column_name IN ('is_mini_challenge', 'goal_area', 'video_url')

ORDER BY table_name, column_name;
