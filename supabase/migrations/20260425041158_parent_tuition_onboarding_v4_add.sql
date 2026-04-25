-- Migration A — additive only: insert parent_tuition_onboarding_v4
-- Purpose: Create v4 row alongside still-active v3. v4 has 3 vars
--          (parent_first_name, child_name, magic_link) vs v3's misleading
--          [coach_first_name, child_name, magic_link]. Assumes AiSensy
--          campaign re-registered with parent-name greeting and static
--          (non-variable) "Complete registration" button.
-- Pairing: This is Migration A (insert v4). Migration B (deactivate v3)
--          ships separately and runs only after v4 sends verified in
--          production for >= 24h with zero failures.
-- Author:
-- Date: 2026-04-25 (IST)
-- Rollback: companion .down.sql (DELETE v4 row)
--
-- NOTE: user spec listed column `category`; actual schema uses
--       `wa_template_category`. Substituted to match real schema. Verify
--       before apply.

BEGIN;

-- 1. Insert v4 row, copy most non-null fields from v3 to preserve fallback
--    channels, routing config, journey metadata, window rules, etc.
INSERT INTO communication_templates (
  template_code,
  wa_template_name,
  wa_variables,
  required_variables,
  channel,
  channels,
  is_active,
  wa_approved,
  use_whatsapp,
  use_email,
  use_sms,
  email_subject,
  email_body_html,
  email_sendgrid_template_id,
  sms_body,
  wa_template_category,
  description,
  trigger_contexts,
  coach_can_trigger,
  admin_can_trigger,
  recipient_type,
  priority,
  meta_category,
  cost_tier,
  cost_per_send,
  routing_rules,
  push_config,
  in_app_config,
  journey,
  stage,
  notes,
  delay_minutes,
  send_window_start,
  send_window_end,
  respect_window,
  name,
  created_by,
  created_at,
  updated_at
)
SELECT
  'parent_tuition_onboarding_v4'                              AS template_code,
  'parent_tuition_onboarding_v4'                              AS wa_template_name,
  ARRAY['parent_first_name', 'child_name', 'magic_link']      AS wa_variables,
  required_variables,
  channel,
  channels,
  true                                                         AS is_active,
  true                                                         AS wa_approved,
  use_whatsapp,
  use_email,
  use_sms,
  email_subject,
  email_body_html,
  email_sendgrid_template_id,
  sms_body,
  wa_template_category,
  description,
  trigger_contexts,
  coach_can_trigger,
  admin_can_trigger,
  recipient_type,
  priority,
  meta_category,
  cost_tier,
  cost_per_send,
  routing_rules,
  push_config,
  in_app_config,
  journey,
  stage,
  notes,
  delay_minutes,
  send_window_start,
  send_window_end,
  respect_window,
  'Parent Tuition Onboarding v4'                               AS name,
  NULL::varchar                                                AS created_by,
  NOW()                                                        AS created_at,
  NOW()                                                        AS updated_at
FROM communication_templates
WHERE template_code = 'parent_tuition_onboarding_v3';

-- 2. Verify v4 inserted correctly
DO $$
DECLARE
  v4_active BOOLEAN;
  v4_vars TEXT[];
BEGIN
  SELECT is_active, wa_variables INTO v4_active, v4_vars
    FROM communication_templates
    WHERE template_code = 'parent_tuition_onboarding_v4';

  IF NOT v4_active THEN
    RAISE EXCEPTION 'v4 not active — abort';
  END IF;

  IF v4_vars != ARRAY['parent_first_name', 'child_name', 'magic_link'] THEN
    RAISE EXCEPTION 'v4 wa_variables mismatch: %', v4_vars;
  END IF;
END $$;

COMMIT;
