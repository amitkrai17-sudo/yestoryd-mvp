-- Rollback: parent_tuition_payment_v3 — restore 6-var wa_variables
BEGIN;

UPDATE communication_templates
SET wa_variables = ARRAY['parent_first_name', 'child_full_name', 'sessions_purchased',
                          'rate_rupees', 'total_rupees', 'checkout_url'],
    updated_at = NOW()
WHERE template_code = 'parent_tuition_payment_v3';

COMMIT;
