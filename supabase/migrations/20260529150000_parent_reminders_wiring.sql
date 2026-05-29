-- Migration: WA-WIRE-REMINDERS
-- Adds dedup columns parent_reminder_{24h,1h}_sent (+ timestamps) on
-- scheduled_sessions, flips parent_session_reminder_24h_v3 + parent_session_reminder_1h_v3
-- to Lead Bot with the Meta-approved Pattern-B shapes.
-- parent_session_reminder_1h_online_v1 is UNDER REVIEW at Meta — NOT touched here.
-- Follow-up migration after _online_v1 approves: 1 row UPDATE + flip
-- ONLINE_1H_TEMPLATE_LIVE in app/api/cron/parent-reminders-1h/route.ts.
-- Author: Claude Code
-- Date: 2026-05-29
-- Rollback: companion .down.sql

BEGIN;

-- ============================================================================
-- 1. ALTER TABLE scheduled_sessions — add dedup columns (mirrors coach_reminder_1h_*)
-- ============================================================================
ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS parent_reminder_24h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_reminder_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_reminder_1h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_reminder_1h_sent_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Pre-state assertions (mirroring 20260425104010_4_dormant_parent_templates_align.sql)
-- ============================================================================
DO $$
DECLARE
  r24_channel TEXT;
  r24_vars TEXT[];
  r1_channel TEXT;
  r1_vars TEXT[];
BEGIN
  SELECT channel, wa_variables INTO r24_channel, r24_vars
    FROM communication_templates WHERE template_code='parent_session_reminder_24h_v3';
  SELECT channel, wa_variables INTO r1_channel, r1_vars
    FROM communication_templates WHERE template_code='parent_session_reminder_1h_v3';

  IF r24_channel != 'aisensy' THEN
    RAISE EXCEPTION 'parent_session_reminder_24h_v3 pre-state channel: %', r24_channel;
  END IF;
  IF r24_vars != ARRAY['child_first_name','time','coach_name'] THEN
    RAISE EXCEPTION 'parent_session_reminder_24h_v3 pre-state wa_variables: %', r24_vars;
  END IF;

  IF r1_channel != 'aisensy' THEN
    RAISE EXCEPTION 'parent_session_reminder_1h_v3 pre-state channel: %', r1_channel;
  END IF;
  IF r1_vars != ARRAY['child_first_name','meet_link'] THEN
    RAISE EXCEPTION 'parent_session_reminder_1h_v3 pre-state wa_variables: %', r1_vars;
  END IF;
END $$;

-- ============================================================================
-- 3. UPDATE parent_session_reminder_24h_v3 (4-slot plain, Lead Bot)
--    Meta body: Reminder: {{1}}'s next English class is tomorrow at {{2}} with
--    coach {{3}}. Please have {{4}} ready a few minutes before the start time...
--    Slots: {{1}}=child_first_name {{2}}=time {{3}}=coach_first_name {{4}}=child_first_name (repeat)
-- ============================================================================
UPDATE communication_templates
SET channel = 'leadbot',
    wa_variables = ARRAY['child_first_name','time','coach_first_name','child_first_name_2'],
    required_variables = ARRAY['child_name','time','coach_name'],
    wa_variable_derivations = '{
      "child_first_name":   {"source": "child_name", "transform": "first_word"},
      "coach_first_name":   {"source": "coach_name", "transform": "first_word"},
      "child_first_name_2": {"source": "child_name", "transform": "first_word"}
    }'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_24h_v3';

-- ============================================================================
-- 4. UPDATE parent_session_reminder_1h_v3 (3-slot plain, OFFLINE, Lead Bot)
--    Meta body: 3 slots — {{1}}=child_first_name {{2}}=coach_first_name {{3}}=child_first_name (repeat)
-- ============================================================================
UPDATE communication_templates
SET channel = 'leadbot',
    wa_variables = ARRAY['child_first_name','coach_first_name','child_first_name_2'],
    required_variables = ARRAY['child_name','coach_name'],
    wa_variable_derivations = '{
      "child_first_name":   {"source": "child_name", "transform": "first_word"},
      "coach_first_name":   {"source": "coach_name", "transform": "first_word"},
      "child_first_name_2": {"source": "child_name", "transform": "first_word"}
    }'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_1h_v3';

-- ============================================================================
-- NOTE: parent_session_reminder_1h_online_v1 is UNDER REVIEW at Meta.
--       Do NOT flip its channel here. Follow-up migration after approval.
-- ============================================================================

-- ============================================================================
-- 5. Post-state assertions
-- ============================================================================
DO $$
DECLARE
  r24_channel TEXT;
  r24_vars TEXT[];
  r24_req TEXT[];
  r1_channel TEXT;
  r1_vars TEXT[];
  r1_req TEXT[];
BEGIN
  SELECT channel, wa_variables, required_variables INTO r24_channel, r24_vars, r24_req
    FROM communication_templates WHERE template_code='parent_session_reminder_24h_v3';
  SELECT channel, wa_variables, required_variables INTO r1_channel, r1_vars, r1_req
    FROM communication_templates WHERE template_code='parent_session_reminder_1h_v3';

  IF r24_channel != 'leadbot' THEN
    RAISE EXCEPTION '24h post channel: %', r24_channel;
  END IF;
  IF r24_vars != ARRAY['child_first_name','time','coach_first_name','child_first_name_2'] THEN
    RAISE EXCEPTION '24h post wa_variables: %', r24_vars;
  END IF;
  IF r24_req != ARRAY['child_name','time','coach_name'] THEN
    RAISE EXCEPTION '24h post required_variables: %', r24_req;
  END IF;

  IF r1_channel != 'leadbot' THEN
    RAISE EXCEPTION '1h post channel: %', r1_channel;
  END IF;
  IF r1_vars != ARRAY['child_first_name','coach_first_name','child_first_name_2'] THEN
    RAISE EXCEPTION '1h post wa_variables: %', r1_vars;
  END IF;
  IF r1_req != ARRAY['child_name','coach_name'] THEN
    RAISE EXCEPTION '1h post required_variables: %', r1_req;
  END IF;
END $$;

COMMIT;
