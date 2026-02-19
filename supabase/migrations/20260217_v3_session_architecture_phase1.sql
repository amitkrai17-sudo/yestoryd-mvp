-- ============================================================================
-- V3 SESSION ARCHITECTURE — PHASE 1: DATABASE MIGRATION
-- 20260217_v3_session_architecture_phase1.sql
-- ============================================================================
--
-- Changes:
--   1A. age_band_config: add new columns, update values per band
--   1B. pricing_plans: set duration_weeks (column already exists)
--   1C. parent_calls: new table for on-demand parent calls
--   1D. site_settings: add new keys, update session_types JSON
--
-- DOES NOT delete: parent_checkin data, old pricing_plans session columns
-- ============================================================================

-- ============================================================================
-- PHASE 1A: age_band_config — add columns + update values
-- ============================================================================

ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS skill_booster_credits INTEGER;
ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS weekly_pattern JSONB;
ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS progress_pulse_interval INTEGER;
ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS differentiators JSONB DEFAULT '[]';
ALTER TABLE age_band_config ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'book';

-- Foundation (4-6): 18 coaching, 6 boosters, 1.5x/week, 30 min
UPDATE age_band_config SET
  sessions_per_season = 18,
  sessions_per_week = 1.5,
  skill_booster_credits = 6,
  weekly_pattern = '[2,1,2,1,2,1,2,1,2,1,2,1]'::jsonb,
  progress_pulse_interval = 6,
  tagline = 'Guided & Nurturing',
  short_description = 'Parent as co-learner with frequent, short sessions building strong phonics foundations',
  differentiators = '["Parent-involved sessions","Phonics-first curriculum","Twice-weekly coaching","30-min focused sessions"]'::jsonb,
  icon = 'heart'
WHERE id = 'foundation';

-- Building (7-9): 12 coaching, 4 boosters, 1.0x/week, 45 min
UPDATE age_band_config SET
  sessions_per_season = 12,
  sessions_per_week = 1.0,
  skill_booster_credits = 4,
  weekly_pattern = '[1,1,1,1,1,1,1,1,1,1,1,1]'::jsonb,
  progress_pulse_interval = 4,
  tagline = 'Interactive & Engaging',
  short_description = 'Blended coaching and practice building fluency and growing reading independence',
  differentiators = '["Blended coach + practice","Fluency-focused","Growing independence","45-min interactive sessions"]'::jsonb,
  icon = 'sparkles'
WHERE id = 'building';

-- Mastery (10-12): 9 coaching, 3 boosters, 0.75x/week, 60 min
UPDATE age_band_config SET
  sessions_per_season = 9,
  sessions_per_week = 0.75,
  skill_booster_credits = 3,
  weekly_pattern = '[1,1,1,0,1,1,1,0,1,1,1,0]'::jsonb,
  progress_pulse_interval = 3,
  tagline = 'Independent & Gamified',
  short_description = 'Self-paced learning with coaching guidance developing comprehension and critical thinking',
  differentiators = '["Self-paced e-learning","Gamified practice","Comprehension-focused","60-min deep-dive sessions"]'::jsonb,
  icon = 'rocket'
WHERE id = 'mastery';

-- ============================================================================
-- PHASE 1B: pricing_plans — set duration_weeks
-- Column already exists; ensure values are set for active plans
-- ============================================================================

UPDATE pricing_plans SET duration_weeks = 4 WHERE slug = 'starter' AND (duration_weeks IS NULL OR duration_weeks != 4);
UPDATE pricing_plans SET duration_weeks = 8 WHERE slug = 'continuation' AND (duration_weeks IS NULL OR duration_weeks != 8);
UPDATE pricing_plans SET duration_weeks = 12 WHERE slug = 'full' AND (duration_weeks IS NULL OR duration_weeks != 12);

-- ============================================================================
-- PHASE 1C: parent_calls table
-- ============================================================================

CREATE TABLE IF NOT EXISTS parent_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id),
  child_id UUID REFERENCES children(id),
  coach_id UUID REFERENCES coaches(id),
  initiated_by TEXT CHECK (initiated_by IN ('parent', 'coach')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 15,
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'scheduled', 'completed', 'cancelled')),
  google_event_id TEXT,
  google_meet_link TEXT,
  recall_bot_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limit: 1 per month per enrollment (excluding cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_calls_monthly
ON parent_calls (enrollment_id, date_trunc('month', requested_at))
WHERE status != 'cancelled';

-- Enable RLS
ALTER TABLE parent_calls ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 1D: site_settings — new keys + update session_types
-- ============================================================================

INSERT INTO site_settings (key, value, description, category) VALUES
  ('parent_call_duration_minutes', '15', 'Parent call duration in minutes', 'scheduling'),
  ('parent_call_max_per_month', '1', 'Max parent calls per month per enrollment', 'scheduling'),
  ('industry_avg_class_cost', '800-1200', 'Industry average per-class cost for comparison', 'pricing'),
  ('pricing_section_headline', 'One Program. Tailored to Every Age.', 'Pricing section main headline', 'pricing'),
  ('pricing_section_subheadline', 'Same 12-week transformation. Delivery adapts to how your child learns best.', 'Pricing section sub-headline', 'pricing')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update session_types: replace parent_checkin with parent_call
UPDATE site_settings
SET value = '{"coaching":{"label":"Coaching Session","default_duration":45},"parent_call":{"label":"Parent Call","default_duration":15},"skill_building":{"label":"Skill Booster","default_duration":45},"discovery":{"label":"Discovery Call","default_duration":30}}'
WHERE key = 'session_types';
