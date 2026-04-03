-- Migration: Add rubric definitions to skill_categories
-- Schema: { "emerging": "...", "developing": "...", "proficient": "...", "mastered": "..." }

ALTER TABLE skill_categories
ADD COLUMN IF NOT EXISTS rubric JSONB;

COMMENT ON COLUMN skill_categories.rubric IS
'Performance rubric definitions per level. Schema: { "emerging": "...", "developing": "...", "proficient": "...", "mastered": "..." }';

-- Populate rubric for all 8 coach-visible categories

UPDATE skill_categories SET rubric = '{
  "emerging": "Recognizes some letters, cannot sound out independently",
  "developing": "Sounds out CVC words, struggles with blends and digraphs",
  "proficient": "Reads blends, digraphs, long vowels with minor errors",
  "mastered": "Decodes unfamiliar words independently using phonics rules"
}'::jsonb WHERE slug = 'phonics_letter_sounds';

UPDATE skill_categories SET rubric = '{
  "emerging": "Reads word-by-word with frequent pauses",
  "developing": "Reads in short phrases, some self-correction",
  "proficient": "Reads smoothly at appropriate pace, occasional stumbles",
  "mastered": "Reads with expression, natural pacing, self-corrects fluently"
}'::jsonb WHERE slug = 'reading_fluency';

UPDATE skill_categories SET rubric = '{
  "emerging": "Recalls isolated details, cannot summarize",
  "developing": "Answers literal questions, struggles with inference",
  "proficient": "Identifies main idea, makes basic inferences",
  "mastered": "Analyzes themes, makes predictions, connects across texts"
}'::jsonb WHERE slug = 'reading_comprehension';

UPDATE skill_categories SET rubric = '{
  "emerging": "Limited word recognition, relies on pictures or context",
  "developing": "Understands common words, guesses unfamiliar ones from context",
  "proficient": "Uses age-appropriate vocabulary, understands multiple meanings",
  "mastered": "Uses precise vocabulary, explains word relationships independently"
}'::jsonb WHERE slug = 'vocabulary_building';

UPDATE skill_categories SET rubric = '{
  "emerging": "Uses incomplete sentences, frequent grammatical errors",
  "developing": "Forms basic sentences, inconsistent tense and agreement",
  "proficient": "Constructs varied sentences with minor errors",
  "mastered": "Uses complex sentences with correct grammar consistently"
}'::jsonb WHERE slug = 'grammar_syntax';

UPDATE skill_categories SET rubric = '{
  "emerging": "Writes isolated words or phrases, no structure",
  "developing": "Writes simple sentences on a topic, limited detail",
  "proficient": "Writes organized paragraphs with descriptive language",
  "mastered": "Writes engaging multi-paragraph pieces with voice and structure"
}'::jsonb WHERE slug = 'creative_writing';

UPDATE skill_categories SET rubric = '{
  "emerging": "Unclear speech, frequently mispronounces common words",
  "developing": "Generally understood, struggles with specific sounds or clusters",
  "proficient": "Clear pronunciation, occasional errors on complex words",
  "mastered": "Speaks clearly with correct stress, rhythm, and intonation"
}'::jsonb WHERE slug = 'pronunciation';

UPDATE skill_categories SET rubric = '{
  "emerging": "Retells events out of order, no analysis",
  "developing": "Retells key events, identifies basic character traits",
  "proficient": "Analyzes character motivation, identifies cause and effect",
  "mastered": "Evaluates themes, compares perspectives, supports opinions with evidence"
}'::jsonb WHERE slug = 'story_analysis';
