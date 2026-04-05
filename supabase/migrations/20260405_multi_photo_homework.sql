-- ============================================================
-- Migration: Multi-photo support for homework tasks
-- Adds photo_urls JSONB array to parent_daily_tasks.
-- Keeps photo_url (legacy) for backward compatibility.
-- Schema: [{"url": "storage/path", "uploaded_at": "ISO8601", "analysis": {...}}]
-- ============================================================

-- 1. Add photo_urls column
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]';

-- 2. Backfill: migrate existing photo_url into photo_urls array
UPDATE parent_daily_tasks
SET photo_urls = jsonb_build_array(
  jsonb_build_object('url', photo_url, 'uploaded_at', COALESCE(completed_at, created_at))
)
WHERE photo_url IS NOT NULL
  AND (photo_urls IS NULL OR photo_urls = '[]'::jsonb);

-- 3. Add index for queries that filter by photo presence
CREATE INDEX IF NOT EXISTS idx_parent_daily_tasks_has_photos
  ON parent_daily_tasks ((jsonb_array_length(photo_urls)))
  WHERE jsonb_array_length(photo_urls) > 0;

COMMENT ON COLUMN parent_daily_tasks.photo_urls IS 'Array of photo objects. Max 3. Each: {url, uploaded_at, analysis?}. photo_url (legacy) kept for backward compat.';
