-- Migration: Extend CHECK constraints for admin force-complete path
-- ================================================================
-- Adds two new enum values used exclusively by the
-- POST /api/admin/sessions/[id]/force-complete endpoint:
--
--   structured_capture_responses.capture_method      += 'admin_force_complete'
--   structured_capture_responses.engagement_level    += 'unknown'
--
-- Rationale:
--   capture_method='admin_force_complete' marks rows synthesized when an
--   admin manually completes a stuck session whose coach never confirmed
--   the SCF. Distinct from auto_filled / voice_to_structured / manual_structured /
--   instructor_console so downstream analytics can exclude these from
--   coach-quality and engagement metrics.
--
--   engagement_level='unknown' represents "no coach observation made"
--   (admin acted in coach's place). Semantically distinct from 'low' which
--   would corrupt engagement aggregations.

BEGIN;

-- Pre-flight: confirm the table + existing constraints exist as expected
DO $$
DECLARE
  has_capture_method_constraint BOOLEAN;
  has_engagement_constraint BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'structured_capture_responses_capture_method_check'
  ) INTO has_capture_method_constraint;

  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'structured_capture_responses_engagement_level_check'
  ) INTO has_engagement_constraint;

  IF NOT has_capture_method_constraint THEN
    RAISE EXCEPTION 'Pre-flight failed: capture_method CHECK constraint missing';
  END IF;
  IF NOT has_engagement_constraint THEN
    RAISE EXCEPTION 'Pre-flight failed: engagement_level CHECK constraint missing';
  END IF;
END $$;

-- 1. capture_method: drop + recreate with 'admin_force_complete' added
ALTER TABLE structured_capture_responses
  DROP CONSTRAINT structured_capture_responses_capture_method_check;

ALTER TABLE structured_capture_responses
  ADD CONSTRAINT structured_capture_responses_capture_method_check
  CHECK (capture_method = ANY (ARRAY[
    'auto_filled'::text,
    'voice_to_structured'::text,
    'manual_structured'::text,
    'instructor_console'::text,
    'admin_force_complete'::text
  ]));

-- 2. engagement_level: drop + recreate with 'unknown' added
ALTER TABLE structured_capture_responses
  DROP CONSTRAINT structured_capture_responses_engagement_level_check;

ALTER TABLE structured_capture_responses
  ADD CONSTRAINT structured_capture_responses_engagement_level_check
  CHECK (engagement_level = ANY (ARRAY[
    'low'::text,
    'moderate'::text,
    'medium'::text,
    'high'::text,
    'exceptional'::text,
    'unknown'::text
  ]));

-- Post-flight: verify both constraints now permit the new values
DO $$
DECLARE
  capture_def TEXT;
  engagement_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO capture_def
  FROM pg_constraint
  WHERE conname = 'structured_capture_responses_capture_method_check';

  SELECT pg_get_constraintdef(oid) INTO engagement_def
  FROM pg_constraint
  WHERE conname = 'structured_capture_responses_engagement_level_check';

  IF capture_def NOT LIKE '%admin_force_complete%' THEN
    RAISE EXCEPTION 'Post-flight failed: capture_method missing admin_force_complete';
  END IF;
  IF engagement_def NOT LIKE '%unknown%' THEN
    RAISE EXCEPTION 'Post-flight failed: engagement_level missing unknown';
  END IF;
END $$;

COMMIT;
