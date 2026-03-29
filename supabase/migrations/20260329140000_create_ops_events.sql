-- ============================================================
-- Migration: Create ops_events table (BackOps event bus)
-- PURPOSE: Unified operational event stream for BackOps.
--          cron_logs was defined in types but never created.
--          This is the real table, built fresh.
-- ============================================================

-- Step 1: Create table
CREATE TABLE IF NOT EXISTS ops_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL DEFAULT 'cron_run',
  source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  correlation_id UUID,
  entity_type TEXT,
  entity_id UUID,
  decision_made TEXT,
  decision_reason JSONB,
  action_taken TEXT,
  action_outcome TEXT,
  outcome_verified_at TIMESTAMPTZ,
  resolved_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: CHECK constraints (separate statements)
ALTER TABLE ops_events ADD CONSTRAINT ops_events_severity_check
  CHECK (severity IN ('info', 'warning', 'error', 'critical'));

ALTER TABLE ops_events ADD CONSTRAINT ops_events_event_type_check
  CHECK (event_type IN (
    'cron_run', 'cron_failure',
    'webhook_received', 'webhook_failed',
    'job_queued', 'job_completed', 'job_failed',
    'anomaly_detected', 'decision_made',
    'action_taken', 'action_outcome',
    'health_check', 'smoke_test',
    'payment_event', 'enrollment_event',
    'session_event', 'communication_sent', 'communication_failed',
    'nudge_sent', 'nudge_suppressed',
    'override_applied', 'escalation',
    'policy_updated', 'system_alert'
  ));

ALTER TABLE ops_events ADD CONSTRAINT ops_events_action_outcome_check
  CHECK (action_outcome IS NULL OR action_outcome IN (
    'pending', 'success', 'failed', 'awaiting_approval', 'suppressed', 'expired'
  ));

ALTER TABLE ops_events ADD CONSTRAINT ops_events_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN (
    'child', 'parent', 'coach', 'enrollment', 'session',
    'payment', 'lead', 'discovery_call', 'group_session',
    'tuition', 'communication', 'cron', 'system'
  ));

-- Step 3: Indexes for BackOps query patterns
CREATE INDEX IF NOT EXISTS idx_ops_events_type_created
  ON ops_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_events_severity_active
  ON ops_events(severity, created_at DESC)
  WHERE severity IN ('warning', 'error', 'critical');

CREATE INDEX IF NOT EXISTS idx_ops_events_correlation
  ON ops_events(correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ops_events_entity
  ON ops_events(entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ops_events_unresolved
  ON ops_events(created_at DESC)
  WHERE action_outcome = 'pending';

CREATE INDEX IF NOT EXISTS idx_ops_events_source
  ON ops_events(source, created_at DESC)
  WHERE source IS NOT NULL;

-- Step 4: RLS (admin + service role only)
ALTER TABLE ops_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ops_events"
  ON ops_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admin read access on ops_events"
  ON ops_events FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Step 5: Documentation
COMMENT ON TABLE ops_events IS 'BackOps event bus — unified operational event stream. All sensors, decisions, and actions log here.';
