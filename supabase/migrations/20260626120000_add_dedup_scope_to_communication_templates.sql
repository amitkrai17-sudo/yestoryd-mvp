-- ============================================================================
-- add_dedup_scope_to_communication_templates
-- ============================================================================
-- ALREADY APPLIED to prod via Supabase MCP 2026-06-26; this file exists for
-- repo parity ONLY. DO NOT re-run against prod.
--
-- Phase 2B: per-template dedup-scope. communication_templates.dedup_scope (jsonb)
-- names the meta fields that compose the idempotency key in
-- lib/communication/notify.ts STEP 6. NULL (every non-seeded template) keeps the
-- legacy phone:day:firstParam[:ctx] key — unchanged behavior.
--
--   4 parent/coach session reminders -> {"fields":["contextId","scheduledDate"]}
--     (contextId = sessionId; scheduledDate = scheduled_date 'YYYY-MM-DD').
--   coach_session_reminder_1h_v3 -> {"fields":["contextId","scheduledDate","reminderWindow"]}
--     (sent by BOTH the 24h and 1h coach crons for the same session+date; the
--      reminderWindow '24h'|'1h' axis keeps the two windows distinct).
--   parent_tuition_low_balance_v4 -> {"fields":["contextId","nudgeSeq"]}
--     (contextId = enrollmentId; nudgeSeq = low_balance_nudges_sent).
--
-- Idempotent (IF NOT EXISTS + scoped UPDATEs) so a stray re-run is a no-op.
-- ============================================================================

ALTER TABLE communication_templates
  ADD COLUMN IF NOT EXISTS dedup_scope jsonb;

COMMENT ON COLUMN communication_templates.dedup_scope IS
  'Phase 2B: meta fields composing the notify.ts idempotency key, e.g. {"fields":["contextId","scheduledDate"]}. NULL = legacy phone:day:firstParam key.';

-- 4 parent/coach session reminders -> (template, contextId=sessionId, scheduledDate)
UPDATE communication_templates
  SET dedup_scope = '{"fields":["contextId","scheduledDate"]}'::jsonb
  WHERE template_code IN (
    'parent_session_reminder_24h_v3',
    'parent_session_reminder_24h_online_v1',
    'parent_session_reminder_1h_v3',
    'parent_session_reminder_1h_online_v1'
  );

-- coach 1h reminder template is reused by BOTH the 24h and 1h coach crons for the
-- same session+date -> add reminderWindow so the two windows key distinctly.
UPDATE communication_templates
  SET dedup_scope = '{"fields":["contextId","scheduledDate","reminderWindow"]}'::jsonb
  WHERE template_code = 'coach_session_reminder_1h_v3';

-- low-balance nudge -> (template, contextId=enrollmentId, nudgeSeq)
UPDATE communication_templates
  SET dedup_scope = '{"fields":["contextId","nudgeSeq"]}'::jsonb
  WHERE template_code = 'parent_tuition_low_balance_v4';

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual, NOT auto-executed)
-- ----------------------------------------------------------------------------
-- ALTER TABLE communication_templates DROP COLUMN IF EXISTS dedup_scope;
