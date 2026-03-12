-- ============================================================
-- MIGRATION: skill_categories — unified taxonomy for skills
-- ============================================================
-- Creates the skill_categories table (top-level taxonomy),
-- seeds 10 categories (8 coach + 2 parent-only),
-- adds category_id FK to el_modules and el_skills,
-- populates FKs using confirmed mappings,
-- enables RLS (public read, service_role write),
-- and adds updated_at trigger.
-- ============================================================

BEGIN;

-- ── 1. Create skill_categories table ──

CREATE TABLE IF NOT EXISTS skill_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  label           text NOT NULL,
  parent_label    text,
  label_hindi     text,
  icon            text NOT NULL DEFAULT 'BookOpen',
  color           text NOT NULL DEFAULT '#6366f1',
  sort_order      integer NOT NULL DEFAULT 0,
  scope           text NOT NULL DEFAULT 'both'
                  CHECK (scope IN ('coach', 'parent', 'both')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Seed 10 categories ──

INSERT INTO skill_categories (slug, label, parent_label, label_hindi, icon, color, sort_order, scope) VALUES
  ('phonics_letter_sounds', 'Phonics & Letter Sounds',  'Reading & Phonics',        'फोनिक्स और अक्षर ध्वनि',      'Volume2',    '#ef4444', 1,  'both'),
  ('reading_fluency',       'Reading Fluency',           'Reading & Fluency',        'पठन प्रवाह',                   'BookOpen',   '#f97316', 2,  'both'),
  ('reading_comprehension',  'Reading Comprehension',    'Comprehension',            'पठन बोध',                      'Brain',      '#eab308', 3,  'both'),
  ('vocabulary_building',    'Vocabulary Building',       'Vocabulary',               'शब्द भंडार निर्माण',             'Library',    '#22c55e', 4,  'both'),
  ('grammar_syntax',         'Grammar & Syntax',          'Grammar',                 'व्याकरण और वाक्य रचना',        'PenTool',    '#3b82f6', 5,  'both'),
  ('creative_writing',       'Creative Writing',          'Creative Writing',         'रचनात्मक लेखन',                'Feather',    '#8b5cf6', 6,  'both'),
  ('pronunciation',          'Pronunciation & Speaking',  'Speaking & Confidence',    'उच्चारण और बोलना',             'Mic',        '#ec4899', 7,  'both'),
  ('story_analysis',         'Story Analysis',            'Story Analysis',           'कहानी विश्लेषण',               'Search',     '#06b6d4', 8,  'both'),
  ('olympiad_prep',          'Olympiad Prep',             'Olympiad Preparation',     'ओलंपियाड तैयारी',              'Trophy',     '#f59e0b', 9,  'parent'),
  ('competition_prep',       'Competition Prep',          'Competition Preparation',  'प्रतियोगिता तैयारी',            'Award',      '#10b981', 10, 'parent')
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Add category_id FK to el_modules ──

ALTER TABLE el_modules
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES skill_categories(id);

-- ── 4. Add category_id FK to el_skills (for observation skills) ──

ALTER TABLE el_skills
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES skill_categories(id);

-- ── 5. Populate el_modules.category_id ──
-- Mapping: module name → skill_categories slug

UPDATE el_modules SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'phonics_letter_sounds'
  AND el_modules.name IN (
    'Letter Recognition', 'Phonemic Awareness', 'Single Letter Sounds',
    'CVC Words', 'Consonant Blends', 'Digraphs', 'Long Vowels', 'Complex Phonics'
  );

UPDATE el_modules SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'reading_fluency'
  AND el_modules.name IN ('Sight Words', 'Simple Sentences');

UPDATE el_modules SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'reading_comprehension'
  AND el_modules.name IN ('Short Stories', 'Paragraph Reading', 'Reading Comprehension');

UPDATE el_modules SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'vocabulary_building'
  AND el_modules.name = 'Vocabulary Building';

UPDATE el_modules SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'story_analysis'
  AND el_modules.name = 'Story Analysis';

-- ── 6. Populate el_skills.category_id for observation skills ──
-- Only skills with scope='observation' or scope='both' that map to a category.
-- Cross-cutting skills (Confidence, Listening, Retelling) → NULL (no update).

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'phonics_letter_sounds'
  AND el_skills.name IN ('Phonemic Awareness', 'Phonics')
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'reading_fluency'
  AND el_skills.name = 'Fluency'
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'vocabulary_building'
  AND el_skills.name = 'Vocabulary'
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'reading_comprehension'
  AND el_skills.name = 'Comprehension'
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'grammar_syntax'
  AND el_skills.name IN ('Grammar & Sentence Structure', 'Spelling', 'Sentence Formation')
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'pronunciation'
  AND el_skills.name IN ('Pronunciation', 'Expression')
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'creative_writing'
  AND el_skills.name = 'Creativity'
  AND el_skills.scope IN ('observation', 'both');

UPDATE el_skills SET category_id = sc.id
FROM skill_categories sc
WHERE sc.slug = 'story_analysis'
  AND el_skills.name IN ('Reasoning', 'Critical Thinking')
  AND el_skills.scope IN ('observation', 'both');

-- Cross-cutting: Confidence, Listening, Retelling → NULL (no update needed)

-- ── 7. Indexes ──

CREATE INDEX idx_skill_categories_slug ON skill_categories (slug);
CREATE INDEX idx_skill_categories_scope ON skill_categories (scope) WHERE is_active = true;
CREATE INDEX idx_el_modules_category ON el_modules (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_el_skills_category ON el_skills (category_id) WHERE category_id IS NOT NULL;

-- ── 8. updated_at trigger ──

CREATE OR REPLACE FUNCTION update_skill_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_skill_categories_updated_at
  BEFORE UPDATE ON skill_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_categories_updated_at();

-- ── 9. RLS: public read, service_role write ──

ALTER TABLE skill_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill categories"
  ON skill_categories FOR SELECT
  USING (true);

CREATE POLICY "Service role manages skill categories"
  ON skill_categories FOR ALL
  USING (auth.role() = 'service_role');

COMMIT;
