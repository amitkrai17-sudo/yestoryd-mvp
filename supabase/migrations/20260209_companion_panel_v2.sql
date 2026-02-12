-- ============================================================
-- Migration: Companion Panel V2 columns
-- Date: 2026-02-09
-- Purpose: Support live session tracking, parent summary, and coach stats
-- ============================================================

-- Add columns to scheduled_sessions
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS companion_panel_completed BOOLEAN DEFAULT false;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'none';
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS completion_nudge_sent_at TIMESTAMPTZ;

-- Add column to coaches
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS completed_sessions_with_logs INT DEFAULT 0;
