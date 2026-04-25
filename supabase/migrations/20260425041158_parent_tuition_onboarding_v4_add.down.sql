-- Rollback Migration A: delete parent_tuition_onboarding_v4
BEGIN;

DELETE FROM communication_templates
WHERE template_code = 'parent_tuition_onboarding_v4';

COMMIT;
