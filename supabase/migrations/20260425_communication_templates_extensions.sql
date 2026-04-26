-- ============================================================
-- Migration: communication_templates_extensions
-- Date: 2026-04-25
-- Adds wa_variable_derivations column, backfills required_variables,
-- enforces NOT NULL on required_variables, and backfills the 15
-- aliasing templates with derivation entries + req additions.
-- ============================================================
-- Companion rollback: 20260425_communication_templates_extensions_down.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PRE-CHECK: tolerance check on NULL required_variables count.
-- B1 audit found 26 active + 2 inactive = 28 NULL rows. Allow drift band 24-30.
-- ------------------------------------------------------------
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT count(*) INTO null_count FROM communication_templates WHERE required_variables IS NULL;
  IF null_count NOT BETWEEN 24 AND 30 THEN
    RAISE EXCEPTION 'NULL required_variables count = % outside expected band (24-30) - audit drift', null_count;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. ADD COLUMN wa_variable_derivations jsonb (nullable, no default)
-- ------------------------------------------------------------
ALTER TABLE communication_templates
  ADD COLUMN IF NOT EXISTS wa_variable_derivations jsonb;

-- ------------------------------------------------------------
-- 2. Backfill required_variables := wa_variables (or empty array) for NULL rows
-- ------------------------------------------------------------
UPDATE communication_templates
SET required_variables = COALESCE(wa_variables, ARRAY[]::text[])
WHERE required_variables IS NULL;

-- ------------------------------------------------------------
-- 3. Verify backfill: zero NULL rows remaining
-- ------------------------------------------------------------
DO $$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM communication_templates WHERE required_variables IS NULL;
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'After backfill, % rows still have NULL required_variables', remaining;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. ALTER required_variables: SET DEFAULT + SET NOT NULL
-- ------------------------------------------------------------
ALTER TABLE communication_templates
  ALTER COLUMN required_variables SET DEFAULT '{}'::text[],
  ALTER COLUMN required_variables SET NOT NULL;

-- ------------------------------------------------------------
-- 5. Backfill wa_variable_derivations + extend required_variables
--    for the 15 aliasing templates. Each UPDATE is explicit and verbose
--    for audit clarity.
-- ------------------------------------------------------------

-- 5.01 coach_child_assigned_v4 — pure aliasing
UPDATE communication_templates
SET wa_variable_derivations = '{"coach_first_name": {"source": "coach_name", "transform": "first_word"}}'::jsonb
WHERE template_code = 'coach_child_assigned_v4';

-- 5.02 coach_discovery_assigned — alias + 2 real adds
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['coach_name','child_name','scheduled_date','scheduled_time','parent_name','meet_link']::text[]
WHERE template_code = 'coach_discovery_assigned';

-- 5.03 coach_reschedule_request_v3 — pure aliasing (2 aliases)
UPDATE communication_templates
SET wa_variable_derivations = '{"coach_first_name": {"source": "coach_name", "transform": "first_word"}, "child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb
WHERE template_code = 'coach_reschedule_request_v3';

-- 5.04 enrollment_at_risk_admin — no aliases, 2 real adds
UPDATE communication_templates
SET required_variables = ARRAY['child_name','consecutive_no_shows','parent_name','total_no_shows']::text[]
WHERE template_code = 'enrollment_at_risk_admin';

-- 5.05 parent_assessment_results_v3 — alias + 4 real adds
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['parent_name','child_name','score','booking_link','overall_score','clarity_score','fluency_score','speed_score']::text[]
WHERE template_code = 'parent_assessment_results_v3';

-- 5.06 parent_coach_intro_v3 — 2 aliases + 1 real add (composite)
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}, "coach_first_name": {"source": "coach_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['parent_name','child_name','coach_name','coach_phone','first_session_date','first_session_time','session_datetime']::text[]
WHERE template_code = 'parent_coach_intro_v3';

-- 5.07 parent_discovery_booked_v3 — pure aliasing
UPDATE communication_templates
SET wa_variable_derivations = '{"parent_first_name": {"source": "parent_name", "transform": "first_word"}}'::jsonb
WHERE template_code = 'parent_discovery_booked_v3';

-- 5.08 parent_discovery_reminder_v3 — alias + 3 real adds
UPDATE communication_templates
SET wa_variable_derivations = '{"parent_first_name": {"source": "parent_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['parent_name','child_name','date','time','meet_link','coach_name','child_goal','payment_link']::text[]
WHERE template_code = 'parent_discovery_reminder_v3';

-- 5.09 parent_payment_confirmed_v3 — alias + 2 real adds
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['parent_name','child_name','amount','coach_name','dashboard_link','program_label','schedule_description','plan','sessions_count']::text[]
WHERE template_code = 'parent_payment_confirmed_v3';

-- 5.10 parent_reschedule_confirmed_v3 — alias + 1 real add
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['child_name','new_date','new_time','coach_name']::text[]
WHERE template_code = 'parent_reschedule_confirmed_v3';

-- 5.11 parent_session_cancelled_v5 — alias + 1 real add
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['child_name','session_date','session_time','reason']::text[]
WHERE template_code = 'parent_session_cancelled_v5';

-- 5.12 parent_session_noshow_v3 — pure aliasing
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb
WHERE template_code = 'parent_session_noshow_v3';

-- 5.13 parent_session_reminder_1h_v3 — pure aliasing
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb
WHERE template_code = 'parent_session_reminder_1h_v3';

-- 5.14 parent_session_reminder_24h_v3 — pure aliasing
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb
WHERE template_code = 'parent_session_reminder_24h_v3';

-- 5.15 parent_session_summary_v3 — 2 aliases + 2 real adds
UPDATE communication_templates
SET wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}, "coach_first_name": {"source": "coach_name", "transform": "first_word"}}'::jsonb,
    required_variables = ARRAY['parent_name','child_name','coach_name','topic','new_words','highlight','homework','recording_link','focus','progress']::text[]
WHERE template_code = 'parent_session_summary_v3';

-- ------------------------------------------------------------
-- 6. Verify backfill: 14 rows have wa_variable_derivations set.
--    (15 templates were touched in step 5; enrollment_at_risk_admin
--    only got a required_variables extension — no aliases.)
-- ------------------------------------------------------------
DO $$
DECLARE
  derivation_count int;
BEGIN
  SELECT count(*) INTO derivation_count FROM communication_templates WHERE wa_variable_derivations IS NOT NULL;
  IF derivation_count <> 14 THEN
    RAISE EXCEPTION 'Expected 14 templates with derivations, got %', derivation_count;
  END IF;
END $$;

COMMIT;
