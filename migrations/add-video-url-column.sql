-- ============================================================================
-- ADD VIDEO_URL COLUMN TO ELEARNING_UNITS
-- Date: 2026-02-06
-- Purpose: Support video content in elearning units for Mini Challenge
-- ============================================================================

-- Add video_url column (if doesn't exist)
ALTER TABLE elearning_units
ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN elearning_units.video_url IS 'URL to video content (YouTube embed or direct video URL)';

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'elearning_units'
AND column_name IN ('video_url', 'is_mini_challenge', 'goal_area', 'min_age', 'max_age')
ORDER BY column_name;
