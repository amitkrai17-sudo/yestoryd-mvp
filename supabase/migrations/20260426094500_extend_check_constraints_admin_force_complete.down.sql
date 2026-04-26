-- Rollback: remove 'admin_force_complete' and 'unknown' from CHECK constraints.
--
-- WARNING: this rollback will FAIL with 23514 if any rows currently use
-- the new enum values. Pre-clean those rows first:
--
--   DELETE FROM structured_capture_responses WHERE capture_method='admin_force_complete';
--   UPDATE structured_capture_responses SET engagement_level='low'
--     WHERE engagement_level='unknown';
--
-- Then run this rollback.

BEGIN;

ALTER TABLE structured_capture_responses
  DROP CONSTRAINT structured_capture_responses_capture_method_check;

ALTER TABLE structured_capture_responses
  ADD CONSTRAINT structured_capture_responses_capture_method_check
  CHECK (capture_method = ANY (ARRAY[
    'auto_filled'::text,
    'voice_to_structured'::text,
    'manual_structured'::text,
    'instructor_console'::text
  ]));

ALTER TABLE structured_capture_responses
  DROP CONSTRAINT structured_capture_responses_engagement_level_check;

ALTER TABLE structured_capture_responses
  ADD CONSTRAINT structured_capture_responses_engagement_level_check
  CHECK (engagement_level = ANY (ARRAY[
    'low'::text,
    'moderate'::text,
    'medium'::text,
    'high'::text,
    'exceptional'::text
  ]));

COMMIT;
