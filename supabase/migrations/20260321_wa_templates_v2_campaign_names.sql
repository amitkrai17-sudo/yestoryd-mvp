-- Switch WA templates to v2 campaign names with correct variable counts.
-- v2 templates have static phone buttons (no wa.me variables needed).

-- discovery_booked → discovery_booked_v2 (4 vars: parent_first_name, child_name, date, time)
UPDATE communication_templates
SET wa_template_name = 'discovery_booked_v2',
    wa_variables = ARRAY['parent_first_name', 'child_name', 'date', 'time'],
    updated_at = now()
WHERE template_code = 'P6_discovery_booked';

-- payment_received → payment_received_v2 (5 vars: parent_first_name, amount, child_name, enrollment_id, sessions_count)
UPDATE communication_templates
SET wa_template_name = 'payment_received_v2',
    wa_variables = ARRAY['parent_first_name', 'amount', 'child_name', 'enrollment_id', 'sessions_count'],
    updated_at = now()
WHERE template_code = 'P14_payment_confirmed';

-- reschedule_confirmed → reschedule_confirmed_v2 (4 vars: parent_first_name, child_name, new_date, new_time)
UPDATE communication_templates
SET wa_template_name = 'reschedule_confirmed_v2',
    wa_variables = ARRAY['parent_first_name', 'child_name', 'new_date', 'new_time'],
    updated_at = now()
WHERE template_code = 'R3_reschedule_confirmed';
