-- ============================================================
-- Migration: payment_retry_tokens_reconcile
-- Date: 2026-04-25
-- Reconciles live payment_retry_tokens schema (6 cols) with the
-- columns the webhook code expects (parent_id, child_id,
-- razorpay_order_id, amount, product_code, used).
-- Live table has 0 rows so type defaults are risk-free.
-- ============================================================
-- Companion rollback: 20260425_payment_retry_tokens_reconcile_down.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- PRE-CHECK 1: FK target tables must exist
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'parents' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'parents.id missing - cannot create parent_id FK';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'children' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'children.id missing - cannot create child_id FK';
  END IF;
END $$;

-- ------------------------------------------------------------
-- PRE-CHECK 2: 6 new columns must NOT exist; row count must be 0
-- ------------------------------------------------------------
DO $$
DECLARE
  has_any boolean;
  rowct integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payment_retry_tokens'
      AND column_name IN ('parent_id','child_id','razorpay_order_id','amount','product_code','used')
  ) INTO has_any;
  IF has_any THEN
    RAISE EXCEPTION 'payment_retry_tokens already has one or more reconcile columns - aborting';
  END IF;

  SELECT count(*) INTO rowct FROM payment_retry_tokens;
  IF rowct <> 0 THEN
    RAISE EXCEPTION 'payment_retry_tokens has % rows - sanity check failed', rowct;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. ADD 6 new columns
--    razorpay_order_id is NOT NULL with default '' — temporary stance.
--    A follow-up migration drops the default once webhook is rebuilt.
-- ------------------------------------------------------------
ALTER TABLE payment_retry_tokens
  ADD COLUMN IF NOT EXISTS parent_id         uuid REFERENCES parents(id),
  ADD COLUMN IF NOT EXISTS child_id          uuid REFERENCES children(id),
  ADD COLUMN IF NOT EXISTS razorpay_order_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount            numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_code      text,
  ADD COLUMN IF NOT EXISTS used              boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. UNIQUE on token (live data has UNIQUE index — verify, idempotent ADD)
--    The pre-check confirmed payment_retry_tokens_token_key index exists.
--    We add the constraint only if missing (idempotent via DO block).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'payment_retry_tokens'
      AND c.contype = 'u'
      AND c.conname = 'payment_retry_tokens_token_key'
  ) THEN
    ALTER TABLE payment_retry_tokens
      ADD CONSTRAINT payment_retry_tokens_token_key UNIQUE (token);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Partial index for fast lookup of unused tokens
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_retry_tokens_token_unused
  ON payment_retry_tokens(token)
  WHERE used = false;

COMMIT;
