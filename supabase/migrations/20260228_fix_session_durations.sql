-- ============================================================================
-- Fix session_duration_minutes in age_band_config
-- The V3 migration (20260217) set weekly_pattern and sessions_per_season
-- but forgot to update session_duration_minutes from the default value.
-- ============================================================================

UPDATE age_band_config SET session_duration_minutes = 30 WHERE id = 'foundation';
UPDATE age_band_config SET session_duration_minutes = 45 WHERE id = 'building';
UPDATE age_band_config SET session_duration_minutes = 60 WHERE id = 'mastery';
