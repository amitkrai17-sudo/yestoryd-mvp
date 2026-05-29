-- Rollback for 20260529220000_assessment_template_align.sql
-- Restores parent_assessment_results_v3 to the Apr-25 shape (post 20260425100523):
-- channel='aisensy', category='marketing', 6-slot wa_variables incl booking_link,
-- 1-key child_first_name derivation. required_variables restored to the
-- pre-Path-A 8-element legacy shape (parent_name+child_name+score legacy + the
-- 5 wa slots that survived).

BEGIN;

UPDATE communication_templates
SET channel              = 'aisensy',
    wa_template_category = 'marketing',
    wa_variables         = ARRAY['child_first_name','overall_score','clarity_score',
                                  'fluency_score','speed_score','booking_link'],
    required_variables   = ARRAY['parent_name','child_name','score','booking_link',
                                  'overall_score','clarity_score','fluency_score','speed_score'],
    wa_variable_derivations = '{"child_first_name": {"source": "child_name", "transform": "first_word"}}'::jsonb,
    updated_at = NOW()
WHERE template_code = 'parent_assessment_results_v3';

COMMIT;
