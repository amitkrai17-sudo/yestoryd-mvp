-- Fix: Allow offline coaches to teach multiple children at the same time
-- The blanket UNIQUE(coach_id, scheduled_date, scheduled_time) prevented
-- scheduling two offline/in-person sessions at the same slot.
-- Replace with partial index that only enforces for online (1:1 video) sessions.

ALTER TABLE scheduled_sessions DROP CONSTRAINT IF EXISTS no_double_booking;

CREATE UNIQUE INDEX IF NOT EXISTS no_double_booking_online
ON scheduled_sessions (coach_id, scheduled_date, scheduled_time)
WHERE session_mode = 'online' AND status NOT IN ('cancelled', 'missed');
