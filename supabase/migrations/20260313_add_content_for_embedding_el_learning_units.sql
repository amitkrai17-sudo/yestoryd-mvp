-- Migration: 20260313_add_content_for_embedding_el_learning_units
-- Purpose: Add persisted source text column for embedding regeneration safety.
--          69 rows have embeddings but no record of what text produced them.
--          Backfill approximates buildContentSearchableText() from lib/rai/embeddings.ts.
-- Author: Amit / Claude Code
-- Related: Deep Embedding Audit March 13, 2026

-- ═══════════════════════════════════════════════════
-- ADD COLUMN
-- ═══════════════════════════════════════════════════

ALTER TABLE el_learning_units ADD COLUMN IF NOT EXISTS content_for_embedding TEXT;

COMMENT ON COLUMN el_learning_units.content_for_embedding
  IS 'Persisted source text for embedding generation. Required for model migration safety. Matches buildContentSearchableText() output.';

-- ═══════════════════════════════════════════════════
-- BACKFILL from existing fields
-- Mirrors buildContentSearchableText() in lib/rai/embeddings.ts:
--   name | code: X | skill: X | description | stage: X | difficulty: X
--   | topics: X | key concepts: X | watch for: X | parent guidance: X
--   | quest: X | quest_description
-- ═══════════════════════════════════════════════════

UPDATE el_learning_units u
SET content_for_embedding = CONCAT_WS(' ',
  -- Core identity
  u.name,
  CASE WHEN u.content_code IS NOT NULL THEN 'code: ' || u.content_code END,
  -- Skill name from join
  (SELECT 'skill: ' || s.name FROM el_skills s WHERE s.id = u.skill_id),
  -- Description
  u.description,
  -- Arc stage with labels
  CASE u.arc_stage
    WHEN 'assess' THEN 'stage: assessment and diagnostic'
    WHEN 'remediate' THEN 'stage: remediation and practice'
    WHEN 'celebrate' THEN 'stage: celebration and mastery'
    WHEN NULL THEN NULL
    ELSE 'stage: ' || u.arc_stage
  END,
  -- Difficulty
  CASE WHEN u.difficulty IS NOT NULL THEN 'difficulty: ' || u.difficulty END,
  -- Tags array
  CASE WHEN u.tags IS NOT NULL AND array_length(u.tags, 1) > 0
    THEN 'topics: ' || array_to_string(u.tags, ', ')
  END,
  -- Coach guidance JSONB sub-fields
  CASE WHEN u.coach_guidance IS NOT NULL AND u.coach_guidance->'key_concepts' IS NOT NULL
    THEN 'key concepts: ' || (
      SELECT string_agg(elem::text, ', ')
      FROM jsonb_array_elements_text(u.coach_guidance->'key_concepts') elem
    )
  END,
  CASE WHEN u.coach_guidance IS NOT NULL AND u.coach_guidance->'red_flags' IS NOT NULL
    THEN 'watch for: ' || (
      SELECT string_agg(elem::text, ', ')
      FROM jsonb_array_elements_text(u.coach_guidance->'red_flags') elem
    )
  END,
  CASE WHEN u.coach_guidance IS NOT NULL AND u.coach_guidance->>'warm_up' IS NOT NULL
    THEN 'warm up: ' || (u.coach_guidance->>'warm_up')
  END,
  CASE WHEN u.coach_guidance IS NOT NULL AND u.coach_guidance->>'wrap_up' IS NOT NULL
    THEN 'wrap up: ' || (u.coach_guidance->>'wrap_up')
  END,
  -- Parent instruction
  CASE WHEN u.parent_instruction IS NOT NULL THEN 'parent guidance: ' || u.parent_instruction END,
  -- Quest context
  CASE WHEN u.quest_title IS NOT NULL THEN 'quest: ' || u.quest_title END,
  u.quest_description
)
WHERE u.content_for_embedding IS NULL;
