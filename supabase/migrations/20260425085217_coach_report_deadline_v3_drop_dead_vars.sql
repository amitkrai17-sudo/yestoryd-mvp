-- Migration: coach_report_deadline_v3 — drop 2 dead vars + deactivate parent_feedback_request_v3
-- Reason: AiSensy template body uses 1 slot only ({{1}}=child_name).
--          DB had 3 vars; 2 (coach_first_name, deadline_time) are dead.
-- Rationale: Repurposed for coach SCF nudges (replaces broken
--             parent_feedback_request_v3 path).
-- Also: deactivate parent_feedback_request_v3 — no callers reference it after this deploy.
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql

BEGIN;

-- Pre-state assertion for coach_report_deadline_v3
DO $$
DECLARE
  pre_vars TEXT[];
BEGIN
  SELECT wa_variables INTO pre_vars
  FROM communication_templates
  WHERE template_code = 'coach_report_deadline_v3';

  IF array_length(pre_vars, 1) != 3 THEN
    RAISE EXCEPTION 'Pre-state mismatch: %', pre_vars;
  END IF;
END $$;

-- Trim coach_report_deadline_v3 to 1 slot
UPDATE communication_templates
SET wa_variables = ARRAY['child_name'],
    updated_at = NOW()
WHERE template_code = 'coach_report_deadline_v3';

-- Deactivate parent_feedback_request_v3 (no remaining callers post-deploy)
UPDATE communication_templates
SET is_active = false,
    updated_at = NOW()
WHERE template_code = 'parent_feedback_request_v3';

-- Post-state assertion
DO $$
DECLARE
  post_vars TEXT[];
  post_name TEXT;
  pfr_active BOOLEAN;
BEGIN
  SELECT wa_variables, wa_template_name INTO post_vars, post_name
  FROM communication_templates
  WHERE template_code = 'coach_report_deadline_v3';

  IF post_vars != ARRAY['child_name'] THEN
    RAISE EXCEPTION 'Post-state mismatch: %', post_vars;
  END IF;

  IF post_name != 'coach_report_deadline_v3' THEN
    RAISE EXCEPTION 'wa_template_name modified: %', post_name;
  END IF;

  SELECT is_active INTO pfr_active
  FROM communication_templates
  WHERE template_code = 'parent_feedback_request_v3';

  IF pfr_active THEN
    RAISE EXCEPTION 'parent_feedback_request_v3 still active — abort';
  END IF;
END $$;

COMMIT;
