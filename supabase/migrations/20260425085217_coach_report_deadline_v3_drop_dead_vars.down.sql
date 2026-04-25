BEGIN;

UPDATE communication_templates
SET wa_variables = ARRAY['coach_first_name', 'child_name', 'deadline_time'],
    updated_at = NOW()
WHERE template_code = 'coach_report_deadline_v3';

UPDATE communication_templates
SET is_active = true,
    updated_at = NOW()
WHERE template_code = 'parent_feedback_request_v3';

COMMIT;
