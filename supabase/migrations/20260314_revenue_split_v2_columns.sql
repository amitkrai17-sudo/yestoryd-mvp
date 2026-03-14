-- =============================================================================
-- Revenue Split V2: Add columns to enrollment_revenue for V2 breakdown data
-- =============================================================================

-- Skill building cost (paid from platform fee to coach)
ALTER TABLE enrollment_revenue
  ADD COLUMN IF NOT EXISTS skill_building_cost INTEGER DEFAULT 0;

-- Per-session rates for audit trail
ALTER TABLE enrollment_revenue
  ADD COLUMN IF NOT EXISTS coaching_rate_per_session INTEGER;

ALTER TABLE enrollment_revenue
  ADD COLUMN IF NOT EXISTS skill_building_rate_per_session INTEGER;

-- Enrollment sequence (starter / continuation / reenrollment)
ALTER TABLE enrollment_revenue
  ADD COLUMN IF NOT EXISTS enrollment_sequence TEXT DEFAULT 'starter';

-- Re-enrollment bonus amount
ALTER TABLE enrollment_revenue
  ADD COLUMN IF NOT EXISTS re_enrollment_bonus INTEGER DEFAULT 0;

-- Lead cost decay multiplier applied (1.0 = no decay, 0.5 = continuation, 0 = reenrollment)
ALTER TABLE enrollment_revenue
  ADD COLUMN IF NOT EXISTS lead_cost_decay_applied NUMERIC(3,2) DEFAULT 1.0;
