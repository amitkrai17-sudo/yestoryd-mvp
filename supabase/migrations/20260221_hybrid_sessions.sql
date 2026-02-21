-- ============================================================
-- HYBRID SESSIONS: Add session_mode and offline request tracking
-- Phase 1: Schema changes for online/offline session support
-- ============================================================
-- ROLLBACK: ALTER TABLE scheduled_sessions DROP COLUMN session_mode, DROP COLUMN offline_request_status,
--   DROP COLUMN offline_request_reason, DROP COLUMN offline_reason_detail, DROP COLUMN offline_location,
--   DROP COLUMN offline_location_type, DROP COLUMN offline_approved_by, DROP COLUMN offline_approved_at,
--   DROP COLUMN report_submitted_at, DROP COLUMN report_deadline, DROP COLUMN report_late,
--   DROP COLUMN coach_voice_note_path, DROP COLUMN child_reading_clip_path;

-- 1a. Add columns to scheduled_sessions
ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS session_mode TEXT NOT NULL DEFAULT 'online'
    CHECK (session_mode IN ('online', 'offline')),
  ADD COLUMN IF NOT EXISTS offline_request_status TEXT DEFAULT NULL
    CHECK (offline_request_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  ADD COLUMN IF NOT EXISTS offline_request_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offline_reason_detail TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offline_location TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offline_location_type TEXT DEFAULT NULL
    CHECK (offline_location_type IN ('home_visit', 'school', 'center', 'other')),
  ADD COLUMN IF NOT EXISTS offline_approved_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offline_approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS report_submitted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS report_deadline TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS report_late BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coach_voice_note_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS child_reading_clip_path TEXT DEFAULT NULL;

-- 1b. Add source column to session_activity_log
-- ROLLBACK: ALTER TABLE session_activity_log DROP COLUMN source;
ALTER TABLE session_activity_log
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'companion_panel';

-- 1c. Add indexes for offline queries
-- ROLLBACK: DROP INDEX IF EXISTS idx_sessions_mode_enrollment;
CREATE INDEX IF NOT EXISTS idx_sessions_mode_enrollment
  ON scheduled_sessions (enrollment_id, session_mode)
  WHERE session_mode = 'offline';

-- ROLLBACK: DROP INDEX IF EXISTS idx_sessions_mode_coach;
CREATE INDEX IF NOT EXISTS idx_sessions_mode_coach
  ON scheduled_sessions (coach_id, session_mode, status);

-- 1d. Seed site_settings for offline configuration
-- ROLLBACK: DELETE FROM site_settings WHERE key IN ('offline_max_percent', 'offline_report_deadline_hours', 'offline_new_coach_online_threshold', 'offline_new_coach_adherence_threshold', 'offline_parent_notification_template');
INSERT INTO site_settings (key, value, description, category)
VALUES
  ('offline_max_percent', '"25"', 'Max % of enrollment sessions allowed offline', 'program'),
  ('offline_report_deadline_hours', '"4"', 'Hours after session for coach to submit offline report', 'program'),
  ('offline_new_coach_online_threshold', '"3"', 'Min completed online sessions before coach can go offline', 'program'),
  ('offline_new_coach_adherence_threshold', '"70"', 'Min adherence score for coach to qualify for offline', 'program'),
  ('offline_parent_notification_template', '"Your child''s session on {date} will be conducted in person at {location}. Coach {coachName} will share a session report after."', 'WhatsApp template for offline session notification', 'communication')
ON CONFLICT (key) DO NOTHING;
