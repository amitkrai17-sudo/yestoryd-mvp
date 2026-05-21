-- Block BATCH-1-A2 — Cutover migration for parent_payment_confirmed_v3
-- See docs/CURRENT-STATE.md or the BATCH-1-A2 commit message for context.
--
-- Changes:
--   channel: aisensy → leadbot
--   wa_variables: 4 → 5 (reordered per Meta-approved body: parent, amount, child, coach, sessions)
--   required_variables: 9 → 5 (drops stale: dashboard_link, program_label, schedule_description, plan)
--   wa_variable_derivations: 1 → 3 (adds parent_first_name and coach_first_name derivations)
--   cost_per_send: 0.1450 → 0.1200 (Meta Utility rate)
--
-- Meta body (Lead Bot WABA, locked from screenshot 2026-05-21):
--   Hi {{1}}, your payment of ₹{{2}} for {{3}}'s English classes with coach {{4}} has been received.
--   {{5}} sessions have been added to the account.
--   Slot map: {{1}}=parent_first_name, {{2}}=amount, {{3}}=child_first_name, {{4}}=coach_first_name, {{5}}=sessions_count
--   Button: Static URL "View dashboard" → https://yestoryd.com/parent/dashboard (no payload variable)
--
-- Idempotent: WHERE channel='aisensy' makes re-runs no-op after first apply.

UPDATE communication_templates
SET
  channel                 = 'leadbot',
  wa_variables            = ARRAY['parent_first_name', 'amount', 'child_first_name', 'coach_first_name', 'sessions_count'],
  required_variables      = ARRAY['parent_name', 'amount', 'child_name', 'coach_name', 'sessions_count'],
  wa_variable_derivations = jsonb_build_object(
    'parent_first_name', jsonb_build_object('source', 'parent_name', 'transform', 'first_word'),
    'child_first_name',  jsonb_build_object('source', 'child_name',  'transform', 'first_word'),
    'coach_first_name',  jsonb_build_object('source', 'coach_name',  'transform', 'first_word')
  ),
  cost_per_send           = 0.1200,
  updated_at              = NOW()
WHERE template_code = 'parent_payment_confirmed_v3'
  AND channel = 'aisensy';

-- Post-deploy verification (run manually via Supabase MCP execute_sql):
--   SELECT template_code, channel, wa_variables, required_variables, wa_variable_derivations,
--          cost_per_send, updated_at
--   FROM communication_templates
--   WHERE template_code = 'parent_payment_confirmed_v3';
