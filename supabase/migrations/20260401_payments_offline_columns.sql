-- Migration: 20260401_payments_offline_columns
-- Purpose: Add columns to payments table for offline/cash payment recording
-- Author: Claude Code
-- Related: Record Cash/Offline Payment for Tuition feature

-- ═══════════════════════════════════════════════════
-- ALTER payments TABLE — add offline payment support
-- ═══════════════════════════════════════════════════

-- Payment method: how the payment was received
-- Values: 'razorpay' (default), 'cash', 'upi_manual', 'bank_transfer'
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  payment_method TEXT DEFAULT 'razorpay';

-- Who recorded the payment (for offline payments, the admin/coach user ID)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  recorded_by UUID;

-- Free-text notes (e.g., "Received by Rucha at home visit")
ALTER TABLE payments ADD COLUMN IF NOT EXISTS
  notes TEXT;

-- ═══════════════════════════════════════════════════
-- INDEX for filtering by payment method
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_payments_payment_method
  ON payments (payment_method);
