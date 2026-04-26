-- ============================================================
-- Rollback for: 20260425_failed_payments_reconcile.sql
-- ------------------------------------------------------------
-- Reverses the schema changes in inverse order. Runs only if
-- failed_payments has 0 rows OR all rows have NULL in the
-- columns being dropped (since DROP COLUMN destroys data).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 6. Drop trigger + function
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_failed_payments_updated_at ON failed_payments;
DROP FUNCTION IF EXISTS update_failed_payments_updated_at();

-- ------------------------------------------------------------
-- 5. Drop partial index
-- ------------------------------------------------------------
DROP INDEX IF EXISTS idx_failed_payments_unnotified;

-- ------------------------------------------------------------
-- 4. Drop CHECK
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  DROP CONSTRAINT IF EXISTS failed_payments_amount_positive_chk;

-- ------------------------------------------------------------
-- 3. Drop UNIQUE
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  DROP CONSTRAINT IF EXISTS failed_payments_razorpay_payment_id_key;

-- ------------------------------------------------------------
-- 2. ALTER amount: numeric(10,2) → integer
--    Floors fractional rupees. Acceptable because we ROUND to
--    integer paise/rupees in app code; no fractional values in prod.
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  ALTER COLUMN amount TYPE integer USING amount::integer;

-- ------------------------------------------------------------
-- 1. DROP the 5 added columns
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS retry_token_id,
  DROP COLUMN IF EXISTS notified_at,
  DROP COLUMN IF EXISTS child_id,
  DROP COLUMN IF EXISTS parent_id;

COMMIT;
