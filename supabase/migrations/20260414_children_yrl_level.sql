-- Add YRL (Yestoryd Reading Level) column to children
-- Values: F1-F4 (Foundation), B1-B4 (Building), M1-M4 (Mastery)
-- Source of truth for worksheet/content matching in homework assignment engine.

ALTER TABLE children
ADD COLUMN IF NOT EXISTS yrl_level TEXT
CHECK (yrl_level IS NULL OR yrl_level ~ '^[FBM][1-4]$');

CREATE INDEX IF NOT EXISTS idx_children_yrl_level
ON children(yrl_level) WHERE yrl_level IS NOT NULL;

-- Backfill: default all enrolled/assessment_complete children to stage 1 of their age_band.
-- current_reading_level is NULL for all 12 real students (verified 2026-04-14), so no
-- granular subdivision is possible yet. Session intelligence will refine via updateChildYrlLevel().
UPDATE children SET yrl_level =
  CASE
    WHEN age_band = 'foundation' THEN 'F' || LEAST(GREATEST(COALESCE(NULLIF(current_reading_level, 0), 1), 1), 4)::text
    WHEN age_band = 'building' THEN 'B' || LEAST(GREATEST(COALESCE(NULLIF(current_reading_level, 0), 1), 1), 4)::text
    WHEN age_band = 'mastery' THEN 'M' || LEAST(GREATEST(COALESCE(NULLIF(current_reading_level, 0), 1), 1), 4)::text
    ELSE NULL
  END
WHERE yrl_level IS NULL
  AND age_band IS NOT NULL
  AND (lead_status = 'enrolled' OR status IN ('enrolled', 'active', 'assessment_complete'));
