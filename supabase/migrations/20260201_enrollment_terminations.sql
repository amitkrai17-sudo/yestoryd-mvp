-- ============================================================
-- Migration: enrollment_terminations table
-- Tracks enrollment terminations with refund processing
-- ============================================================

CREATE TABLE IF NOT EXISTS enrollment_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),

  -- Session accounting
  sessions_total INT NOT NULL,
  sessions_completed INT NOT NULL,
  sessions_remaining INT GENERATED ALWAYS AS (sessions_total - sessions_completed) STORED,

  -- Financial breakdown
  original_amount NUMERIC(10,2) NOT NULL,
  coach_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(10,2) NOT NULL,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'pro_rata', 'none')),

  -- Razorpay refund tracking
  razorpay_payment_id TEXT NOT NULL,
  razorpay_refund_id TEXT,
  refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'initiated', 'completed', 'failed')),
  refund_failure_reason TEXT,

  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refund_completed_at TIMESTAMPTZ,

  -- Metadata
  initiated_by TEXT NOT NULL,
  termination_reason TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_enrollment_termination UNIQUE (enrollment_id)
);

-- Index for webhook lookups by refund ID
CREATE INDEX IF NOT EXISTS idx_terminations_razorpay_refund
  ON enrollment_terminations(razorpay_refund_id) WHERE razorpay_refund_id IS NOT NULL;

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_terminations_status
  ON enrollment_terminations(refund_status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_termination_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_termination_updated_at
  BEFORE UPDATE ON enrollment_terminations
  FOR EACH ROW EXECUTE FUNCTION update_termination_updated_at();
