-- ============================================================
-- Migration: failed_payments + payment_retry_tokens tables
-- Tracks failed payment attempts and secure retry tokens
-- ============================================================

-- Failed payment records
CREATE TABLE IF NOT EXISTS failed_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  parent_id UUID REFERENCES parents(id),
  child_id UUID REFERENCES children(id),
  amount NUMERIC(10,2) NOT NULL,
  error_code TEXT,
  error_description TEXT,
  attempt_count INT NOT NULL DEFAULT 1,
  notified BOOLEAN NOT NULL DEFAULT false,
  notified_at TIMESTAMPTZ,
  retry_token_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failed_payments_order
  ON failed_payments(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_failed_payments_parent
  ON failed_payments(parent_id);

-- Secure retry tokens for payment retry links
CREATE TABLE IF NOT EXISTS payment_retry_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  parent_id UUID NOT NULL REFERENCES parents(id),
  child_id UUID NOT NULL REFERENCES children(id),
  razorpay_order_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  product_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retry_tokens_token
  ON payment_retry_tokens(token);

CREATE INDEX IF NOT EXISTS idx_retry_tokens_booking
  ON payment_retry_tokens(booking_id);

-- Auto-update updated_at for failed_payments
CREATE OR REPLACE FUNCTION update_failed_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_failed_payments_updated_at
  BEFORE UPDATE ON failed_payments
  FOR EACH ROW EXECUTE FUNCTION update_failed_payments_updated_at();
