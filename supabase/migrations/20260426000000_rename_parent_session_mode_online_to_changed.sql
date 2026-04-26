-- Migration: Rename parent_session_mode_online_v1 -> parent_session_mode_changed_v1
-- Reason: DB name didn't match AiSensy campaignName ('parent_session_mode_changed_v1')
-- Sends would have failed "Campaign does not exist" if fired
-- Slot mapping verified identical (5 vars, same order)
-- AiSensy body: "Hi {{1}}, {{2}}'s session has been changed to ONLINE..."

BEGIN;

DO $$
DECLARE
  old_exists BOOLEAN;
  new_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM communication_templates WHERE template_code='parent_session_mode_online_v1') INTO old_exists;
  SELECT EXISTS(SELECT 1 FROM communication_templates WHERE template_code='parent_session_mode_changed_v1') INTO new_exists;
  IF NOT old_exists THEN RAISE EXCEPTION 'parent_session_mode_online_v1 not found'; END IF;
  IF new_exists THEN RAISE EXCEPTION 'parent_session_mode_changed_v1 already exists'; END IF;
END $$;

UPDATE communication_templates
SET template_code = 'parent_session_mode_changed_v1',
    wa_template_name = 'parent_session_mode_changed_v1',
    updated_at = NOW()
WHERE template_code = 'parent_session_mode_online_v1';

DO $$
DECLARE
  rec_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rec_count
  FROM communication_templates
  WHERE template_code='parent_session_mode_changed_v1';
  IF rec_count != 1 THEN RAISE EXCEPTION 'Expected 1 row, got %', rec_count; END IF;

  SELECT COUNT(*) INTO rec_count
  FROM communication_templates
  WHERE template_code='parent_session_mode_online_v1';
  IF rec_count != 0 THEN RAISE EXCEPTION 'Old code still exists: %', rec_count; END IF;
END $$;

COMMIT;
