-- Migration: Align 4 templates with AiSensy bodies + backfill program_description
-- Affects:
--   parent_payment_confirmed_v3    (5 -> 4 vars: drop parent_first_name+amount+enrollment_id; rename slot 2; add plan, coach_name)
--   parent_reschedule_confirmed_v3 (rename child_name -> child_first_name)
--   parent_session_cancelled_v5    (rename child_name -> child_first_name)
--   parent_session_noshow_v3       (drop reschedule_link; rename child_name -> child_first_name)
-- ALSO: backfill enrollments.program_description = NULL (forces getProgramLabel canonical)
-- Strategy: In-place UPDATE. All templates dormant.
-- wa_template_name UNCHANGED for all four.
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql (templates only — program_description backfill irreversible)

BEGIN;

-- Pre-state assertions
DO $$
DECLARE
  pc_vars TEXT[];
  rs_vars TEXT[];
  cn_vars TEXT[];
  ns_vars TEXT[];
BEGIN
  SELECT wa_variables INTO pc_vars FROM communication_templates WHERE template_code='parent_payment_confirmed_v3';
  SELECT wa_variables INTO rs_vars FROM communication_templates WHERE template_code='parent_reschedule_confirmed_v3';
  SELECT wa_variables INTO cn_vars FROM communication_templates WHERE template_code='parent_session_cancelled_v5';
  SELECT wa_variables INTO ns_vars FROM communication_templates WHERE template_code='parent_session_noshow_v3';

  IF array_length(pc_vars, 1) != 5 THEN RAISE EXCEPTION 'parent_payment_confirmed_v3 pre: %', pc_vars; END IF;
  IF array_length(rs_vars, 1) != 4 THEN RAISE EXCEPTION 'parent_reschedule_confirmed_v3 pre: %', rs_vars; END IF;
  IF array_length(cn_vars, 1) != 4 THEN RAISE EXCEPTION 'parent_session_cancelled_v5 pre: %', cn_vars; END IF;
  IF array_length(ns_vars, 1) != 2 THEN RAISE EXCEPTION 'parent_session_noshow_v3 pre: %', ns_vars; END IF;
END $$;

-- 1. parent_payment_confirmed_v3
UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'plan', 'sessions_count', 'coach_name'],
    updated_at = NOW()
WHERE template_code = 'parent_payment_confirmed_v3';

-- 2. parent_reschedule_confirmed_v3
UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'new_date', 'new_time', 'coach_name'],
    updated_at = NOW()
WHERE template_code = 'parent_reschedule_confirmed_v3';

-- 3. parent_session_cancelled_v5
UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'session_date', 'session_time', 'reason'],
    updated_at = NOW()
WHERE template_code = 'parent_session_cancelled_v5';

-- 4. parent_session_noshow_v3
UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name'],
    updated_at = NOW()
WHERE template_code = 'parent_session_noshow_v3';

-- 5. Backfill program_description to NULL (forces getProgramLabel canonical)
UPDATE enrollments
SET program_description = NULL,
    updated_at = NOW()
WHERE program_description IS NOT NULL AND program_description != '';

-- Post-state assertions
DO $$
DECLARE
  pc_vars TEXT[];
  rs_vars TEXT[];
  cn_vars TEXT[];
  ns_vars TEXT[];
  desc_count INTEGER;
BEGIN
  SELECT wa_variables INTO pc_vars FROM communication_templates WHERE template_code='parent_payment_confirmed_v3';
  SELECT wa_variables INTO rs_vars FROM communication_templates WHERE template_code='parent_reschedule_confirmed_v3';
  SELECT wa_variables INTO cn_vars FROM communication_templates WHERE template_code='parent_session_cancelled_v5';
  SELECT wa_variables INTO ns_vars FROM communication_templates WHERE template_code='parent_session_noshow_v3';
  SELECT COUNT(*) INTO desc_count FROM enrollments WHERE program_description IS NOT NULL AND program_description != '';

  IF pc_vars != ARRAY['child_first_name','plan','sessions_count','coach_name'] THEN RAISE EXCEPTION 'pc post: %', pc_vars; END IF;
  IF rs_vars != ARRAY['child_first_name','new_date','new_time','coach_name'] THEN RAISE EXCEPTION 'rs post: %', rs_vars; END IF;
  IF cn_vars != ARRAY['child_first_name','session_date','session_time','reason'] THEN RAISE EXCEPTION 'cn post: %', cn_vars; END IF;
  IF ns_vars != ARRAY['child_first_name'] THEN RAISE EXCEPTION 'ns post: %', ns_vars; END IF;
  IF desc_count != 0 THEN RAISE EXCEPTION 'program_description still set on % rows', desc_count; END IF;
END $$;

COMMIT;
