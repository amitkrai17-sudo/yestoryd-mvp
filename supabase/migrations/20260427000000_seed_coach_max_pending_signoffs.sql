-- Migration: Seed site_settings.coach_max_pending_signoffs (Layer B threshold)
-- ================================================================
-- Threshold for the coach session-start forcing function:
--   PATCH /api/coach/sessions/[id]/live blocks the start with HTTP 423
--   when the coach has >= N sessions older than 48h with an unconfirmed
--   (or absent) structured capture.
--
-- Stored as JSON-encoded string per existing site_settings convention
-- (e.g. coaching_sessions: "6", coaching_duration_minutes: "45").
--
-- Re-runnable: ON CONFLICT DO NOTHING preserves any operator-edited value.

BEGIN;

INSERT INTO site_settings (category, key, value, description, updated_by)
VALUES (
  'coach',
  'coach_max_pending_signoffs',
  '"3"'::jsonb,
  'Maximum unsigned-off sessions older than 48h before coach is blocked from starting new sessions',
  'migration_20260427000000'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
