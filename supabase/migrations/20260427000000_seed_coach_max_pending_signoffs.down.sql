-- Rollback: remove the coach_max_pending_signoffs site_settings row.
-- Safe even if absent.

BEGIN;

DELETE FROM site_settings WHERE key = 'coach_max_pending_signoffs';

COMMIT;
