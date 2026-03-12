-- ============================================================
-- MIGRATION: Add category_id FK to scheduled_sessions,
--            session_templates, and el_learning_units
-- ============================================================
-- Backfills scheduled_sessions.category_id from focus_area free text.
-- session_templates.category_id left NULL (requires el_skills chain mapping — TODO).
-- ============================================================

-- ── 1. Add columns ──

ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES skill_categories(id);

ALTER TABLE session_templates
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES skill_categories(id);

ALTER TABLE el_learning_units
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES skill_categories(id);

-- ── 2. Indexes ──

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_category
  ON scheduled_sessions(category_id);

CREATE INDEX IF NOT EXISTS idx_session_templates_category
  ON session_templates(category_id);

-- ── 3. Backfill scheduled_sessions.category_id from focus_area free text ──
-- Done as separate UPDATEs per slug to avoid ambiguous multi-OR matching.

-- phonics_letter_sounds
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'phonics_letter_sounds'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%phonics%'
    OR ss.focus_area ILIKE '%letter%sound%'
    OR ss.focus_area ILIKE '%cvc%'
    OR ss.focus_area ILIKE '%digraph%'
    OR ss.focus_area ILIKE '%blend%'
    OR ss.focus_area = 'phonics_letter_sounds');

-- reading_fluency
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'reading_fluency'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%fluency%'
    OR ss.focus_area ILIKE '%sight_word%'
    OR ss.focus_area ILIKE '%speed%'
    OR ss.focus_area = 'reading_fluency');

-- reading_comprehension
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'reading_comprehension'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%comprehension%'
    OR ss.focus_area ILIKE '%inference%'
    OR ss.focus_area = 'reading_comprehension');

-- vocabulary_building
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'vocabulary_building'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%vocabulary%'
    OR ss.focus_area ILIKE '%vocab%'
    OR ss.focus_area = 'vocabulary_building');

-- grammar_syntax
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'grammar_syntax'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%grammar%'
    OR ss.focus_area ILIKE '%syntax%'
    OR ss.focus_area ILIKE '%sentence%'
    OR ss.focus_area = 'grammar_syntax');

-- creative_writing
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'creative_writing'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%creative%'
    OR ss.focus_area ILIKE '%writing%'
    OR ss.focus_area = 'creative_writing');

-- pronunciation
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'pronunciation'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%pronunciation%'
    OR ss.focus_area ILIKE '%speaking%'
    OR ss.focus_area ILIKE '%confidence%'
    OR ss.focus_area = 'pronunciation');

-- story_analysis
UPDATE scheduled_sessions ss SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'story_analysis'
  AND ss.category_id IS NULL
  AND (ss.focus_area ILIKE '%story%'
    OR ss.focus_area ILIKE '%analysis%'
    OR ss.focus_area = 'story_analysis');

-- ── 4. Diagnostic: find orphan rows (focus_area set but no category mapped) ──
-- Run after migration to check:
--   SELECT focus_area, COUNT(*) FROM scheduled_sessions
--   WHERE focus_area IS NOT NULL AND category_id IS NULL
--   GROUP BY focus_area ORDER BY count DESC;

-- ── 5. session_templates.category_id ──
-- TODO: Backfill requires mapping skill_dimensions[0] → el_skills → el_modules → skill_categories.
-- Left NULL for now. Will be populated when templates are next edited in admin UI.

-- ── 6. el_learning_units.category_id ──
-- el_learning_units has NO direct module_id column.
-- Chain: el_learning_units.skill_id → el_skills.module_id → el_modules.category_id
UPDATE el_learning_units elu SET category_id = em.category_id
FROM el_skills es
JOIN el_modules em ON es.module_id = em.id
WHERE elu.skill_id = es.id
  AND em.category_id IS NOT NULL
  AND elu.category_id IS NULL;
