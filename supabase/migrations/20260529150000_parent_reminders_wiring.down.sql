-- Rollback for 20260529150000_parent_reminders_wiring.sql
-- Restores template rows to their pre-migration state and drops the dedup columns.

BEGIN;

-- Revert parent_session_reminder_24h_v3 to AiSensy + pre-migration vars
UPDATE communication_templates
SET channel = 'aisensy',
    wa_variables = ARRAY['child_first_name','time','coach_name'],
    required_variables = ARRAY['parent_name','child_name','coach_name','date','time','meet_link'],
    wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_24h_v3';

-- Revert parent_session_reminder_1h_v3 to AiSensy + pre-migration vars
UPDATE communication_templates
SET channel = 'aisensy',
    wa_variables = ARRAY['child_first_name','meet_link'],
    wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_1h_v3';

-- Drop dedup columns
ALTER TABLE scheduled_sessions
  DROP COLUMN IF EXISTS parent_reminder_24h_sent,
  DROP COLUMN IF EXISTS parent_reminder_24h_sent_at,
  DROP COLUMN IF EXISTS parent_reminder_1h_sent,
  DROP COLUMN IF EXISTS parent_reminder_1h_sent_at;

COMMIT;
