BEGIN;
UPDATE communication_templates
SET is_active = true,
    updated_at = NOW()
WHERE template_code = 'parent_tuition_onboarding_v3';
COMMIT;
