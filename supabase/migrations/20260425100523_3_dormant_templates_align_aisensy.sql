-- Migration: Align 3 dormant templates with AiSensy bodies
-- Affects: parent_assessment_results_v3 (drop parent_name + rename slot 2)
--          coach_discovery_assigned (drop coach_name + rename slot 2)
--          coach_reschedule_request_v3 (rename slots 1+3, count unchanged)
-- Strategy: In-place UPDATE. All 3 dormant (zero send history in 30 days).
-- wa_template_name UNCHANGED for all three.
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql

BEGIN;

-- Pre-state assertion
DO $$
DECLARE
  ar_vars TEXT[];
  cd_vars TEXT[];
  cr_vars TEXT[];
BEGIN
  SELECT wa_variables INTO ar_vars FROM communication_templates
  WHERE template_code = 'parent_assessment_results_v3';
  SELECT wa_variables INTO cd_vars FROM communication_templates
  WHERE template_code = 'coach_discovery_assigned';
  SELECT wa_variables INTO cr_vars FROM communication_templates
  WHERE template_code = 'coach_reschedule_request_v3';

  IF array_length(ar_vars, 1) != 7 THEN
    RAISE EXCEPTION 'parent_assessment_results_v3 pre-state mismatch: %', ar_vars;
  END IF;
  IF array_length(cd_vars, 1) != 6 THEN
    RAISE EXCEPTION 'coach_discovery_assigned pre-state mismatch: %', cd_vars;
  END IF;
  IF array_length(cr_vars, 1) != 6 THEN
    RAISE EXCEPTION 'coach_reschedule_request_v3 pre-state mismatch: %', cr_vars;
  END IF;
END $$;

-- 1. parent_assessment_results_v3: drop parent_name, rename child_name -> child_first_name
UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'overall_score', 'clarity_score',
                          'fluency_score', 'speed_score', 'booking_link'],
    updated_at = NOW()
WHERE template_code = 'parent_assessment_results_v3';

-- 2. coach_discovery_assigned: drop coach_name, rename child_name -> child_first_name
UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'parent_name', 'scheduled_date',
                          'scheduled_time', 'meet_link'],
    updated_at = NOW()
WHERE template_code = 'coach_discovery_assigned';

-- 3. coach_reschedule_request_v3: rename coach_name -> coach_first_name, child_name -> child_first_name
UPDATE communication_templates
SET wa_variables = ARRAY['coach_first_name', 'parent_name', 'child_first_name',
                          'old_date', 'new_date', 'reason'],
    updated_at = NOW()
WHERE template_code = 'coach_reschedule_request_v3';

-- Post-state assertion
DO $$
DECLARE
  ar_vars TEXT[];
  cd_vars TEXT[];
  cr_vars TEXT[];
  ar_name TEXT;
  cd_name TEXT;
  cr_name TEXT;
BEGIN
  SELECT wa_variables, wa_template_name INTO ar_vars, ar_name
  FROM communication_templates WHERE template_code = 'parent_assessment_results_v3';
  SELECT wa_variables, wa_template_name INTO cd_vars, cd_name
  FROM communication_templates WHERE template_code = 'coach_discovery_assigned';
  SELECT wa_variables, wa_template_name INTO cr_vars, cr_name
  FROM communication_templates WHERE template_code = 'coach_reschedule_request_v3';

  IF ar_vars != ARRAY['child_first_name','overall_score','clarity_score','fluency_score','speed_score','booking_link'] THEN
    RAISE EXCEPTION 'parent_assessment_results_v3 post-state mismatch: %', ar_vars;
  END IF;
  IF cd_vars != ARRAY['child_first_name','parent_name','scheduled_date','scheduled_time','meet_link'] THEN
    RAISE EXCEPTION 'coach_discovery_assigned post-state mismatch: %', cd_vars;
  END IF;
  IF cr_vars != ARRAY['coach_first_name','parent_name','child_first_name','old_date','new_date','reason'] THEN
    RAISE EXCEPTION 'coach_reschedule_request_v3 post-state mismatch: %', cr_vars;
  END IF;

  IF ar_name != 'parent_assessment_results_v3' OR
     cd_name != 'coach_discovery_assigned' OR
     cr_name != 'coach_reschedule_request_v3' THEN
    RAISE EXCEPTION 'wa_template_name modified for one of the templates';
  END IF;
END $$;

COMMIT;
