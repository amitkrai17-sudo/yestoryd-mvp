BEGIN;

UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name','child_name','new_balance','renewal_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_low_balance_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name','child_name','sessions_purchased','coach_name','child_name_2','renewal_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_renewal_v3';

UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name','child_name','renewal_url','child_name_2'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_paused_v3';

COMMIT;
