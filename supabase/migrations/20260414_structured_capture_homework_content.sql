-- Persist SCF homework toggle + coach-attached worksheet on the capture row.
-- These are nullable; absence means "no homework assigned / no worksheet attached".
-- Previously homework_assigned + homework_description were only embedded for search,
-- never persisted — which meant the orchestrator's homework task creation gate only
-- fired for voice-capture gemini_analysis paths, silently dropping every SCF manual submit.

ALTER TABLE structured_capture_responses
  ADD COLUMN IF NOT EXISTS homework_assigned BOOLEAN,
  ADD COLUMN IF NOT EXISTS homework_description TEXT,
  ADD COLUMN IF NOT EXISTS content_item_id UUID
    REFERENCES el_content_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_structured_capture_content_item
  ON structured_capture_responses(content_item_id)
  WHERE content_item_id IS NOT NULL;
