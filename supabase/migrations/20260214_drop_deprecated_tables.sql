-- ============================================================================
-- DROP DEPRECATED TABLES
-- Date: 2026-02-14
-- Phase 1: Database Cleanup & Type Safety
-- ============================================================================
-- !! DO NOT RUN WITHOUT REVIEW !!
-- Verify against: audit-results/deprecated-tables-codebase-audit.md
-- Each table below has been verified to have ZERO application code references.
-- ============================================================================

-- ============================================================================
-- DEPRECATED TABLES — SAFE TO DROP (0 code refs, renamed from old schema)
-- Evidence: audit-results/deprecated-tables-codebase-audit.md
-- ============================================================================

-- _deprecated_child_badges — 0 code refs, renamed by 20260211_elearning_consolidation.sql
-- Active replacement: child_badges (7 active code refs)
DROP TABLE IF EXISTS "_deprecated_child_badges" CASCADE;

-- _deprecated_child_gamification — 0 code refs
-- Active replacement: child_gamification (12 active code refs)
DROP TABLE IF EXISTS "_deprecated_child_gamification" CASCADE;

-- _deprecated_child_unit_progress — 0 code refs
-- Active replacement: child_unit_progress (8 active code refs)
DROP TABLE IF EXISTS "_deprecated_child_unit_progress" CASCADE;

-- _deprecated_child_video_progress — 0 code refs
-- Active replacement: child_video_progress (6 active code refs)
DROP TABLE IF EXISTS "_deprecated_child_video_progress" CASCADE;

-- _deprecated_elearning_content_pools — 0 code refs
-- Active replacement: el_content_pools
DROP TABLE IF EXISTS "_deprecated_elearning_content_pools" CASCADE;

-- _deprecated_elearning_quizzes — 0 code refs
-- Active replacement: el_quizzes
DROP TABLE IF EXISTS "_deprecated_elearning_quizzes" CASCADE;

-- _deprecated_elearning_skills — 0 code refs
-- Active replacement: el_skills
DROP TABLE IF EXISTS "_deprecated_elearning_skills" CASCADE;

-- _deprecated_elearning_sub_skills — 0 code refs
-- Active replacement: el_sub_skills
DROP TABLE IF EXISTS "_deprecated_elearning_sub_skills" CASCADE;

-- _deprecated_elearning_units — 0 code refs
-- Active replacement: el_units
DROP TABLE IF EXISTS "_deprecated_elearning_units" CASCADE;

-- _deprecated_learning_games — 0 code refs, no active replacement
DROP TABLE IF EXISTS "_deprecated_learning_games" CASCADE;

-- _deprecated_learning_levels — 0 code refs, no active replacement
DROP TABLE IF EXISTS "_deprecated_learning_levels" CASCADE;

-- _deprecated_learning_modules — 0 code refs, no active replacement
DROP TABLE IF EXISTS "_deprecated_learning_modules" CASCADE;

-- _deprecated_learning_videos — 0 code refs, no active replacement
DROP TABLE IF EXISTS "_deprecated_learning_videos" CASCADE;

-- ============================================================================
-- DUPLICATE TABLES — SAFE TO DROP (0 code refs, superseded by active table)
-- Evidence: audit-results/duplicate-tables-codebase-audit.md
-- ============================================================================

-- elearning_game_engines — 0 active code refs (only in old migration SQL + types)
-- Active replacement: el_game_engines (4 active refs across 3 files)
DROP TABLE IF EXISTS "elearning_game_engines" CASCADE;

-- communication_log (singular) — 0 active code refs (only in type definitions)
-- Active replacement: communication_logs (plural, 15+ active refs across 10 files)
DROP TABLE IF EXISTS "communication_log" CASCADE;

-- ============================================================================
-- NOT DROPPING — Tables with 0 code refs but may be planned features
-- ============================================================================

-- NOT DROPPING: communication_preferences — 0 code refs, but may be future feature
-- NOT DROPPING: parent_communications — 0 code refs, but may be future feature
-- NOT DROPPING: coach_assignment_status — 0 code refs, but may be future feature

-- ============================================================================
-- AFTER RUNNING: Regenerate database.types.ts
-- supabase gen types typescript --project-id <project-id> > lib/supabase/database.types.ts
-- ============================================================================
