-- Migration: Align balance-related templates with AiSensy 3-slot bodies
-- Affects: parent_tuition_low_balance_v3 (rename slot 2 only),
--          parent_tuition_renewal_v3 (drop 3 dead + rename slot 2),
--          parent_tuition_paused_v3 (drop 1 duplicate + rename slot 2)
-- Strategy: In-place UPDATE. Bundle with caller deploy to avoid drift window.
-- wa_template_name UNCHANGED for all three (keep AiSensy panel names stable).
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql

BEGIN;

-- Pre-state assertion
DO $$
DECLARE
  lb_vars TEXT[];
  rn_vars TEXT[];
  pa_vars TEXT[];
BEGIN
  SELECT wa_variables INTO lb_vars FROM communication_templates
  WHERE template_code = 'parent_tuition_low_balance_v3';
  SELECT wa_variables INTO rn_vars FROM communication_templates
  WHERE template_code = 'parent_tuition_renewal_v3';
  SELECT wa_variables INTO pa_vars FROM communication_templates
  WHERE template_code = 'parent_tuition_paused_v3';

  IF array_length(lb_vars,1) != 4 THEN
    RAISE EXCEPTION 'low_balance pre-state mismatch: %', lb_vars;
  END IF;
  IF array_length(rn_vars,1) != 6 THEN
    RAISE EXCEPTION 'renewal pre-state mismatch: %', rn_vars;
  END IF;
  IF array_length(pa_vars,1) != 4 THEN
    RAISE EXCEPTION 'paused pre-state mismatch: %', pa_vars;
  END IF;
END $$;

-- #4 low_balance_v3: rename slot 2 only (child_name → child_first_name)
UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name', 'child_first_name', 'new_balance', 'renewal_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_low_balance_v3';

-- #6 renewal_v3: drop sessions_purchased, coach_name, child_name_2; rename child_name
UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name', 'child_first_name', 'renewal_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_renewal_v3';

-- #7 paused_v3: drop child_name_2; rename child_name
UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name', 'child_first_name', 'renewal_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_paused_v3';

-- Post-state assertion
DO $$
DECLARE
  lb_vars TEXT[];
  rn_vars TEXT[];
  pa_vars TEXT[];
BEGIN
  SELECT wa_variables INTO lb_vars FROM communication_templates
  WHERE template_code = 'parent_tuition_low_balance_v3';
  SELECT wa_variables INTO rn_vars FROM communication_templates
  WHERE template_code = 'parent_tuition_renewal_v3';
  SELECT wa_variables INTO pa_vars FROM communication_templates
  WHERE template_code = 'parent_tuition_paused_v3';

  IF lb_vars != ARRAY['parent_first_name','child_first_name','new_balance','renewal_url'] THEN
    RAISE EXCEPTION 'low_balance post-state mismatch: %', lb_vars;
  END IF;
  IF rn_vars != ARRAY['parent_first_name','child_first_name','renewal_url'] THEN
    RAISE EXCEPTION 'renewal post-state mismatch: %', rn_vars;
  END IF;
  IF pa_vars != ARRAY['parent_first_name','child_first_name','renewal_url'] THEN
    RAISE EXCEPTION 'paused post-state mismatch: %', pa_vars;
  END IF;
END $$;

COMMIT;
