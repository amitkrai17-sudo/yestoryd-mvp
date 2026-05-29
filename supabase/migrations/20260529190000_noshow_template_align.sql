-- Migration: WA-WIRE-NOSHOW
-- Flips parent_session_noshow_v3 to Lead Bot with the Meta-approved 2-slot body.
-- Companion to the route rewrite at app/api/sessions/[id]/missed/route.ts
-- (legacy /api/communication/send → sendNotification, notifyParent flag dropped).
-- Mirrors the shape of 20260529150000_parent_reminders_wiring.sql exactly.
-- Author: Claude Code
-- Date: 2026-05-29
-- Rollback: companion .down.sql

BEGIN;

-- ============================================================================
-- 1. Pre-state assertions
-- ============================================================================
DO $$
DECLARE
  ns_channel TEXT;
  ns_vars TEXT[];
BEGIN
  SELECT channel, wa_variables INTO ns_channel, ns_vars
    FROM communication_templates WHERE template_code='parent_session_noshow_v3';

  IF ns_channel != 'aisensy' THEN
    RAISE EXCEPTION 'parent_session_noshow_v3 pre-state channel: %', ns_channel;
  END IF;
  IF ns_vars != ARRAY['child_first_name'] THEN
    RAISE EXCEPTION 'parent_session_noshow_v3 pre-state wa_variables: %', ns_vars;
  END IF;
END $$;

-- ============================================================================
-- 2. UPDATE parent_session_noshow_v3 (2-slot plain, Lead Bot)
--    Meta body slots: {{1}}=child_first_name {{2}}=coach_first_name
-- ============================================================================
UPDATE communication_templates
SET channel = 'leadbot',
    wa_variables = ARRAY['child_first_name','coach_first_name'],
    required_variables = ARRAY['child_name','coach_name'],
    wa_variable_derivations = '{
      "child_first_name": {"source": "child_name", "transform": "first_word"},
      "coach_first_name": {"source": "coach_name", "transform": "first_word"}
    }'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_session_noshow_v3';

-- ============================================================================
-- 3. Post-state assertions
-- ============================================================================
DO $$
DECLARE
  ns_channel TEXT;
  ns_vars TEXT[];
  ns_req TEXT[];
BEGIN
  SELECT channel, wa_variables, required_variables INTO ns_channel, ns_vars, ns_req
    FROM communication_templates WHERE template_code='parent_session_noshow_v3';

  IF ns_channel != 'leadbot' THEN
    RAISE EXCEPTION 'noshow post channel: %', ns_channel;
  END IF;
  IF ns_vars != ARRAY['child_first_name','coach_first_name'] THEN
    RAISE EXCEPTION 'noshow post wa_variables: %', ns_vars;
  END IF;
  IF ns_req != ARRAY['child_name','coach_name'] THEN
    RAISE EXCEPTION 'noshow post required_variables: %', ns_req;
  END IF;
END $$;

COMMIT;
