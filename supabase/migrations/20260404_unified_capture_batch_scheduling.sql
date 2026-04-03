-- ============================================================================
-- Migration: Unified Capture + Batch Scheduling
--
-- 1. Add batch_id, meet_link, calendar_event_id to tuition_onboarding
-- 2. Add batch_id to scheduled_sessions
-- 3. Indexes for batch queries
-- 4. Default: every tuition_onboarding gets its own batch_id (solo batch)
--    Admin groups them explicitly via UI
-- ============================================================================

-- 1A: Batch columns on tuition_onboarding
ALTER TABLE tuition_onboarding
ADD COLUMN IF NOT EXISTS batch_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS meet_link TEXT,
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

COMMENT ON COLUMN tuition_onboarding.batch_id IS 'Groups children who study together. Same batch_id = shared Calendar event + Meet link + Recall.ai bot. Admin assigns explicitly.';
COMMENT ON COLUMN tuition_onboarding.meet_link IS 'Persistent Google Meet classroom link for this batch. Created once from recurring Calendar event, reused for life of batch.';
COMMENT ON COLUMN tuition_onboarding.calendar_event_id IS 'Google Calendar recurring event ID for this batch schedule.';

-- 1B: Batch column on scheduled_sessions
ALTER TABLE scheduled_sessions
ADD COLUMN IF NOT EXISTS batch_id UUID;

COMMENT ON COLUMN scheduled_sessions.batch_id IS 'Links sessions that share a Calendar event + Meet link + Recall bot. From tuition_onboarding.batch_id.';

-- 2: Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_batch_id
  ON scheduled_sessions(batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tuition_onboarding_batch_id
  ON tuition_onboarding(batch_id) WHERE batch_id IS NOT NULL;

-- 3: Backfill existing tuition_onboarding records
-- Every existing record gets its own unique batch_id (solo batch by default).
-- The DEFAULT gen_random_uuid() on the column handles this automatically for
-- existing NULL rows. But if the column was added with a default, existing rows
-- already got unique UUIDs. Verify:
-- SELECT id, batch_id FROM tuition_onboarding LIMIT 5;
-- If batch_id is NULL for existing rows, run:
UPDATE tuition_onboarding SET batch_id = gen_random_uuid() WHERE batch_id IS NULL;
