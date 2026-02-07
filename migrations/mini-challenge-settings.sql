-- ============================================================================
-- MINI CHALLENGE - SITE SETTINGS CONFIGURATION
-- Date: 2026-02-06
-- Purpose: Add configuration for Mini Challenge feature
-- ============================================================================

-- Insert Mini Challenge settings
-- Using ON CONFLICT DO UPDATE to allow re-running this migration
INSERT INTO site_settings (key, value, category, description) VALUES
  ('mini_challenge_enabled', 'true', 'features', 'Enable/disable Mini Challenge feature'),
  ('mini_challenge_questions_count_4_6', '3', 'mini_challenge', 'Number of quiz questions for ages 4-6'),
  ('mini_challenge_questions_count_7_9', '4', 'mini_challenge', 'Number of quiz questions for ages 7-9'),
  ('mini_challenge_questions_count_10_12', '5', 'mini_challenge', 'Number of quiz questions for ages 10-12'),
  ('mini_challenge_xp_correct', '10', 'mini_challenge', 'XP awarded per correct answer'),
  ('mini_challenge_xp_incorrect', '0', 'mini_challenge', 'XP awarded per incorrect answer'),
  ('mini_challenge_xp_video', '20', 'mini_challenge', 'XP awarded for watching video'),
  ('mini_challenge_video_skip_delay_seconds', '30', 'mini_challenge', 'Seconds before video skip button appears')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Verify insertion
SELECT key, value, category, description
FROM site_settings
WHERE category = 'mini_challenge' OR key = 'mini_challenge_enabled'
ORDER BY key;
