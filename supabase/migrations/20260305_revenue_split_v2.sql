-- =============================================================================
-- MIGRATION: Revenue split v2 — align coach_groups + site_settings
-- =============================================================================
-- Changes:
--   coach_groups: lead_cost_percent → 10 (was 20), platform_fee_percent recalculated
--   site_settings: skill_building_rate_multiplier → 0.50, lead referrer percents, bonus → 0
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. coach_groups: update lead_cost_percent and platform_fee_percent
--    Formula: platform_fee_percent = 100 - coach_cost_percent - lead_cost_percent
-- ---------------------------------------------------------------------------

UPDATE coach_groups
SET lead_cost_percent = 10,
    platform_fee_percent = 100 - coach_cost_percent - 10,
    updated_at = NOW()
WHERE name IN ('rising', 'expert', 'master')
  AND lead_cost_percent != 10;

-- Internal stays at 0/0/100 — no change needed

-- ---------------------------------------------------------------------------
-- 2. site_settings: upsert revenue + referral keys
-- ---------------------------------------------------------------------------

-- Skill building rate multiplier (was 0.60 in some envs, standardise to 0.50)
INSERT INTO site_settings (key, value, category, updated_at)
VALUES ('skill_building_rate_multiplier', '0.50', 'revenue', NOW())
ON CONFLICT (key) DO UPDATE SET value = '0.50', updated_at = NOW();

-- Lead cost referrer percents (coach 15→10, others verify)
INSERT INTO site_settings (key, value, category, updated_at)
VALUES ('lead_cost_referrer_percent_coach', '10', 'referral', NOW())
ON CONFLICT (key) DO UPDATE SET value = '10', updated_at = NOW();

INSERT INTO site_settings (key, value, category, updated_at)
VALUES ('lead_cost_referrer_percent_parent', '10', 'referral', NOW())
ON CONFLICT (key) DO UPDATE SET value = '10', updated_at = NOW();

INSERT INTO site_settings (key, value, category, updated_at)
VALUES ('lead_cost_referrer_percent_external', '5', 'referral', NOW())
ON CONFLICT (key) DO UPDATE SET value = '5', updated_at = NOW();

INSERT INTO site_settings (key, value, category, updated_at)
VALUES ('lead_cost_referrer_percent_influencer', '10', 'referral', NOW())
ON CONFLICT (key) DO UPDATE SET value = '10', updated_at = NOW();

-- Coaching bonus → 0 (replaced by skill building earnings)
INSERT INTO site_settings (key, value, category, updated_at)
VALUES ('coaching_bonus_percent', '0', 'referral', NOW())
ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = NOW();

COMMIT;
