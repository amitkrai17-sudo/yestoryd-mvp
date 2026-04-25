BEGIN;

UPDATE communication_templates
SET wa_variables = ARRAY['parent_name','child_name','overall_score','clarity_score',
                          'fluency_score','speed_score','booking_link'],
    updated_at = NOW()
WHERE template_code = 'parent_assessment_results_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['coach_name','child_name','parent_name','scheduled_date',
                          'scheduled_time','meet_link'],
    updated_at = NOW()
WHERE template_code = 'coach_discovery_assigned';

UPDATE communication_templates
SET wa_variables = ARRAY['coach_name','parent_name','child_name','old_date','new_date','reason'],
    updated_at = NOW()
WHERE template_code = 'coach_reschedule_request_v3';

COMMIT;
