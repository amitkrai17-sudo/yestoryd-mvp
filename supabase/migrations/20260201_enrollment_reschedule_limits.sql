-- ============================================================
-- Migration: Add reschedule limit tracking to enrollments
-- ============================================================

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS max_reschedules INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reschedules_used INT NOT NULL DEFAULT 0;

-- Backfill: count existing approved reschedule requests per enrollment
UPDATE enrollments e
SET reschedules_used = sub.cnt
FROM (
  SELECT ss.enrollment_id, COUNT(*) as cnt
  FROM session_change_requests scr
  JOIN scheduled_sessions ss ON ss.id = scr.session_id
  WHERE scr.request_type = 'reschedule'
    AND scr.status = 'approved'
  GROUP BY ss.enrollment_id
) sub
WHERE e.id = sub.enrollment_id
  AND sub.cnt > 0;
