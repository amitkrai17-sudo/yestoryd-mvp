-- ============================================================
-- Migration: Create backops_policies table + seed
-- PURPOSE: Externalize operational thresholds from hardcoded
--          constants in cron routes into a configurable table.
-- ============================================================

-- Step 1: Create table
CREATE TABLE IF NOT EXISTS backops_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT UNIQUE NOT NULL,
  policy_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Indexes
CREATE INDEX IF NOT EXISTS idx_backops_policies_key
  ON backops_policies(policy_key)
  WHERE is_active = true;

-- Step 3: RLS
ALTER TABLE backops_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on backops_policies"
  ON backops_policies FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admin read access on backops_policies"
  ON backops_policies FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Step 4: Seed with actual hardcoded values from codebase audit
-- Values verified against: practice-nudge, session-completion-nudge,
-- tuition-onboarding-nudge, lead-scoring, payment-reconciliation-alert

INSERT INTO backops_policies (policy_key, policy_value, description) VALUES
(
  'practice_nudge',
  '{
    "high_engagement_skip": 0.8,
    "low_engagement_24h": 0.4,
    "zero_engagement_coach_alert_min_tasks": 5,
    "default_nudge_hours": 48,
    "nudge_time_ist": "10:00",
    "lookback_days": 30,
    "max_recent_tasks": 20,
    "overdue_min_hours": 48,
    "overdue_max_days": 7
  }',
  'Practice nudge adaptive engagement thresholds — from app/api/cron/practice-nudge/route.ts'
),
(
  'session_completion_nudge',
  '{
    "stale_threshold_minutes": 45,
    "rate_limit_between_ms": 200
  }',
  'Session completion nudge thresholds — from app/api/cron/session-completion-nudge/route.ts'
),
(
  'tuition_onboarding_nudge',
  '{
    "first_nudge_hours": 24,
    "second_nudge_hours": 72,
    "expire_hours": 168,
    "max_nudges": 2,
    "dedup_hours": 48
  }',
  'Tuition onboarding nudge windows — from app/api/cron/tuition-onboarding-nudge/route.ts'
),
(
  'lead_scoring',
  '{
    "base_score": 10,
    "assessment": {
      "very_low": {"threshold": 3, "bonus": 50},
      "low": {"threshold": 5, "bonus": 30},
      "medium": {"threshold": 7, "bonus": 15},
      "high": {"threshold": 10, "bonus": 5}
    },
    "age": {
      "primary_target": {"min": 4, "max": 7, "bonus": 15},
      "secondary_target": {"min": 8, "max": 10, "bonus": 10}
    },
    "discovery_call_bonus": 40,
    "enrollment_bonus": 100,
    "recency": {
      "stale_after_days": 14,
      "penalty_per_week": 5,
      "max_penalty": 20
    },
    "status_thresholds": {
      "hot": 60,
      "warm": 30,
      "cold_after_days": 30
    }
  }',
  'Lead scoring weights and thresholds — from lib/logic/lead-scoring.ts SCORING_CONFIG'
),
(
  'payment_reconciliation',
  '{
    "check_window_hours": 2,
    "min_age_minutes": 30,
    "alert_dedup_hours": 2
  }',
  'Payment reconciliation alert settings — from app/api/cron/payment-reconciliation-alert/route.ts'
),
(
  'health_check',
  '{
    "per_check_timeout_ms": 10000,
    "sentry_warn_threshold": 5,
    "sentry_fail_threshold": 10,
    "cron_max_hours_stale": 48
  }',
  'Daily health check thresholds — from app/api/cron/daily-health-check/route.ts'
),
(
  'backops_signal_detector',
  '{
    "scan_interval_minutes": 15,
    "auto_execute_enabled": false,
    "severity_escalation": {
      "warning_repeat_threshold": 3,
      "error_auto_escalate": true,
      "critical_immediate_alert": true
    }
  }',
  'BackOps signal detector configuration — Phase 1 is observe-only'
),
(
  'correlation_ttl',
  '{
    "active_correlation_hours": 72,
    "archive_after_days": 90
  }',
  'How long correlation chains stay active'
)
ON CONFLICT (policy_key) DO NOTHING;

COMMENT ON TABLE backops_policies IS 'BackOps policy engine — externalizes operational thresholds. Updateable via admin UI or OpenClaw commands.';
