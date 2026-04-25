-- Migration: Align 4 dormant parent-side templates with AiSensy bodies
-- Affects:
--   parent_coach_intro_v3            (4 vars -> 3, drop date+time, add session_datetime)
--   parent_session_reminder_1h_v3    (2 vars -> 2, rename child_name -> child_first_name)
--   parent_session_reminder_24h_v3   (5 vars -> 3, drop date+meet_link, rename child_name)
--   parent_session_summary_v3        (4 vars -> 4, drop homework, add coach_first_name, rename topic+highlight)
-- Strategy: In-place UPDATE. All 4 dormant.
-- Note: 3 templates (parent_coach_intro_v3, parent_session_reminder_1h_v3, parent_session_reminder_24h_v3)
--       currently have NO callers. Migration is DB hygiene only.
-- wa_template_name UNCHANGED for all four.
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql

BEGIN;

-- Pre-state assertions
DO $$
DECLARE
  ci_vars TEXT[];
  r1_vars TEXT[];
  r24_vars TEXT[];
  ss_vars TEXT[];
BEGIN
  SELECT wa_variables INTO ci_vars FROM communication_templates WHERE template_code='parent_coach_intro_v3';
  SELECT wa_variables INTO r1_vars FROM communication_templates WHERE template_code='parent_session_reminder_1h_v3';
  SELECT wa_variables INTO r24_vars FROM communication_templates WHERE template_code='parent_session_reminder_24h_v3';
  SELECT wa_variables INTO ss_vars FROM communication_templates WHERE template_code='parent_session_summary_v3';

  IF array_length(ci_vars, 1) != 4 THEN RAISE EXCEPTION 'parent_coach_intro_v3 pre-state: %', ci_vars; END IF;
  IF array_length(r1_vars, 1) != 2 THEN RAISE EXCEPTION 'parent_session_reminder_1h_v3 pre-state: %', r1_vars; END IF;
  IF array_length(r24_vars, 1) != 5 THEN RAISE EXCEPTION 'parent_session_reminder_24h_v3 pre-state: %', r24_vars; END IF;
  IF array_length(ss_vars, 1) != 4 THEN RAISE EXCEPTION 'parent_session_summary_v3 pre-state: %', ss_vars; END IF;
END $$;

UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'coach_first_name', 'session_datetime'],
    updated_at = NOW()
WHERE template_code = 'parent_coach_intro_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'meet_link'],
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_1h_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'time', 'coach_name'],
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_24h_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_first_name', 'coach_first_name', 'focus', 'progress'],
    updated_at = NOW()
WHERE template_code = 'parent_session_summary_v3';

-- Post-state assertions
DO $$
DECLARE
  ci_vars TEXT[];
  r1_vars TEXT[];
  r24_vars TEXT[];
  ss_vars TEXT[];
BEGIN
  SELECT wa_variables INTO ci_vars FROM communication_templates WHERE template_code='parent_coach_intro_v3';
  SELECT wa_variables INTO r1_vars FROM communication_templates WHERE template_code='parent_session_reminder_1h_v3';
  SELECT wa_variables INTO r24_vars FROM communication_templates WHERE template_code='parent_session_reminder_24h_v3';
  SELECT wa_variables INTO ss_vars FROM communication_templates WHERE template_code='parent_session_summary_v3';

  IF ci_vars != ARRAY['child_first_name','coach_first_name','session_datetime'] THEN RAISE EXCEPTION 'parent_coach_intro_v3 post: %', ci_vars; END IF;
  IF r1_vars != ARRAY['child_first_name','meet_link'] THEN RAISE EXCEPTION 'parent_session_reminder_1h_v3 post: %', r1_vars; END IF;
  IF r24_vars != ARRAY['child_first_name','time','coach_name'] THEN RAISE EXCEPTION 'parent_session_reminder_24h_v3 post: %', r24_vars; END IF;
  IF ss_vars != ARRAY['child_first_name','coach_first_name','focus','progress'] THEN RAISE EXCEPTION 'parent_session_summary_v3 post: %', ss_vars; END IF;
END $$;

COMMIT;
