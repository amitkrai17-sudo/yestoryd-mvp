BEGIN;
UPDATE communication_templates
SET template_code = 'parent_session_mode_online_v1',
    wa_template_name = 'parent_session_mode_online_v1',
    updated_at = NOW()
WHERE template_code = 'parent_session_mode_changed_v1';
COMMIT;
