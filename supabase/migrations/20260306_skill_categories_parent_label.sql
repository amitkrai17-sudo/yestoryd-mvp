-- ============================================================
-- MIGRATION: Add parent_label to skill_categories
-- ============================================================
-- Parent-facing labels differ from coach/admin labels.
-- e.g. coach sees "Phonics & Letter Sounds", parent sees "Reading & Phonics"
-- ============================================================

ALTER TABLE skill_categories ADD COLUMN IF NOT EXISTS parent_label text;

UPDATE skill_categories SET parent_label = CASE slug
  WHEN 'phonics_letter_sounds' THEN 'Reading & Phonics'
  WHEN 'reading_fluency' THEN 'Reading & Fluency'
  WHEN 'reading_comprehension' THEN 'Comprehension'
  WHEN 'vocabulary_building' THEN 'Vocabulary'
  WHEN 'grammar_syntax' THEN 'Grammar'
  WHEN 'creative_writing' THEN 'Creative Writing'
  WHEN 'pronunciation' THEN 'Speaking & Confidence'
  WHEN 'story_analysis' THEN 'Story Analysis'
  WHEN 'olympiad_prep' THEN 'Olympiad Preparation'
  WHEN 'competition_prep' THEN 'Competition Preparation'
END
WHERE parent_label IS NULL;
