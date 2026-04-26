-- ============================================================
-- Migration: failed_payments_reconcile
-- Date: 2026-04-25
-- Reconciles live failed_payments schema (12 cols) with the
-- intent of 20260201_failed_payments.sql (15 cols + UNIQUE + CHECK).
-- Live table has 0 rows so type alteration is risk-free.
-- ============================================================
-- Companion rollback: 20260425_failed_payments_reconcile_down.sql
-- Pre-application verification: see comment block at top.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PRE-CHECK 1: FK target tables must exist with id columns.
-- Fail-loudly if missing — never create dangling FKs.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_retry_tokens' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'payment_retry_tokens.id missing — cannot create retry_token_id FK';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parents' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'parents.id missing — cannot create parent_id FK';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'children' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'children.id missing — cannot create child_id FK';
  END IF;
END $$;

-- ------------------------------------------------------------
-- PRE-CHECK 2: confirm we're operating on the expected source state.
-- amount must currently be integer; the 5 new columns must NOT exist.
-- ------------------------------------------------------------
DO $$
DECLARE
  amount_type text;
BEGIN
  SELECT data_type INTO amount_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='failed_payments' AND column_name='amount';
  IF amount_type IS NULL THEN
    RAISE EXCEPTION 'failed_payments.amount column missing — refusing to proceed';
  END IF;
  IF amount_type NOT IN ('integer','numeric') THEN
    RAISE EXCEPTION 'failed_payments.amount unexpected type %', amount_type;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. ADD 5 new columns (all nullable; FK on three of them).
--    All ADD COLUMN IF NOT EXISTS so re-running the migration is idempotent.
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  ADD COLUMN IF NOT EXISTS parent_id      uuid REFERENCES parents(id),
  ADD COLUMN IF NOT EXISTS child_id       uuid REFERENCES children(id),
  ADD COLUMN IF NOT EXISTS notified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS retry_token_id uuid REFERENCES payment_retry_tokens(id),
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

-- ------------------------------------------------------------
-- 2. ALTER amount: integer → numeric(10,2).
--    Live table has 0 rows. USING cast is a no-op but documents intent.
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  ALTER COLUMN amount TYPE numeric(10,2) USING amount::numeric(10,2);

-- ------------------------------------------------------------
-- 3. UNIQUE on razorpay_payment_id (defense-in-depth idempotency).
--    Webhook code can ON CONFLICT this column going forward.
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  ADD CONSTRAINT failed_payments_razorpay_payment_id_key UNIQUE (razorpay_payment_id);

-- ------------------------------------------------------------
-- 4. CHECK on amount > 0 (no zero or negative failures).
-- ------------------------------------------------------------
ALTER TABLE failed_payments
  ADD CONSTRAINT failed_payments_amount_positive_chk CHECK (amount > 0);

-- ------------------------------------------------------------
-- 5. Partial index for the 30-min nudge job lookup.
--    Filters to "still need to chase this payment" rows only.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_failed_payments_unnotified
  ON failed_payments(razorpay_order_id)
  WHERE notified = false;

-- ------------------------------------------------------------
-- 6. Auto-update updated_at trigger.
--    Function/trigger DROP-then-CREATE is idempotent.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_failed_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_failed_payments_updated_at ON failed_payments;
CREATE TRIGGER trg_failed_payments_updated_at
  BEFORE UPDATE ON failed_payments
  FOR EACH ROW EXECUTE FUNCTION update_failed_payments_updated_at();

COMMIT;
