-- Note: program_description backfill is NOT reversible (data loss).
-- Down migration restores wa_variables only.

BEGIN;

UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name','amount','child_name','enrollment_id','sessions_count'],
    updated_at = NOW()
WHERE template_code = 'parent_payment_confirmed_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','new_date','new_time','coach_name'],
    updated_at = NOW()
WHERE template_code = 'parent_reschedule_confirmed_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','session_date','session_time','reason'],
    updated_at = NOW()
WHERE template_code = 'parent_session_cancelled_v5';

UPDATE communication_templates
SET wa_variables = ARRAY['child_name','reschedule_link'],
    updated_at = NOW()
WHERE template_code = 'parent_session_noshow_v3';

COMMIT;
