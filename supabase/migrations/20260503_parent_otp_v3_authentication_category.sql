-- ════════════════════════════════════════════════════════════════════════════
-- Block 2.6b — flip parent_otp_v3.wa_template_category 'utility' → 'authentication'
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY:
--   parent_otp_v3 is a Meta Authentication-category template approved on
--   AiSensy and (separately) on the Lead Bot WABA. Block 2.6a's adapter
--   auth-synthesis branch (aisensy.ts + leadbot.ts) triggers on
--   params.templateCategory === 'authentication'. Without this UPDATE, the
--   spine would NOT synthesize the buttons[] payload that AiSensy/Meta
--   server-side requires for Authentication templates, and OTP sends would
--   fail with "buttons: Button at index 0 of type Url requires a parameter"
--   (verified in 2026-05-03 smoke test).
--
-- TIMING:
--   Apply via Supabase MCP BEFORE the Block 2.6b commit pushes. The bypass
--   code currently in production (app/api/auth/send-otp/route.ts pre-2.6b)
--   does NOT read this column, so flipping is invisible until Block 2.6b's
--   code change deploys. Zero window of risk.
--
-- IDEMPOTENCY:
--   Defensive WHERE clause prevents re-flipping if already 'authentication'.
--   Safe to re-run.
--
-- ROLLBACK:
--   UPDATE communication_templates
--      SET wa_template_category = 'utility'
--    WHERE template_code = 'parent_otp_v3';
-- ════════════════════════════════════════════════════════════════════════════

UPDATE communication_templates
SET wa_template_category = 'authentication'
WHERE template_code = 'parent_otp_v3'
  AND wa_template_category = 'utility';
