-- Rollback for 20260529190000_noshow_template_align.sql
-- Restores parent_session_noshow_v3 to its pre-migration state.

BEGIN;

UPDATE communication_templates
SET channel = 'aisensy',
    wa_variables = ARRAY['child_first_name'],
    wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_session_noshow_v3';

COMMIT;
