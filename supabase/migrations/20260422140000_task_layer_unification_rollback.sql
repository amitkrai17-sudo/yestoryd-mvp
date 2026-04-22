-- =====================================================================
-- ROLLBACK — Task Layer Unification (20260422140000)
-- =====================================================================
-- Reverses Parts E → D → C → B → A of the task_layer_unification migration.
-- Order matters: drop dependents before dependencies.
--
-- PRE-FLIGHT CHECK (run manually before executing this rollback):
--   SELECT COUNT(*) FROM learning_events
--   WHERE event_type IN ('practice_in_progress', 'practice_abandoned');
-- If > 0, those rows will cause the recreated CHECK to fail. Either delete
-- them, remap them to another event_type, or amend this rollback to keep
-- the values in the restored enum.
--
-- SAFETY NOTE: this is a destructive rollback. Column drops cascade —
-- any code reading is_retired / retired_at / retirement_reason /
-- is_in_progress / evicted_for_task_id must be reverted BEFORE running
-- this, or those queries will 500.
-- =====================================================================

BEGIN;

-- =====================================================================
-- Part E-rev: Restore learning_events.event_type CHECK to 48-value enum
-- =====================================================================
ALTER TABLE learning_events DROP CONSTRAINT learning_events_event_type_check;

ALTER TABLE learning_events
  ADD CONSTRAINT learning_events_event_type_check
  CHECK (event_type IN (
    'session',
    'session_completed',
    'session_cancelled',
    'session_rescheduled',
    'session_missed',
    'session_feedback',
    'assessment',
    'diagnostic_assessment',
    'exit_assessment',
    'structured_capture',
    'elearning',
    'video',
    'quiz',
    'badge',
    'streak',
    'level_up',
    'group_class_observation',
    'group_class_response',
    'group_class_verbal',
    'group_class_quiz',
    'group_class_micro_insight',
    'group_class_parent_feedback',
    'parent_inquiry',
    'parent_session_summary',
    'parent_feedback',
    'parent_practice_observation',
    'milestone',
    'season_completion',
    'daily_recommendations',
    'progress_pulse',
    'breakthrough',
    'whatsapp_lead',
    'lead_conversation',
    'discovery_notes',
    'nps_feedback',
    'micro_assessment',
    'mini_challenge_completed',
    'session_companion_log',
    'activity_struggle_flag',
    'parent_practice_assigned',
    'practice_completed',
    'recall_enrichment',
    'child_artifact',
    'reading_log',
    'elearning_interaction',
    'unit_completed',
    'note',
    'handwritten'
  ));

-- =====================================================================
-- Part D-rev: Drop partial index
-- =====================================================================
DROP INDEX IF EXISTS idx_task_active_per_child;

-- =====================================================================
-- Part C-rev: Drop retirement_reason CHECK
-- =====================================================================
ALTER TABLE parent_daily_tasks DROP CONSTRAINT IF EXISTS parent_daily_tasks_retirement_reason_check;

-- =====================================================================
-- Pre-DROP data preservation — snapshot non-default task-layer data
-- =====================================================================
-- Runs BEFORE any DROP COLUMN so all 5 columns are still readable.
-- In case rollback happens after non-trivial task-layer data has been
-- written, snapshot retired / in-progress / evicted rows to a separate
-- table. If we decide to re-migrate later, we can restore from here.
CREATE TABLE IF NOT EXISTS parent_daily_tasks_rollback_snapshot_20260422 (
  id UUID,
  is_retired BOOLEAN,
  retired_at TIMESTAMPTZ,
  retirement_reason TEXT,
  is_in_progress BOOLEAN,
  evicted_for_task_id UUID,
  snapshotted_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO parent_daily_tasks_rollback_snapshot_20260422
  (id, is_retired, retired_at, retirement_reason, is_in_progress, evicted_for_task_id)
SELECT id, is_retired, retired_at, retirement_reason, is_in_progress, evicted_for_task_id
FROM parent_daily_tasks
WHERE is_retired = true OR is_in_progress = true OR evicted_for_task_id IS NOT NULL;

-- =====================================================================
-- Part B-rev: Drop progress tracking and eviction chain columns
-- =====================================================================
-- evicted_for_task_id has a self-FK; PG drops it with the column.
ALTER TABLE parent_daily_tasks
  DROP COLUMN IF EXISTS evicted_for_task_id,
  DROP COLUMN IF EXISTS is_in_progress;

-- =====================================================================
-- Part A-rev: Drop retirement state columns
-- =====================================================================
ALTER TABLE parent_daily_tasks
  DROP COLUMN IF EXISTS retirement_reason,
  DROP COLUMN IF EXISTS retired_at,
  DROP COLUMN IF EXISTS is_retired;

COMMIT;
