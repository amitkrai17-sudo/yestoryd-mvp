-- Migration: Add language_code column to communication_templates
-- ================================================================
-- Enables Meta Cloud direct outbound (BSP migration, see CURRENT-STATE.md
-- 2026-04-29 entry). Meta Cloud's send-template API requires an explicit
-- `language` field per send (BCP-47 short form like 'en', 'hi', 'en_US').
-- AiSensy hides this behind their abstraction; Meta Cloud requires it
-- explicit. Adapter at lib/whatsapp/cloud-api.ts:185 (sendTemplate) accepts
-- languageCode as its third arg — this column is the per-template source
-- of truth that the new 'leadbot' channel branch in notify.ts will read.
--
-- Shape:
--   language_code TEXT NOT NULL DEFAULT 'en'
--   CHECK (language_code ~ '^[a-z]{2}(_[A-Z]{2})?$')
--
-- Backfill: NOT NULL + DEFAULT 'en' means existing 76 rows fill to 'en'
-- automatically as part of the ALTER. No separate UPDATE pass needed
-- (small table, single statement).
--
-- Idempotency:
--   - ADD COLUMN uses IF NOT EXISTS (Postgres-supported on column adds)
--   - ADD CONSTRAINT wrapped in DO $$ EXCEPTION WHEN duplicate_object $$
--     because Postgres does NOT support IF NOT EXISTS on ADD CONSTRAINT
--   - Migration is safe to run twice; second run is a no-op.

BEGIN;

-- Pre-flight: verify the target table exists
DO $$
DECLARE
  has_table BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'communication_templates'
  ) INTO has_table;

  IF NOT has_table THEN
    RAISE EXCEPTION 'Pre-flight failed: communication_templates table missing';
  END IF;
END $$;

-- 1. Add column. NOT NULL + DEFAULT 'en' backfills existing rows in the
--    same statement. IF NOT EXISTS makes this idempotent.
ALTER TABLE communication_templates
  ADD COLUMN IF NOT EXISTS language_code TEXT NOT NULL DEFAULT 'en';

-- 2. Add CHECK constraint validating BCP-47 short form.
--    Wrapped in DO block because ADD CONSTRAINT does not support IF NOT EXISTS.
DO $$
BEGIN
  ALTER TABLE communication_templates
    ADD CONSTRAINT communication_templates_language_code_format
    CHECK (language_code ~ '^[a-z]{2}(_[A-Z]{2})?$');
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists from a prior run; safe to skip.
    NULL;
END $$;

-- 3. Column comment for schema documentation.
COMMENT ON COLUMN communication_templates.language_code IS
  'Meta Cloud API language code (BCP-47 short form). Required per-send for Meta Cloud direct outbound. Default en for English.';

-- Post-flight: verify column exists with correct properties + constraint is in place
DO $$
DECLARE
  col_data_type TEXT;
  col_is_nullable TEXT;
  col_default TEXT;
  has_constraint BOOLEAN;
  null_row_count BIGINT;
BEGIN
  -- Column properties
  SELECT data_type, is_nullable, column_default
    INTO col_data_type, col_is_nullable, col_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'communication_templates'
    AND column_name = 'language_code';

  IF col_data_type IS NULL THEN
    RAISE EXCEPTION 'Post-flight failed: language_code column not created';
  END IF;
  IF col_data_type <> 'text' THEN
    RAISE EXCEPTION 'Post-flight failed: language_code data_type is %, expected text', col_data_type;
  END IF;
  IF col_is_nullable <> 'NO' THEN
    RAISE EXCEPTION 'Post-flight failed: language_code is_nullable is %, expected NO', col_is_nullable;
  END IF;
  IF col_default NOT LIKE '%''en''%' THEN
    RAISE EXCEPTION 'Post-flight failed: language_code default is %, expected ''en''', col_default;
  END IF;

  -- CHECK constraint
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'communication_templates'::regclass
      AND conname = 'communication_templates_language_code_format'
  ) INTO has_constraint;

  IF NOT has_constraint THEN
    RAISE EXCEPTION 'Post-flight failed: language_code_format CHECK constraint missing';
  END IF;

  -- Backfill: every row must have a non-null language_code
  SELECT COUNT(*) INTO null_row_count
  FROM communication_templates
  WHERE language_code IS NULL;

  IF null_row_count > 0 THEN
    RAISE EXCEPTION 'Post-flight failed: % rows have NULL language_code after backfill', null_row_count;
  END IF;
END $$;

COMMIT;
