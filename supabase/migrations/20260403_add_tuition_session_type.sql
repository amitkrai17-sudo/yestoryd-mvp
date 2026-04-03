-- Migration: Add 'tuition' as a recognized session_type value
-- No CHECK constraint currently exists on scheduled_sessions.session_type.
-- Adding one with all known values to prevent invalid data going forward.

ALTER TABLE scheduled_sessions
ADD CONSTRAINT chk_session_type
CHECK (session_type IN ('coaching', 'parent_checkin', 'skill_booster', 'skill_building', 'discovery', 'group', 'tuition'));

COMMENT ON CONSTRAINT chk_session_type ON scheduled_sessions IS 'Valid session types: coaching, parent_checkin, skill_booster, skill_building, discovery, group, tuition';
