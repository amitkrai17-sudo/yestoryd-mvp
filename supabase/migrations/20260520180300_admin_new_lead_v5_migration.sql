-- Block ADMIN-LEAD-FIX — Migration for admin_new_lead_v5
-- Phase 2C of Block ADMIN-LEAD-FIX.
-- Replaces hand-run docs/wa-engine-backfill.sql:85-94 (Q7 finding 1).
-- See docs/CURRENT-STATE.md "2026-05-20 — admin_new_lead_v5" entry.

-- Step 1: Insert or update the admin_new_lead_v5 template row.
-- Idempotent: safe to re-run.
INSERT INTO communication_templates (
  template_code,
  name,
  recipient_type,
  use_whatsapp,
  use_email,
  wa_template_name,
  wa_template_category,
  language_code,
  wa_variables,
  required_variables,
  wa_variable_derivations,
  channel,
  cost_per_send,
  is_active
) VALUES (
  'admin_new_lead_v5',
  'Admin notification when a new assessment is completed by a parent.',
  'admin',
  true,
  false,
  'admin_new_lead_v5',
  'utility',
  'en',
  ARRAY['child_name', 'parent_name', 'parent_phone'],
  ARRAY['child_name', 'parent_name', 'parent_phone'],
  '{}'::jsonb,
  'leadbot',
  0.12,
  true
)
ON CONFLICT (template_code) DO UPDATE SET
  name                    = EXCLUDED.name,
  recipient_type          = EXCLUDED.recipient_type,
  use_whatsapp            = EXCLUDED.use_whatsapp,
  use_email               = EXCLUDED.use_email,
  wa_template_name        = EXCLUDED.wa_template_name,
  wa_template_category    = EXCLUDED.wa_template_category,
  language_code           = EXCLUDED.language_code,
  wa_variables            = EXCLUDED.wa_variables,
  required_variables      = EXCLUDED.required_variables,
  wa_variable_derivations = EXCLUDED.wa_variable_derivations,
  channel                 = EXCLUDED.channel,
  cost_per_send           = EXCLUDED.cost_per_send,
  is_active               = EXCLUDED.is_active,
  updated_at              = NOW();

-- Step 2: Deactivate the legacy admin_new_lead_v4 row.
-- Keep the row for audit trail (don't DELETE), just flip is_active to false.
UPDATE communication_templates
SET
  is_active = false,
  updated_at = NOW()
WHERE template_code = 'admin_new_lead_v4'
  AND is_active = true;

-- Step 3: Verify post-state.
-- The following queries can be run manually post-deploy to confirm:
--   SELECT template_code, is_active, channel, wa_template_category, wa_variables
--   FROM communication_templates
--   WHERE template_code IN ('admin_new_lead_v4', 'admin_new_lead_v5')
--   ORDER BY template_code;
-- Expected:
--   admin_new_lead_v4 | false | aisensy | <whatever it was> | <whatever it was>
--   admin_new_lead_v5 | true  | leadbot | utility           | {child_name, parent_name, parent_phone}
