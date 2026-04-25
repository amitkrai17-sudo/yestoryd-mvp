BEGIN;

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','coach_name','first_session_date','first_session_time'],
    updated_at = NOW()
WHERE template_code = 'parent_coach_intro_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','meet_link'],
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_1h_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','coach_name','date','time','meet_link'],
    updated_at = NOW()
WHERE template_code = 'parent_session_reminder_24h_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','topic','highlight','homework'],
    updated_at = NOW()
WHERE template_code = 'parent_session_summary_v3';

COMMIT;
