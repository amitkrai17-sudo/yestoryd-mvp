-- Block B2-MEGA — Atomic cutover for 8 templates from aisensy to leadbot
--
-- Templates migrated:
--   1. parent_tuition_onboarding_v4  (Dynamic button → /parent/onboard/<token> via middleware)
--   2. parent_tuition_renewal_v3     (Dynamic button → /parent/topup/<id>, reuses B1 redirect)
--   3. parent_tuition_paused_v3      (Dynamic button → /parent/topup/<id>, reuses B1 redirect)
--   4. parent_practice_nudge_v3      (Static button → /parent/dashboard, hardcoded in Meta template)
--   5. parent_practice_tasks_v3      (Static button → /parent/dashboard)
--   6. parent_session_cancelled_v5   (No button)
--   7. parent_session_summary_v3     (No button)
--   8. parent_session_scheduled_v3   (No button — FIXES production "empty {{1}} slot" bug from S2)
--
-- Idempotent: WHERE channel='aisensy' makes re-runs no-op.

-- 1. parent_tuition_onboarding_v4
UPDATE communication_templates SET
  channel='leadbot',
  wa_variables=ARRAY['parent_first_name','child_first_name'],
  required_variables=ARRAY['parent_name','child_name'],
  wa_variable_derivations=jsonb_build_object(
    'parent_first_name', jsonb_build_object('source','parent_name','transform','first_word'),
    'child_first_name',  jsonb_build_object('source','child_name', 'transform','first_word')
  ),
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_tuition_onboarding_v4' AND channel='aisensy';

-- 2. parent_tuition_renewal_v3
UPDATE communication_templates SET
  channel='leadbot',
  wa_variables=ARRAY['parent_first_name','child_first_name'],
  required_variables=ARRAY['parent_name','child_name'],
  wa_variable_derivations=jsonb_build_object(
    'parent_first_name', jsonb_build_object('source','parent_name','transform','first_word'),
    'child_first_name',  jsonb_build_object('source','child_name', 'transform','first_word')
  ),
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_tuition_renewal_v3' AND channel='aisensy';

-- 3. parent_tuition_paused_v3
UPDATE communication_templates SET
  channel='leadbot',
  wa_variables=ARRAY['parent_first_name','child_first_name'],
  required_variables=ARRAY['parent_name','child_name'],
  wa_variable_derivations=jsonb_build_object(
    'parent_first_name', jsonb_build_object('source','parent_name','transform','first_word'),
    'child_first_name',  jsonb_build_object('source','child_name', 'transform','first_word')
  ),
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_tuition_paused_v3' AND channel='aisensy';

-- 4. parent_practice_nudge_v3 (already canonical names, just channel + cost flip)
UPDATE communication_templates SET
  channel='leadbot',
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_practice_nudge_v3' AND channel='aisensy';

-- 5. parent_practice_tasks_v3 (already canonical, channel + cost flip)
UPDATE communication_templates SET
  channel='leadbot',
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_practice_tasks_v3' AND channel='aisensy';

-- 6. parent_session_cancelled_v5
UPDATE communication_templates SET
  channel='leadbot',
  wa_variables=ARRAY['child_first_name','session_date','session_time','reason'],
  required_variables=ARRAY['child_name','session_date','session_time','reason'],
  wa_variable_derivations=jsonb_build_object(
    'child_first_name', jsonb_build_object('source','child_name','transform','first_word')
  ),
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_session_cancelled_v5' AND channel='aisensy';

-- 7. parent_session_summary_v3
UPDATE communication_templates SET
  channel='leadbot',
  wa_variables=ARRAY['child_first_name','coach_first_name','focus','progress'],
  required_variables=ARRAY['child_name','coach_name','focus','progress'],
  wa_variable_derivations=jsonb_build_object(
    'child_first_name', jsonb_build_object('source','child_name','transform','first_word'),
    'coach_first_name', jsonb_build_object('source','coach_name','transform','first_word')
  ),
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_session_summary_v3' AND channel='aisensy';

-- 8. parent_session_scheduled_v3 (FIXES production "empty slot" bug — wa_variables now aligns with buildVariables emission)
UPDATE communication_templates SET
  channel='leadbot',
  wa_variables=ARRAY['child_first_name','coach_first_name','session_date','session_time'],
  required_variables=ARRAY['child_name','coach_name','session_date','session_time'],
  wa_variable_derivations=jsonb_build_object(
    'child_first_name', jsonb_build_object('source','child_name','transform','first_word'),
    'coach_first_name', jsonb_build_object('source','coach_name','transform','first_word')
  ),
  cost_per_send=0.1200, updated_at=NOW()
WHERE template_code='parent_session_scheduled_v3' AND channel='aisensy';

-- Post-deploy verification (run manually via Supabase MCP execute_sql):
--   SELECT template_code, channel, wa_variables, required_variables, wa_variable_derivations, cost_per_send
--   FROM communication_templates
--   WHERE template_code IN (
--     'parent_tuition_onboarding_v4','parent_tuition_renewal_v3','parent_tuition_paused_v3',
--     'parent_practice_nudge_v3','parent_practice_tasks_v3','parent_session_cancelled_v5',
--     'parent_session_summary_v3','parent_session_scheduled_v3'
--   ) ORDER BY template_code;
