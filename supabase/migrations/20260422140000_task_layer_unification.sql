-- =====================================================================
-- Task Layer Unification (TASK-001 / TASK-002 / TASK-007)
-- =====================================================================
-- Introduces retirement state (is_retired / retired_at / retirement_reason),
-- progress tracking (is_in_progress), and eviction chain (evicted_for_task_id)
-- on parent_daily_tasks. Extends learning_events.event_type with
-- practice_in_progress and practice_abandoned so the retirement cron and
-- parent-UI progress signals can be persisted as events.
--
-- Model B: is_retired and is_completed are INDEPENDENT booleans.
--   Active filter = (is_retired = false AND is_completed = false).
--   Retirement reasons: age_expired | evicted_for_newer | coach_cancelled.
--   Completed tasks are NOT retired. No backfill runs.
--
-- Row counts at draft time: parent_daily_tasks=112, learning_events=53.
-- Expected execution: sub-second, no scaling concerns.
-- =====================================================================

BEGIN;

-- =====================================================================
-- Part A: Add retirement state columns
-- =====================================================================
ALTER TABLE parent_daily_tasks
  ADD COLUMN is_retired BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN retired_at TIMESTAMPTZ NULL,
  ADD COLUMN retirement_reason TEXT NULL;

COMMENT ON COLUMN parent_daily_tasks.is_retired IS
  'True when task is removed from active dashboard without completion (age-expired, evicted, or coach-cancelled). Independent of is_completed.';
COMMENT ON COLUMN parent_daily_tasks.retired_at IS
  'Timestamp when task was retired. Null if never retired.';
COMMENT ON COLUMN parent_daily_tasks.retirement_reason IS
  'Reason for retirement: age_expired, evicted_for_newer, or coach_cancelled. Null if not retired.';

-- =====================================================================
-- Part B: Add progress tracking and eviction chain
-- =====================================================================
ALTER TABLE parent_daily_tasks
  ADD COLUMN is_in_progress BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN evicted_for_task_id UUID NULL REFERENCES parent_daily_tasks(id);

COMMENT ON COLUMN parent_daily_tasks.is_in_progress IS
  'True when parent has started but not completed this task. Set by parent UI on open.';
COMMENT ON COLUMN parent_daily_tasks.evicted_for_task_id IS
  'If retirement_reason=evicted_for_newer, references the task that displaced this one. Enables eviction chain tracing.';

-- =====================================================================
-- Part C: CHECK constraint on retirement_reason (Model B enum, no 'completed')
-- =====================================================================
ALTER TABLE parent_daily_tasks
  ADD CONSTRAINT parent_daily_tasks_retirement_reason_check
  CHECK (retirement_reason IS NULL OR retirement_reason IN (
    'age_expired',
    'evicted_for_newer',
    'coach_cancelled'
  ));

-- =====================================================================
-- Part D: Partial index for active-task queries (new access pattern)
-- =====================================================================
CREATE INDEX idx_task_active_per_child
  ON parent_daily_tasks (child_id, task_date DESC)
  WHERE is_retired = false AND is_completed = false;

COMMENT ON INDEX idx_task_active_per_child IS
  'Serves active-task list queries ordering by task_date DESC. Complements idx_parent_daily_tasks_child_active which orders by created_at DESC.';

-- =====================================================================
-- Part E: Extend learning_events.event_type CHECK constraint
-- =====================================================================
-- Drop existing constraint
ALTER TABLE learning_events DROP CONSTRAINT learning_events_event_type_check;

-- Recreate with 2 new values added at end of list.
-- All 48 existing values preserved verbatim; practice_in_progress and
-- practice_abandoned appended.
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
    'handwritten',
    'practice_in_progress',
    'practice_abandoned'
  ));

-- =====================================================================
-- Part F: NO BACKFILL
-- =====================================================================
-- Per Model B: is_retired and is_completed are independent.
-- No update to existing completed rows. Existing data remains unchanged —
-- new columns default to false/null which is correct for all existing rows.
-- No action required here.

COMMIT;
