-- Migration: 20260309_social_proof_settings
-- Add site_settings keys for marketing/social proof values
-- and fix discovery call duration default

INSERT INTO site_settings (key, value, description, category) VALUES
  ('hero_stat_families',        '"100+"', 'Homepage hero stat: families/happy parents count', 'marketing'),
  ('hero_stat_assessments',     '"500+"', 'Homepage hero stat: assessments completed count', 'marketing'),
  ('assessment_duration_text',  '"5"',    'Assessment duration in minutes shown to users',   'marketing'),
  ('group_class_min_price',     '"199"',  'Minimum group class price for display (no ₹ symbol)', 'pricing')
ON CONFLICT (key) DO NOTHING;

-- Fix discovery call duration: canonical value is 30 minutes
UPDATE site_settings
SET value = '"30"'
WHERE key = 'session_discovery_duration_mins'
  AND value IN ('"45"', '45', '"15"', '15');
