-- ============================================================================
-- MINI CHALLENGE - DATABASE SCHEMA MIGRATION
-- Date: 2026-02-06
-- Purpose: Add columns to support Mini Challenge feature
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
-- Note: min_age and max_age already exist in elearning_units
ALTER TABLE elearning_units
ADD COLUMN IF NOT EXISTS is_mini_challenge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS goal_area TEXT;

-- Create index for efficient mini challenge queries
CREATE INDEX IF NOT EXISTS idx_elearning_mini_challenge
ON elearning_units(is_mini_challenge, goal_area)
WHERE is_mini_challenge = true;

COMMENT ON COLUMN elearning_units.is_mini_challenge IS 'True if this unit is a mini challenge (not a regular quest)';
COMMENT ON COLUMN elearning_units.goal_area IS 'Learning goal this addresses: grammar, comprehension, creative_writing, speaking, etc.';

-- 3. No changes needed to learning_events
-- ============================================================================
-- We'll use event_type = 'mini_challenge_completed' when logging events
-- event_data JSONB will store: {topic, score, xp_earned, time_spent, video_watched}

-- 4. Verification queries
-- ============================================================================
-- Run these to verify the migration worked:

-- Check children table columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'children'
-- AND column_name LIKE '%mini_challenge%';

-- Check elearning_units columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'elearning_units'
-- AND column_name IN ('is_mini_challenge', 'goal_area', 'min_age', 'max_age');

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'elearning_units'
-- AND indexname LIKE '%mini_challenge%';
