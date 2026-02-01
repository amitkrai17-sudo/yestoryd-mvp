-- ============================================================
-- Migration: Add notification preferences to parents table
-- ============================================================

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "whatsapp": true,
    "email": true,
    "session_reminders": true,
    "progress_updates": true,
    "promotional": true,
    "quiet_hours_start": null,
    "quiet_hours_end": null
  }'::jsonb;
