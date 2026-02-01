-- ============================================================================
-- Migration: Add session_types to coach_schedule_rules
-- Date: 2026-01-28
-- Purpose: Allow coaches to set different hours for different session types
-- ============================================================================

-- Add session_types column (JSONB array of session types this rule applies to)
ALTER TABLE coach_schedule_rules
ADD COLUMN IF NOT EXISTS session_types JSONB DEFAULT '["coaching", "parent_checkin", "skill_booster", "discovery"]';

-- Update existing rules to have all session types (if any have NULL)
UPDATE coach_schedule_rules
SET session_types = '["coaching", "parent_checkin", "skill_booster", "discovery"]'
WHERE session_types IS NULL;

-- Add GIN index for efficient JSONB array filtering
CREATE INDEX IF NOT EXISTS idx_coach_schedule_rules_session_types
ON coach_schedule_rules USING GIN (session_types);

-- Add comment for documentation
COMMENT ON COLUMN coach_schedule_rules.session_types IS 'Which session types this availability rule applies to: coaching, parent_checkin, skill_booster, discovery';
