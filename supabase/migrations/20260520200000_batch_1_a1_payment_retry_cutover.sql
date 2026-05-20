-- Block BATCH-1-A1 — Cutover migration for parent payment retry templates
-- Phase 2C of Block BATCH-1-A1.
-- See docs/CURRENT-STATE.md "2026-05-20 — BATCH-1-A1: parent_payment_failed_v1 + parent_payment_retry_nudge_v1 cutover" entry.
--
-- Changes:
--   channel: aisensy → leadbot (both templates)
--   wa_variables: drop 'retry_link' positional (3 → 2)
--   required_variables: drop 'retry_link' canonical key (3 → 2)
--   cost_per_send: 0.1450 → 0.1200 (Meta Utility rate)
--   wa_variable_derivations: PRESERVED (Pattern B for parent_first_name + child_first_name)
--
-- Idempotent: WHERE channel='aisensy' predicate makes re-runs no-op after first apply.

UPDATE communication_templates
SET
  channel                 = 'leadbot',
  wa_variables            = ARRAY['parent_first_name', 'child_first_name'],
  required_variables      = ARRAY['parent_name', 'child_name'],
  cost_per_send           = 0.1200,
  updated_at              = NOW()
WHERE template_code IN ('parent_payment_failed_v1', 'parent_payment_retry_nudge_v1')
  AND channel = 'aisensy';

-- Verification queries (run manually post-deploy):
--   SELECT template_code, channel, wa_template_category, wa_variables, required_variables,
--          wa_variable_derivations, cost_per_send
--   FROM communication_templates
--   WHERE template_code IN ('parent_payment_failed_v1', 'parent_payment_retry_nudge_v1')
--   ORDER BY template_code;
-- Expected (both rows):
--   channel='leadbot'
--   wa_template_category='utility' (unchanged from pre-state)
--   wa_variables={parent_first_name, child_first_name}
--   required_variables={parent_name, child_name}
--   wa_variable_derivations preserved (parent_first_name/child_first_name first_word transforms)
--   cost_per_send=0.1200
