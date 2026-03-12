-- =============================================================================
-- MIGRATION: Group Class Immediate Payouts + Quality Monitoring
-- Date: 2026-03-03
-- =============================================================================

-- =============================================================================
-- 1. Make enrollment_revenue_id nullable on coach_payouts
--    (group class payouts don't have an enrollment_revenue record)
-- =============================================================================

ALTER TABLE coach_payouts ALTER COLUMN enrollment_revenue_id DROP NOT NULL;

-- =============================================================================
-- 2. Add group payout columns to group_sessions
-- =============================================================================

ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS instructor_payout_type TEXT DEFAULT 'fixed'
  CHECK (instructor_payout_type IN ('fixed', 'revenue_share'));
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS instructor_fixed_amount DECIMAL(10,2) DEFAULT 500;
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS instructor_share_percent DECIMAL(5,2) DEFAULT 50;
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS instructor_payout_status TEXT DEFAULT 'pending'
  CHECK (instructor_payout_status IN ('pending', 'processing', 'paid', 'failed', 'skipped'));
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS instructor_payout_id UUID;

-- =============================================================================
-- 3. Index for group payout queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_group_sessions_payout_status
  ON group_sessions (instructor_id, instructor_payout_status)
  WHERE instructor_payout_status IN ('pending', 'processing');
