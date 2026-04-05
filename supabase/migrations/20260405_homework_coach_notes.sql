-- ============================================================
-- Migration: Coach notes on homework + SmartPractice flag
-- coach_notes stores original coach text (may be technical)
-- description = simplified parent-facing version
-- smart_practice_enabled = admin flag for interactive homework
-- ============================================================

-- 1. Coach notes on parent_daily_tasks
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS coach_notes TEXT;

COMMENT ON COLUMN parent_daily_tasks.coach_notes IS
  'Coach original homework text (may be technical). description = simplified parent-facing version. Used for SmartPractice content generation.';

-- 2. SmartPractice access flag on children
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS smart_practice_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN children.smart_practice_enabled IS
  'Admin-controlled flag. When true, child gets interactive homework (quizzes, games) instead of text-only tasks.';
