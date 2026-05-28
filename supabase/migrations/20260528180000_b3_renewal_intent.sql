-- BATCH-3-INBOUND: parent renewal intent capture columns + 2 template seeds

-- 1. New columns on enrollments (parent_-prefixed to avoid collision with
--    existing renewal_intent column used for coach-side state)
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS parent_renewal_check_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_renewal_decision TEXT,
  ADD COLUMN IF NOT EXISTS parent_renewal_decision_at TIMESTAMPTZ;

-- 2. CHECK constraint on parent_renewal_decision values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_parent_renewal_decision_check') THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_parent_renewal_decision_check
      CHECK (parent_renewal_decision IS NULL
             OR parent_renewal_decision IN ('yes_renew','pause_for_now','talk_to_coach'));
  END IF;
END $$;

-- 3. Seed parent_renewal_intent_v1 template (idempotent)
INSERT INTO communication_templates (
  template_code, channel, is_active, use_whatsapp,
  wa_template_name, wa_template_category, language_code,
  wa_variables, required_variables, wa_variable_derivations,
  cost_per_send, created_at, updated_at
) VALUES (
  'parent_renewal_intent_v1', 'leadbot', true, true,
  'parent_renewal_intent_v1', 'utility', 'en',
  ARRAY['parent_first_name','child_first_name'],
  ARRAY['parent_name','child_name'],
  jsonb_build_object(
    'parent_first_name', jsonb_build_object('source','parent_name','transform','first_word'),
    'child_first_name',  jsonb_build_object('source','child_name', 'transform','first_word')
  ),
  0.1200, NOW(), NOW()
) ON CONFLICT (template_code) DO NOTHING;

-- 4. Seed coach_parent_callback_request_v1 template (idempotent)
INSERT INTO communication_templates (
  template_code, channel, is_active, use_whatsapp,
  wa_template_name, wa_template_category, language_code,
  wa_variables, required_variables, wa_variable_derivations,
  cost_per_send, created_at, updated_at
) VALUES (
  'coach_parent_callback_request_v1', 'leadbot', true, true,
  'coach_parent_callback_request_v1', 'utility', 'en',
  ARRAY['coach_first_name','parent_name','child_name','parent_phone'],
  ARRAY['coach_name','parent_name','child_name','parent_phone'],
  jsonb_build_object(
    'coach_first_name', jsonb_build_object('source','coach_name','transform','first_word')
  ),
  0.1200, NOW(), NOW()
) ON CONFLICT (template_code) DO NOTHING;

-- Post-deploy verification (run manually via Supabase MCP execute_sql):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='enrollments'
--     AND column_name LIKE 'parent_renewal%';
--
--   SELECT template_code, channel, wa_variables, required_variables
--   FROM communication_templates
--   WHERE template_code IN ('parent_renewal_intent_v1','coach_parent_callback_request_v1');
