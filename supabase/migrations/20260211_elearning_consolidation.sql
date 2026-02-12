-- =============================================================================
-- MIGRATION: E-Learning Schema Consolidation
-- DATE: 2026-02-11
-- PURPOSE: Consolidate elearning_* (System 2) and learning_*/child_* (System 3)
--          tables onto el_* canonical tables. No data loss - old tables renamed.
-- =============================================================================

BEGIN;

-- ============================================================
-- A. Extend el_learning_units (absorb elearning_units + Task 2)
-- ============================================================
ALTER TABLE el_learning_units
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS sequence JSONB,
  ADD COLUMN IF NOT EXISTS sub_skill_tag TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS min_age INT,
  ADD COLUMN IF NOT EXISTS max_age INT,
  ADD COLUMN IF NOT EXISTS level INT,
  ADD COLUMN IF NOT EXISTS icon_emoji TEXT,
  ADD COLUMN IF NOT EXISTS color_hex TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activity_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_mini_challenge BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal_area TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS coach_guidance JSONB,
  ADD COLUMN IF NOT EXISTS parent_instruction TEXT,
  ADD COLUMN IF NOT EXISTS content_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS arc_stage TEXT CHECK (arc_stage IN ('assess', 'remediate', 'celebrate')),
  ADD COLUMN IF NOT EXISTS quest_title TEXT,
  ADD COLUMN IF NOT EXISTS estimated_minutes INT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- ============================================================
-- B. Extend el_videos (absorb learning_videos columns)
-- ============================================================
ALTER TABLE el_videos
  ADD COLUMN IF NOT EXISTS has_quiz BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS key_concepts TEXT[],
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS video_source TEXT DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS module_id UUID;

-- ============================================================
-- C. Extend el_child_video_progress (absorb quiz columns)
-- ============================================================
ALTER TABLE el_child_video_progress
  ADD COLUMN IF NOT EXISTS quiz_attempted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiz_score INT,
  ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS best_quiz_score INT,
  ADD COLUMN IF NOT EXISTS quiz_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- ============================================================
-- D. Extend el_child_unit_progress (absorb child_unit_progress)
-- ============================================================
ALTER TABLE el_child_unit_progress
  ADD COLUMN IF NOT EXISTS step_progress JSONB,
  ADD COLUMN IF NOT EXISTS completion_percentage INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_xp_earned INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_step INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_score INT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- ============================================================
-- E. Extend el_child_gamification (absorb child_gamification)
-- ============================================================
ALTER TABLE el_child_gamification
  ADD COLUMN IF NOT EXISTS total_quizzes_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_readings_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_time_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_units_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_perfect_scores INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_videos_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_games_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfect_quiz_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_coins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_streak_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date DATE,
  ADD COLUMN IF NOT EXISTS total_xp INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level INT DEFAULT 1;

-- ============================================================
-- F. Create el_worksheets table (Task 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS el_worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES el_learning_units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  asset_format TEXT CHECK (asset_format IN ('pdf', 'png', 'jpg', 'docx')) DEFAULT 'pdf',
  page_count INT,
  thumbnail_url TEXT,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- G. Migrate data from legacy tables
-- ============================================================

-- Migrate elearning_units → el_learning_units
-- Map sub_skill_id → skill_id via parent lookup
INSERT INTO el_learning_units (
  id, name, slug, description, skill_id, sequence, sub_skill_tag,
  status, min_age, max_age, level, icon_emoji, color_hex,
  thumbnail_url, tags, display_order, activity_count, is_featured,
  published_at, is_mini_challenge, goal_area, video_url,
  quest_title, estimated_minutes, difficulty, created_at, updated_at
)
SELECT
  eu.id,
  eu.name,
  eu.slug,
  eu.description,
  COALESCE(ess.skill_id, eu.sub_skill_id),  -- map sub_skill → parent skill
  eu.sequence,
  ess.slug AS sub_skill_tag,
  COALESCE(eu.status, 'draft'),
  eu.min_age,
  eu.max_age,
  eu.level,
  eu.icon_emoji,
  eu.color_hex,
  eu.thumbnail_url,
  eu.tags,
  COALESCE(eu.display_order, 0),
  eu.activity_count,
  COALESCE(eu.is_featured, false),
  eu.published_at,
  COALESCE(eu.is_mini_challenge, false),
  eu.goal_area,
  eu.video_url,
  eu.quest_title,
  eu.estimated_minutes,
  eu.difficulty,
  COALESCE(eu.created_at, now()),
  COALESCE(eu.updated_at, now())
FROM elearning_units eu
LEFT JOIN elearning_sub_skills ess ON eu.sub_skill_id = ess.id
ON CONFLICT (id) DO NOTHING;

-- Migrate learning_videos → el_videos
INSERT INTO el_videos (
  id, title, description, thumbnail_url, duration_seconds, xp_reward,
  skill_id, slug, video_source, video_id, video_url, display_order,
  has_quiz, key_concepts, status, is_free, is_active,
  created_at, updated_at
)
SELECT
  lv.id,
  lv.title,
  lv.description,
  lv.thumbnail_url,
  lv.duration_seconds,
  COALESCE(lv.xp_reward, 10),
  lm.skill_id,  -- map module → skill via learning_modules
  lv.slug,
  lv.video_source,
  lv.video_id,
  lv.video_url,
  COALESCE(lv.display_order, 0),
  COALESCE(lv.has_quiz, false),
  lv.key_concepts,
  COALESCE(lv.status, 'draft'),
  COALESCE(lv.is_free, false),
  COALESCE(lv.is_active, true),
  COALESCE(lv.created_at, now()),
  COALESCE(lv.updated_at, now())
FROM learning_videos lv
LEFT JOIN learning_modules lm ON lv.module_id = lm.id
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- H. Create compatibility views (safety net)
-- ============================================================

-- child_gamification → el_child_gamification
CREATE OR REPLACE VIEW child_gamification AS
SELECT
  id, child_id, total_xp, current_level,
  current_streak_days, longest_streak_days, last_activity_date,
  total_videos_completed, total_quizzes_completed, total_games_completed,
  total_readings_completed, total_time_minutes, total_units_completed,
  total_perfect_scores, perfect_quiz_count, total_coins,
  created_at, updated_at
FROM el_child_gamification;

-- child_unit_progress → el_child_unit_progress
CREATE OR REPLACE VIEW child_unit_progress AS
SELECT
  id, child_id, unit_id, status, current_step, step_progress,
  completion_percentage, total_xp_earned, best_score,
  next_review_at, review_count, interval_days,
  started_at, completed_at, last_activity_at,
  created_at, updated_at
FROM el_child_unit_progress;

-- child_video_progress → el_child_video_progress
CREATE OR REPLACE VIEW child_video_progress AS
SELECT
  id, child_id, video_id,
  completed AS is_completed,
  completion_percentage, xp_earned, completed_at,
  quiz_attempted, quiz_score, quiz_passed,
  best_quiz_score, quiz_attempts, quiz_completed_at,
  created_at, updated_at
FROM el_child_video_progress;

-- child_badges → el_child_badges
CREATE OR REPLACE VIEW child_badges AS
SELECT
  id, child_id, badge_id,
  created_at AS earned_at,
  created_at, updated_at
FROM el_child_badges;

-- badge_definitions → el_badges
CREATE OR REPLACE VIEW badge_definitions AS
SELECT
  id, name, description, icon, category,
  COALESCE(xp_bonus, 0) AS xp_bonus,
  criteria_type, criteria_value,
  is_active, display_order,
  created_at, updated_at
FROM el_badges;

-- ============================================================
-- I. Rename old tables (not drop — rollback safety)
-- ============================================================
ALTER TABLE IF EXISTS learning_videos RENAME TO _deprecated_learning_videos;
ALTER TABLE IF EXISTS learning_modules RENAME TO _deprecated_learning_modules;
ALTER TABLE IF EXISTS learning_levels RENAME TO _deprecated_learning_levels;
ALTER TABLE IF EXISTS learning_games RENAME TO _deprecated_learning_games;
ALTER TABLE IF EXISTS elearning_units RENAME TO _deprecated_elearning_units;
ALTER TABLE IF EXISTS elearning_skills RENAME TO _deprecated_elearning_skills;
ALTER TABLE IF EXISTS elearning_sub_skills RENAME TO _deprecated_elearning_sub_skills;
ALTER TABLE IF EXISTS elearning_content_pools RENAME TO _deprecated_elearning_content_pools;

-- Rename elearning_quizzes if it exists (may not)
DO $$ BEGIN
  ALTER TABLE elearning_quizzes RENAME TO _deprecated_elearning_quizzes;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Rename elearning_leaderboard if it exists (may not)
DO $$ BEGIN
  ALTER TABLE elearning_leaderboard RENAME TO _deprecated_elearning_leaderboard;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Rename elearning_progress if it exists (may not)
DO $$ BEGIN
  ALTER TABLE elearning_progress RENAME TO _deprecated_elearning_progress;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMIT;
