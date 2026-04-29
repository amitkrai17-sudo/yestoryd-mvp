-- One-time cleanup: mark tasks with task_date older than 7 days as
-- complete. They've accumulated due to no expiry semantics + 6 writers
-- without dedup. Future expiry handled by task_date filters in code.
UPDATE parent_daily_tasks
SET is_completed = true,
    completed_at = NOW(),
    coach_notes = COALESCE(coach_notes || E'\n', '')
      || '[auto-expired by 20260429 backfill]'
WHERE is_completed = false
  AND task_date < CURRENT_DATE - INTERVAL '7 days';
