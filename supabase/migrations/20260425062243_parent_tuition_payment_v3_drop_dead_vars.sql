-- Migration: parent_tuition_payment_v3 — drop 3 dead vars from wa_variables
-- Reason: AiSensy template body has only 3 slots (parent_first_name,
--         child_first_name, checkout_url). DB had 6 vars; callers sent all 6;
--         AiSensy would reject if it ever fired.
-- Strategy: In-place UPDATE. Zero send history in 30 days = no risk window.
--           wa_template_name UNCHANGED (per user direction).
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql (restore 6-var array)

BEGIN;

-- Capture pre-state for rollback verification
DO $$
DECLARE
  pre_vars TEXT[];
BEGIN
  SELECT wa_variables INTO pre_vars
  FROM communication_templates
  WHERE template_code = 'parent_tuition_payment_v3';

  IF pre_vars IS NULL OR array_length(pre_vars, 1) != 6 THEN
    RAISE EXCEPTION 'Unexpected pre-state: % (expected 6 vars)', pre_vars;
  END IF;
END $$;

-- Apply update
UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name', 'child_first_name', 'checkout_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_payment_v3'
RETURNING template_code, wa_template_name, wa_variables;

-- Verify post-state
DO $$
DECLARE
  post_vars TEXT[];
  post_name TEXT;
BEGIN
  SELECT wa_variables, wa_template_name INTO post_vars, post_name
  FROM communication_templates
  WHERE template_code = 'parent_tuition_payment_v3';

  IF post_vars != ARRAY['parent_first_name', 'child_first_name', 'checkout_url'] THEN
    RAISE EXCEPTION 'Post-state wa_variables mismatch: %', post_vars;
  END IF;

  IF post_name != 'parent_tuition_payment_v3' THEN
    RAISE EXCEPTION 'wa_template_name was modified: %', post_name;
  END IF;
END $$;

COMMIT;
