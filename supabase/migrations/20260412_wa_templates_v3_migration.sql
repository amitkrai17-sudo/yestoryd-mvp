-- Migration: 20260412_wa_templates_v3_migration
-- Purpose: Switch all communication_templates.wa_template_name values to new v3
--          AiSensy campaign names after Meta approval. Only wa_template_name
--          changes — template_code PKs remain untouched.
-- Related: Full WhatsApp template migration (items 33-42)
-- Author: Claude Code / Amit

-- Item 33: P6_discovery_booked → parent_discovery_booked_v3
UPDATE communication_templates
SET wa_template_name = 'parent_discovery_booked_v3',
    updated_at = NOW()
WHERE template_code = 'P6_discovery_booked';

-- Item 34: P14_payment_confirmed → parent_payment_confirmed_v3
UPDATE communication_templates
SET wa_template_name = 'parent_payment_confirmed_v3',
    updated_at = NOW()
WHERE template_code = 'P14_payment_confirmed';

-- Item 35: R3_reschedule_confirmed → parent_reschedule_confirmed_v3
UPDATE communication_templates
SET wa_template_name = 'parent_reschedule_confirmed_v3',
    updated_at = NOW()
WHERE template_code = 'R3_reschedule_confirmed';

-- Item 36: P_session_cancelled → parent_session_cancelled_v3
UPDATE communication_templates
SET wa_template_name = 'parent_session_cancelled_v3',
    updated_at = NOW()
WHERE template_code = 'P_session_cancelled';

-- Item 37: P23_session_noshow → parent_session_noshow_v3
UPDATE communication_templates
SET wa_template_name = 'parent_session_noshow_v3',
    updated_at = NOW()
WHERE template_code = 'P23_session_noshow';

-- Item 38: P22_practice_tasks_assigned → parent_practice_tasks_v3
--         Also enable WhatsApp sending (was email-only while template pending).
UPDATE communication_templates
SET wa_template_name = 'parent_practice_tasks_v3',
    use_whatsapp = true,
    wa_approved = true,
    updated_at = NOW()
WHERE template_code = 'P22_practice_tasks_assigned';

-- Item 39: practice_nudge → parent_practice_nudge_v3
UPDATE communication_templates
SET wa_template_name = 'parent_practice_nudge_v3',
    updated_at = NOW()
WHERE template_code = 'practice_nudge';

-- Item 40: group_class_reminder_24h → parent_group_reminder_24h_v3
UPDATE communication_templates
SET wa_template_name = 'parent_group_reminder_24h_v3',
    updated_at = NOW()
WHERE template_code = 'group_class_reminder_24h';

-- Item 41: group_class_reminder_1h → parent_group_reminder_1h_v3
UPDATE communication_templates
SET wa_template_name = 'parent_group_reminder_1h_v3',
    updated_at = NOW()
WHERE template_code = 'group_class_reminder_1h';

-- Item 42: group_class_parent_feedback_request → parent_group_feedback_v3
UPDATE communication_templates
SET wa_template_name = 'parent_group_feedback_v3',
    updated_at = NOW()
WHERE template_code = 'group_class_parent_feedback_request';
