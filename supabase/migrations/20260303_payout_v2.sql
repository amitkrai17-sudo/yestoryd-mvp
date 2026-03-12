-- =============================================================================
-- MIGRATION: Per-Session Payout V2 + Coach Capacity
-- Date: 2026-03-03
-- Purpose: Switch from pre-created staggered payouts to per-session calculation
-- =============================================================================

-- =============================================================================
-- 1. ADD COLUMNS TO coaches TABLE (skip if exists)
-- =============================================================================

-- max_children already exists, skip
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS intelligence_score INT DEFAULT 0;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN DEFAULT false;

-- =============================================================================
-- 2. ADD COLUMNS TO enrollment_revenue TABLE (already exists, extend it)
-- =============================================================================

ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES children(id);
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10,2);
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS total_sessions INT;
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS per_session_coach_rate DECIMAL(10,2);
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS sessions_paid INT DEFAULT 0;
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS lead_bonus_paid BOOLEAN DEFAULT false;
ALTER TABLE enrollment_revenue ADD COLUMN IF NOT EXISTS is_internal_coach BOOLEAN DEFAULT false;

-- Backfill net_amount from total_amount where NULL
UPDATE enrollment_revenue
SET net_amount = total_amount - COALESCE(coupon_discount, 0)
WHERE net_amount IS NULL;

-- =============================================================================
-- 3. ADD COLUMNS TO coach_payouts TABLE (for monthly aggregation)
-- =============================================================================

ALTER TABLE coach_payouts ADD COLUMN IF NOT EXISTS payout_month_label TEXT;
  -- e.g. '2026-02' for human-readable month tracking
ALTER TABLE coach_payouts ADD COLUMN IF NOT EXISTS session_earnings DECIMAL(10,2) DEFAULT 0;
ALTER TABLE coach_payouts ADD COLUMN IF NOT EXISTS lead_bonus DECIMAL(10,2) DEFAULT 0;
ALTER TABLE coach_payouts ADD COLUMN IF NOT EXISTS sessions_count INT DEFAULT 0;
ALTER TABLE coach_payouts ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5,2);

-- =============================================================================
-- 4. CREATE coach_quality_log TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS coach_quality_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES coaches(id) NOT NULL,
  month DATE NOT NULL,  -- first of month
  avg_nps DECIMAL(3,2),
  session_completion_rate DECIMAL(5,2),
  report_submission_rate DECIMAL(5,2),
  re_enrollment_rate DECIMAL(5,2),
  intelligence_score INT DEFAULT 0,
  active_children INT DEFAULT 0,
  platform_hours DECIMAL(10,2) DEFAULT 0,
  referral_count INT DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, month)
);

-- =============================================================================
-- 5. HELPER FUNCTION: Get coach active children count
-- =============================================================================

CREATE OR REPLACE FUNCTION get_coach_active_children(p_coach_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM enrollments
  WHERE coach_id = p_coach_id AND status = 'active';
$$ LANGUAGE SQL STABLE;

-- =============================================================================
-- 6. HELPER FUNCTION: Atomic group participant increment
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_group_participants(p_session_id UUID)
RETURNS void AS $$
  UPDATE group_sessions
  SET current_participants = COALESCE(current_participants, 0) + 1
  WHERE id = p_session_id;
$$ LANGUAGE SQL;

-- =============================================================================
-- 7. INDEXES FOR PAYOUT V2 QUERIES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_completed_month
  ON scheduled_sessions (coach_id, status, completed_at)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_enrollment_revenue_coach
  ON enrollment_revenue (coaching_coach_id);

CREATE INDEX IF NOT EXISTS idx_enrollment_revenue_lead
  ON enrollment_revenue (lead_source_coach_id)
  WHERE lead_source_coach_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollment_revenue_enrollment
  ON enrollment_revenue (enrollment_id);

CREATE INDEX IF NOT EXISTS idx_coach_payouts_month_label
  ON coach_payouts (coach_id, payout_month_label)
  WHERE payout_month_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_quality_log_coach_month
  ON coach_quality_log (coach_id, month);
