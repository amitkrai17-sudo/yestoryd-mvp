-- ============================================================
-- Migration: Session Activity Log
-- Date: 2026-02-09
-- Purpose: Track per-activity status/timing during live coaching sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS session_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
  activity_index INT NOT NULL,
  activity_name TEXT NOT NULL,
  activity_purpose TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'skipped', 'struggled')),
  planned_duration_minutes INT,
  actual_duration_seconds INT,
  coach_note TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sal_session ON session_activity_log(session_id);

-- RLS: service role full access (API routes use service role key)
ALTER TABLE session_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on session_activity_log"
  ON session_activity_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
