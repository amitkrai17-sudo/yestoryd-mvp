-- Already applied to prod via MCP on 2026-05-31. Idempotent placeholder for repo audit trail /
-- fresh-env replay. Records the coach lead-tracking columns + admin alert template.

ALTER TABLE public.coach_applications
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS utm jsonb;

INSERT INTO communication_templates (
  template_code, name, recipient_type, channel,
  wa_template_name, wa_template_category, meta_category, cost_tier,
  required_variables, wa_variables, wa_variable_derivations,
  use_whatsapp, use_email, wa_approved, is_active,
  priority, admin_can_trigger, language_code
)
SELECT 'admin_coach_lead_v1','Admin — New Coach Lead','admin','leadbot',
  'admin_coach_lead_v1','utility','utility','standard',
  ARRAY['coach_name','phone','city','note']::text[],
  ARRAY['coach_name','phone','city','note']::text[],
  '{}'::jsonb, true, false, false, true, 5, true, 'en'
WHERE NOT EXISTS (SELECT 1 FROM communication_templates WHERE template_code='admin_coach_lead_v1');
