-- Migration: Add no-show tracking columns to enrollments
-- Purpose: Track consecutive and total no-shows, flag at-risk enrollments

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS consecutive_no_shows INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_no_shows INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS at_risk BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS at_risk_reason TEXT;

-- Thresholds are read from site_settings at runtime.
-- Insert manually:
-- INSERT INTO site_settings (key, value, category) VALUES
--   ('consecutive_no_show_at_risk_threshold', '3', 'enrollment'),
--   ('total_no_show_auto_pause_threshold', '5', 'enrollment');
