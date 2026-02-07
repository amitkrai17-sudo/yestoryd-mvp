-- ============================================================================
-- MAKE SUB_SKILL_ID NULLABLE FOR MINI CHALLENGES
-- Date: 2026-02-06
-- Purpose: Allow mini challenges to exist without a sub_skill_id
-- ============================================================================

-- Make sub_skill_id nullable (mini challenges don't belong to a sub-skill)
ALTER TABLE elearning_units
ALTER COLUMN sub_skill_id DROP NOT NULL;

-- Add check constraint: regular units must have sub_skill_id, mini challenges must not
ALTER TABLE elearning_units
ADD CONSTRAINT chk_mini_challenge_sub_skill
CHECK (
  (is_mini_challenge = true AND sub_skill_id IS NULL) OR
  (is_mini_challenge = false AND sub_skill_id IS NOT NULL) OR
  (is_mini_challenge IS NULL AND sub_skill_id IS NOT NULL)
);

-- Verify
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'elearning_units'
AND column_name = 'sub_skill_id';
