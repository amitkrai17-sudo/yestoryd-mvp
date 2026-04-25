-- Migration B: Deactivate parent_tuition_onboarding_v3
-- PREREQUISITE: Migration A applied + v4 sends verified in production
-- for at least 24h with zero failures.
-- Safety: rollback by reactivating v3.

BEGIN;

-- Pre-check: v4 must be active before we kill v3
DO $$
DECLARE
  v4_active BOOLEAN;
BEGIN
  SELECT is_active INTO v4_active
    FROM communication_templates
    WHERE template_code = 'parent_tuition_onboarding_v4';
  IF v4_active IS NULL OR v4_active = false THEN
    RAISE EXCEPTION 'v4 not active — cannot deactivate v3';
  END IF;
END $$;

-- Deactivate v3
UPDATE communication_templates
SET is_active = false,
    updated_at = NOW()
WHERE template_code = 'parent_tuition_onboarding_v3';

-- Verify deactivation
DO $$
DECLARE
  v3_active BOOLEAN;
BEGIN
  SELECT is_active INTO v3_active
    FROM communication_templates
    WHERE template_code = 'parent_tuition_onboarding_v3';
  IF v3_active THEN
    RAISE EXCEPTION 'v3 still active — abort';
  END IF;
END $$;

COMMIT;
