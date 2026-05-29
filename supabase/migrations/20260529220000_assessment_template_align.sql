-- Migration: WA-FLIP-ASSESSMENT
-- Flips parent_assessment_results_v3 to Lead Bot Utility with the Meta-approved
-- 5-slot body + URL button shape. booking_link moves from a body slot to the
-- template's URL button tail (template-static base https://yestoryd.com/ +
-- send-time tail 'parent/assessment/<childId>').
-- Path A: caller keeps pre-deriving child_first_name; DB derivation map drops.
-- Mirrors the shape of 20260529190000_noshow_template_align.sql.
-- Author: Claude Code
-- Date: 2026-05-29
-- Rollback: companion .down.sql

BEGIN;

-- ============================================================================
-- 1. Pre-state assertions (per Claude Web's verified prod row)
-- ============================================================================
DO $$
DECLARE
  ar_channel  TEXT;
  ar_category TEXT;
  ar_vars     TEXT[];
BEGIN
  SELECT channel, wa_template_category, wa_variables
    INTO ar_channel, ar_category, ar_vars
    FROM communication_templates
   WHERE template_code = 'parent_assessment_results_v3';

  IF ar_channel != 'aisensy' THEN
    RAISE EXCEPTION 'parent_assessment_results_v3 pre-state channel: %', ar_channel;
  END IF;
  IF ar_category != 'marketing' THEN
    RAISE EXCEPTION 'parent_assessment_results_v3 pre-state category: %', ar_category;
  END IF;
  IF ar_vars != ARRAY['child_first_name','overall_score','clarity_score',
                      'fluency_score','speed_score','booking_link'] THEN
    RAISE EXCEPTION 'parent_assessment_results_v3 pre-state wa_variables: %', ar_vars;
  END IF;
END $$;

-- ============================================================================
-- 2. UPDATE parent_assessment_results_v3 — 5-slot body + URL button shape
--    Meta-approved body slots:
--      {{1}}=child_first_name  {{2}}=overall_score  {{3}}=clarity_score
--      {{4}}=fluency_score     {{5}}=speed_score
--    URL button: base https://yestoryd.com/ + send-time {{1}} tail
--                (e.g. 'parent/assessment/<childId>')
-- ============================================================================
UPDATE communication_templates
SET channel             = 'leadbot',
    wa_template_category = 'utility',
    wa_variables        = ARRAY['child_first_name','overall_score','clarity_score',
                                 'fluency_score','speed_score'],
    required_variables  = ARRAY['child_first_name','overall_score','clarity_score',
                                 'fluency_score','speed_score'],
    wa_variable_derivations = NULL,
    updated_at = NOW()
WHERE template_code = 'parent_assessment_results_v3';

-- ============================================================================
-- 3. Post-state assertions
-- ============================================================================
DO $$
DECLARE
  ar_channel  TEXT;
  ar_category TEXT;
  ar_vars     TEXT[];
  ar_req      TEXT[];
  ar_deriv    JSONB;
BEGIN
  SELECT channel, wa_template_category, wa_variables, required_variables, wa_variable_derivations
    INTO ar_channel, ar_category, ar_vars, ar_req, ar_deriv
    FROM communication_templates
   WHERE template_code = 'parent_assessment_results_v3';

  IF ar_channel != 'leadbot' THEN
    RAISE EXCEPTION 'assessment post channel: %', ar_channel;
  END IF;
  IF ar_category != 'utility' THEN
    RAISE EXCEPTION 'assessment post category: %', ar_category;
  END IF;
  IF ar_vars != ARRAY['child_first_name','overall_score','clarity_score',
                      'fluency_score','speed_score'] THEN
    RAISE EXCEPTION 'assessment post wa_variables: %', ar_vars;
  END IF;
  IF ar_req != ARRAY['child_first_name','overall_score','clarity_score',
                     'fluency_score','speed_score'] THEN
    RAISE EXCEPTION 'assessment post required_variables: %', ar_req;
  END IF;
  IF ar_deriv IS NOT NULL THEN
    RAISE EXCEPTION 'assessment post derivations should be NULL: %', ar_deriv;
  END IF;
END $$;

COMMIT;
