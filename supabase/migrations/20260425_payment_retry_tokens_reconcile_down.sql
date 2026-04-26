-- ============================================================
-- Rollback for: 20260425_payment_retry_tokens_reconcile.sql
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS idx_payment_retry_tokens_token_unused;

-- Note: payment_retry_tokens_token_key UNIQUE constraint pre-existed
-- the reconcile migration as an index. The UP migration only ADDed the
-- constraint if missing, so we leave it alone in DOWN to preserve the
-- pre-existing live state.

ALTER TABLE payment_retry_tokens
  DROP COLUMN IF EXISTS used,
  DROP COLUMN IF EXISTS product_code,
  DROP COLUMN IF EXISTS amount,
  DROP COLUMN IF EXISTS razorpay_order_id,
  DROP COLUMN IF EXISTS child_id,
  DROP COLUMN IF EXISTS parent_id;

COMMIT;
