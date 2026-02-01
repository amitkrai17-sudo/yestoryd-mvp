-- ============================================================================
-- MIGRATION: Add scheduling preferences to enrollments table
-- Date: 2026-01-28
-- Purpose: Support preference-based session scheduling
-- ============================================================================

-- Add preference columns to enrollments table
-- These store the parent's preferred time bucket and days for scheduling

-- Time bucket preference (morning/afternoon/evening/any)
ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS preference_time_bucket VARCHAR(20);

-- Preferred days (JSONB array of day numbers: 0=Sun, 1=Mon... 6=Sat)
-- Example: [1, 2, 3, 4, 5] for weekdays
ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS preference_days JSONB;

-- Start type preference (immediate or later)
ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS preference_start_type VARCHAR(20) DEFAULT 'immediate';

-- Specific start date if start_type is 'later'
ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS preference_start_date DATE;

-- Add slot_match_type to scheduled_sessions for tracking match quality
ALTER TABLE scheduled_sessions
ADD COLUMN IF NOT EXISTS slot_match_type VARCHAR(30);

-- Comments for documentation
COMMENT ON COLUMN enrollments.preference_time_bucket IS 'Parent preference for session times: morning (9-12), afternoon (12-16), evening (16-20)';
COMMENT ON COLUMN enrollments.preference_days IS 'JSONB array of preferred days (0=Sun through 6=Sat)';
COMMENT ON COLUMN enrollments.preference_start_type IS 'When to start: immediate or later';
COMMENT ON COLUMN enrollments.preference_start_date IS 'Specific start date if preference_start_type is later';
COMMENT ON COLUMN scheduled_sessions.slot_match_type IS 'Quality of slot match: exact_match, preferred_time, preferred_day, any_in_week, shifted_week, manual_required';

-- Index for querying by preference (optional, for admin reports)
CREATE INDEX IF NOT EXISTS idx_enrollments_preference_time_bucket
ON enrollments(preference_time_bucket)
WHERE status = 'active';

-- Verify columns added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enrollments'
AND column_name LIKE 'preference%';
