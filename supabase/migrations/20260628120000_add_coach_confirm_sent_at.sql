-- ============================================================================
-- add scheduled_sessions.coach_confirm_sent_at
-- ============================================================================
-- Once-only QUERY GATE for the coach_session_confirm_v1 sender cron
-- (app/api/cron/send-coach-session-confirm). The cron stamps this column on a
-- successful send and selects only NULL rows, so it never re-attempts the same
-- session every tick. Mirrors the proven once-only pattern on
-- enrollments.parent_renewal_check_sent_at.
--
-- Plain additive column: no backfill, no default. NULL = not yet prompted.
-- Apply to live DB via Supabase MCP AFTER the code deploy (column is read by
-- the cron route, which is NOT registered in the dispatcher until Step 5).
-- ============================================================================

ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS coach_confirm_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN scheduled_sessions.coach_confirm_sent_at IS
  'When coach_session_confirm_v1 was sent to the session''s coach (once-only gate for the send-coach-session-confirm cron). NULL = not yet prompted.';

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual, NOT auto-executed)
-- ----------------------------------------------------------------------------
-- ALTER TABLE scheduled_sessions DROP COLUMN IF EXISTS coach_confirm_sent_at;
