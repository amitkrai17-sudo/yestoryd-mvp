-- ============================================================
-- Migration: Parent Daily Tasks + Streak Tracking
-- Date: 2026-02-08
-- Purpose: Support daily practice tasks and parent engagement streaks
-- ============================================================

-- 1. Create parent_daily_tasks table
CREATE TABLE IF NOT EXISTS parent_daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id),
  enrollment_id UUID REFERENCES enrollments(id),
  task_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  linked_template_code TEXT,
  linked_skill TEXT,
  duration_minutes INTEGER DEFAULT 10,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, task_date, title)
);

-- 2. Index for fast lookups by child + date range
CREATE INDEX IF NOT EXISTS idx_daily_tasks_child_date
  ON parent_daily_tasks(child_id, task_date);

-- 3. Add streak tracking columns to children table
ALTER TABLE children ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE children ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE children ADD COLUMN IF NOT EXISTS last_task_completed_date DATE;

-- 4. RLS policies (service role bypasses, parent access via app)
ALTER TABLE parent_daily_tasks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use service role key)
CREATE POLICY "Service role full access on parent_daily_tasks"
  ON parent_daily_tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);
