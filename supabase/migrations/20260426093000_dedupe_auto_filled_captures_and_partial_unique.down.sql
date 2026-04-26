-- Rollback: drop the partial UNIQUE index.
-- Note: the dedupe DELETE is NOT reversible. The 11 deleted rows had
-- AI-prefilled default content (engagement_level='moderate', skills=[],
-- coach_confirmed=false) and were already orphaned from scheduled_sessions
-- (which pointed to the OLDER row in all 11 cases). Re-insertion would
-- require restoring from backup if the original content is needed.

BEGIN;

DROP INDEX IF EXISTS structured_capture_responses_session_id_auto_filled_unique;

COMMIT;
