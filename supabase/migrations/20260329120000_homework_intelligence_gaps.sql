-- Homework intelligence enhancement: micro-feedback, duration, content linking, photo analysis

-- Gap 2: Parent micro-feedback on task difficulty
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS difficulty_rating TEXT
  CHECK (difficulty_rating IS NULL OR difficulty_rating IN ('easy', 'just_right', 'struggled'));

-- Gap 6: Practice duration signal
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS practice_duration TEXT
  CHECK (practice_duration IS NULL OR practice_duration IN ('under_5', '5_to_15', '15_to_30', 'over_30'));

-- Gap 7: Link tasks to content warehouse items
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES el_content_items(id) ON DELETE SET NULL;

-- Gap 1: Photo analysis result from Gemini Vision
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS photo_analysis JSONB;

-- Index for content linking queries
CREATE INDEX IF NOT EXISTS idx_parent_daily_tasks_content
  ON parent_daily_tasks(content_item_id) WHERE content_item_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE parent_daily_tasks DROP COLUMN IF EXISTS difficulty_rating;
-- ALTER TABLE parent_daily_tasks DROP COLUMN IF EXISTS practice_duration;
-- ALTER TABLE parent_daily_tasks DROP COLUMN IF EXISTS content_item_id;
-- ALTER TABLE parent_daily_tasks DROP COLUMN IF EXISTS photo_analysis;
-- DROP INDEX IF EXISTS idx_parent_daily_tasks_content;
