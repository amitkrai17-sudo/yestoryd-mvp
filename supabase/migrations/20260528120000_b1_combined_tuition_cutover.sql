-- Block B1-COMBINED — Atomic cutover for parent_tuition_payment_v3 + parent_tuition_low_balance_v3
--
-- Changes (both templates):
--   channel: aisensy → leadbot
--   URL moves from body slot to templateButtons (utility_cta variant; emitted by middleware-level
--     307 redirect from /parent/checkout/<id> and /parent/topup/<id>)
--   Pattern A → Pattern B (canonical names + first_word derivations)
--   cost_per_send: 0.1450 → 0.1200
--
-- Idempotent: WHERE channel='aisensy' makes re-runs no-op.
--
-- Meta bodies (Lead Bot WABA, locked from screenshots 2026-05-21):
--   payment_v3:    "Hi {{1}}, the payment link for {{2}}'s English classes is ready. Tap below to complete the payment."
--                  Button: Dynamic URL "Pay now" → https://yestoryd.com/parent/checkout/{{1}}
--                  Token = enrollment.id (middleware redirects /parent/checkout/<id> → /tuition/pay/<id>)
--   low_balance_v3: "Hi {{1}}, {{2}}'s account has {{3}} sessions remaining. Tap below to top up sessions."
--                  Button: Dynamic URL "Top up sessions" → https://yestoryd.com/parent/topup/{{1}}
--                  Token = enrollmentId (middleware redirects /parent/topup/<id> → /tuition/pay/<id>?renewal=true)
--
-- Note: parent_tuition_renewal_v3 and parent_tuition_paused_v3 are NOT in scope for this block.
-- They remain on channel='aisensy' until BATCH-2-A.

UPDATE communication_templates
SET
  channel                 = 'leadbot',
  wa_variables            = ARRAY['parent_first_name', 'child_first_name'],
  required_variables      = ARRAY['parent_name', 'child_name'],
  wa_variable_derivations = jsonb_build_object(
    'parent_first_name', jsonb_build_object('source', 'parent_name', 'transform', 'first_word'),
    'child_first_name',  jsonb_build_object('source', 'child_name',  'transform', 'first_word')
  ),
  cost_per_send           = 0.1200,
  updated_at              = NOW()
WHERE template_code = 'parent_tuition_payment_v3'
  AND channel = 'aisensy';

UPDATE communication_templates
SET
  channel                 = 'leadbot',
  wa_variables            = ARRAY['parent_first_name', 'child_first_name', 'new_balance'],
  required_variables      = ARRAY['parent_name', 'child_name', 'new_balance'],
  wa_variable_derivations = jsonb_build_object(
    'parent_first_name', jsonb_build_object('source', 'parent_name', 'transform', 'first_word'),
    'child_first_name',  jsonb_build_object('source', 'child_name',  'transform', 'first_word')
  ),
  cost_per_send           = 0.1200,
  updated_at              = NOW()
WHERE template_code = 'parent_tuition_low_balance_v3'
  AND channel = 'aisensy';

-- Post-deploy verification (run manually via Supabase MCP execute_sql):
--   SELECT template_code, channel, wa_variables, required_variables, wa_variable_derivations,
--          cost_per_send, updated_at
--   FROM communication_templates
--   WHERE template_code IN ('parent_tuition_payment_v3', 'parent_tuition_low_balance_v3');
