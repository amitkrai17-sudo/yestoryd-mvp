-- Seed site_settings keys for the unified task-limits config loader.
-- Reads via lib/config/task-limits.ts (5-min cache).
INSERT INTO site_settings (category, key, value, description) VALUES
  ('tasks', 'task_max_pending', '3'::jsonb,
   'Max active auto-generated tasks per child. coach_assigned source bypasses this cap.'),
  ('tasks', 'task_expiry_days', '7'::jsonb,
   'Days after task_date before a task auto-expires (status: active -> expired).'),
  ('tasks', 'task_window_days', '7'::jsonb,
   'Read window for parent dashboard and overdue-nudge cron. Tasks older than this are not surfaced.')
ON CONFLICT (key) DO NOTHING;
