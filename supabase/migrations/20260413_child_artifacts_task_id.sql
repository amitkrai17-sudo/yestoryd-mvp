-- ============================================================
-- FILE: supabase/migrations/20260413_child_artifacts_task_id.sql
-- PURPOSE: Add task_id FK on child_artifacts to link homework
-- photo uploads to the specific parent_daily_tasks row.
-- ============================================================

ALTER TABLE child_artifacts
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES parent_daily_tasks(id);

-- Coach-side query support: "show all artifacts for task X"
CREATE INDEX IF NOT EXISTS idx_child_artifacts_task_id
  ON child_artifacts(task_id)
  WHERE task_id IS NOT NULL;
