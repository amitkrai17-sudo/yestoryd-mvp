-- ============================================================
-- Migration: Child Learning Profile + Session Adherence
-- Date: 2026-02-11
-- Purpose:
--   1. Add JSONB learning_profile to children (Gemini-synthesized after each session)
--   2. Add adherence_score + adherence_details to scheduled_sessions
-- ============================================================

-- 1. Child Learning Profile
-- Updated by Gemini synthesis after each session's parent summary generation.
-- Stores cumulative child profile: reading level, active/mastered skills,
-- struggle areas, what works/doesn't, personality notes, parent engagement.
ALTER TABLE children ADD COLUMN IF NOT EXISTS learning_profile JSONB DEFAULT '{}';

-- 2. Session Adherence Score
-- Calculated by activity-log POST on session completion.
-- Score 0.00–1.00 based on: completion (60%) + sequence (20%) + time (20%).
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS adherence_score DECIMAL(3,2) CHECK (adherence_score >= 0 AND adherence_score <= 1);

-- 3. Session Adherence Details
-- Granular breakdown: per-activity status, time comparison, sequence check.
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS adherence_details JSONB DEFAULT '{}';
