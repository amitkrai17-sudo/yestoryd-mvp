-- ============================================================================
-- Migration: Scheduling Orchestrator tables and columns
-- Purpose: Manual queue, coach reassignment log, retry tracking
-- ============================================================================

-- scheduling_queue table: human escalation when automation fails
CREATE TABLE IF NOT EXISTS scheduling_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scheduled_sessions(id),
  enrollment_id UUID REFERENCES enrollments(id),
  child_id UUID,
  coach_id UUID,
  session_type TEXT,
  week_number INT,
  reason TEXT NOT NULL,
  attempts_made INT DEFAULT 0,
  assigned_to UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  resolution_notes TEXT,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- coach_reassignment_log table: tracks all coach changes
CREATE TABLE IF NOT EXISTS coach_reassignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id),
  child_id UUID,
  original_coach_id UUID,
  new_coach_id UUID,
  reason TEXT,
  reassignment_type TEXT CHECK (reassignment_type IN ('temporary', 'permanent')),
  is_temporary BOOLEAN DEFAULT FALSE,
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  handoff_notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add retry columns to scheduled_sessions
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS scheduling_attempts INT DEFAULT 0;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduling_queue_status ON scheduling_queue(status);
CREATE INDEX IF NOT EXISTS idx_scheduling_queue_enrollment ON scheduling_queue(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_coach_reassignment_log_enrollment ON coach_reassignment_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_coach_reassignment_log_original_coach ON coach_reassignment_log(original_coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_reassignment_log_temp_active
  ON coach_reassignment_log(original_coach_id, actual_end_date)
  WHERE is_temporary = TRUE AND actual_end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_next_retry
  ON scheduled_sessions(next_retry_at)
  WHERE next_retry_at IS NOT NULL;
