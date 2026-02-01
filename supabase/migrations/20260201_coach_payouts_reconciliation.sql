-- ============================================================
-- Migration: Add bank transfer reconciliation columns to coach_payouts
-- ============================================================

ALTER TABLE coach_payouts
  ADD COLUMN IF NOT EXISTS bank_transfer_status TEXT CHECK (bank_transfer_status IN ('pending', 'initiated', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciled_by TEXT;

-- Index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_payouts_bank_transfer_status
  ON coach_payouts(bank_transfer_status) WHERE bank_transfer_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_utr
  ON coach_payouts(utr_number) WHERE utr_number IS NOT NULL;
