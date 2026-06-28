-- ============================================================================
-- add scheduled_sessions.coach_confirm_escalated_at
-- ============================================================================
-- Once-only gate for the 48h-unconfirmed admin escalation (the escalate-only
-- rework of app/api/cron/auto-complete-sessions). The cron stamps this column
-- when it has notified admin that a coach left a prompted session unconfirmed
-- for 48h, and selects only NULL rows, so admin is paged once per session — not
-- every run. Mirrors the coach_confirm_sent_at once-only pattern.
--
-- Plain additive column: no backfill, no default. NULL = not escalated.
-- Apply to live DB via Supabase MCP AFTER the code deploy.
-- ============================================================================

ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS coach_confirm_escalated_at TIMESTAMPTZ;

COMMENT ON COLUMN scheduled_sessions.coach_confirm_escalated_at IS
  'When the 48h-unconfirmed escalation was sent to admin (once-only gate). NULL = not escalated.';

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual, NOT auto-executed)
-- ----------------------------------------------------------------------------
-- ALTER TABLE scheduled_sessions DROP COLUMN IF EXISTS coach_confirm_escalated_at;
