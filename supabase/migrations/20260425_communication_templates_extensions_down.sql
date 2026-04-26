-- ============================================================
-- Rollback for: 20260425_communication_templates_extensions.sql
-- ============================================================
-- WARNING: this rollback DOES NOT restore NULL required_variables values.
-- The backfill is one-way; the original NULLs are conceptually equivalent
-- to empty arrays from the validator's perspective, so leaving them as
-- empty arrays after rollback is acceptable.
-- ============================================================

BEGIN;

-- 4. Drop NOT NULL + DEFAULT on required_variables
ALTER TABLE communication_templates
  ALTER COLUMN required_variables DROP NOT NULL,
  ALTER COLUMN required_variables DROP DEFAULT;

-- 1. Drop wa_variable_derivations column
ALTER TABLE communication_templates
  DROP COLUMN IF EXISTS wa_variable_derivations;

-- Note: the per-template required_variables backfill (step 5) is NOT
-- reverted because we don't have a snapshot of the pre-migration values.
-- Rollback restores the schema, not the data shape.

COMMIT;
