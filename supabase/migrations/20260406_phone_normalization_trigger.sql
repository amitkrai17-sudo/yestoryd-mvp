-- ============================================================
-- Migration: Phone normalization trigger (safety net)
-- Ensures all phone columns are stored as +91XXXXXXXXXX (E.164)
-- Applies to: parents.phone, children.parent_phone, coaches.phone
-- ============================================================

-- 1. Shared normalization function
CREATE OR REPLACE FUNCTION normalize_phone_to_e164(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cleaned text;
BEGIN
  IF raw IS NULL OR raw = '' THEN
    RETURN raw;
  END IF;

  -- Already correct format — fast path
  IF raw ~ '^\+91\d{10}$' THEN
    RETURN raw;
  END IF;

  -- Strip all non-digit characters
  cleaned := regexp_replace(raw, '\D', '', 'g');

  -- Remove leading country code if present: 91XXXXXXXXXX → XXXXXXXXXX
  IF length(cleaned) = 12 AND cleaned ~ '^91[6-9]\d{9}$' THEN
    cleaned := substring(cleaned from 3);
  END IF;

  -- Remove leading zero: 0XXXXXXXXXX → XXXXXXXXXX
  IF length(cleaned) = 11 AND cleaned ~ '^0[6-9]\d{9}$' THEN
    cleaned := substring(cleaned from 2);
  END IF;

  -- Valid 10-digit Indian mobile → prepend +91
  IF length(cleaned) = 10 AND cleaned ~ '^[6-9]\d{9}$' THEN
    RETURN '+91' || cleaned;
  END IF;

  -- Not a recognizable Indian number — return as-is to avoid data loss
  RETURN raw;
END;
$$;

COMMENT ON FUNCTION normalize_phone_to_e164(text) IS
  'Normalize any Indian phone format to E.164 (+91XXXXXXXXXX). Returns input unchanged for non-Indian or unrecognizable formats.';

-- 2. Trigger function for parents and coaches (normalizes .phone column)
CREATE OR REPLACE FUNCTION trg_normalize_phone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone := normalize_phone_to_e164(NEW.phone);
  RETURN NEW;
END;
$$;

-- 3. Trigger function for children (normalizes .parent_phone column)
CREATE OR REPLACE FUNCTION trg_normalize_parent_phone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.parent_phone := normalize_phone_to_e164(NEW.parent_phone);
  RETURN NEW;
END;
$$;

-- 4. Attach triggers
CREATE TRIGGER normalize_phone_before_upsert
  BEFORE INSERT OR UPDATE OF phone ON parents
  FOR EACH ROW EXECUTE FUNCTION trg_normalize_phone();

CREATE TRIGGER normalize_phone_before_upsert
  BEFORE INSERT OR UPDATE OF phone ON coaches
  FOR EACH ROW EXECUTE FUNCTION trg_normalize_phone();

CREATE TRIGGER normalize_parent_phone_before_upsert
  BEFORE INSERT OR UPDATE OF parent_phone ON children
  FOR EACH ROW EXECUTE FUNCTION trg_normalize_parent_phone();
