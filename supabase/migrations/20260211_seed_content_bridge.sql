-- =============================================================================
-- FILE: supabase/migrations/20260211_seed_content_bridge.sql
-- PURPOSE: Seed test data for the content bridge — el_learning_units with
--          coach_guidance, parent_instruction, content_code; linked videos +
--          worksheets; one session_template activity_flow with content_refs
-- =============================================================================

-- ── 1. Seed skills (idempotent) ───────────────────────────────────────────────
INSERT INTO el_skills (id, name, skill_tag, order_index, description, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Phonemic Awareness', 'phonemic_awareness', 1,
   'Ability to hear, identify, and manipulate individual sounds in spoken words', true),
  ('a1000000-0000-0000-0000-000000000002', 'Phonics', 'phonics', 2,
   'Understanding the relationship between letters and sounds', true),
  ('a1000000-0000-0000-0000-000000000003', 'Fluency', 'fluency', 3,
   'Ability to read with speed, accuracy, and proper expression', true),
  ('a1000000-0000-0000-0000-000000000004', 'Vocabulary', 'vocabulary', 4,
   'Knowledge of words and their meanings', true),
  ('a1000000-0000-0000-0000-000000000005', 'Comprehension', 'comprehension', 5,
   'Ability to understand and interpret what is read', true)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Seed el_learning_units with coach_guidance, parent_instruction, content_code ──
INSERT INTO el_learning_units (
  id, name, description, skill_id, content_code, icon_emoji,
  min_age, max_age, status, display_order, difficulty,
  coach_guidance, parent_instruction, tags, is_active
)
VALUES
  -- Unit 1: Rhyming Pairs (Foundation, Phonemic Awareness)
  (
    'b1000000-0000-0000-0000-000000000001',
    'Rhyming Pairs',
    'Recognising and producing rhyming word pairs to build phonological awareness.',
    'a1000000-0000-0000-0000-000000000001',
    'PA-RHYME-01',
    '🎵',
    4, 6, 'published', 1, '2',
    '{"warm_up":"Start with familiar nursery rhyme, pause at rhyming words","scaffolding":"Use picture cards if child struggles with auditory-only","challenge":"Ask child to generate their own rhyming pair","red_flags":["Cannot identify any rhymes after 3 examples","Confuses rhyming with alliteration"]}',
    'Practice rhyming at home! While reading bedtime stories, pause before a rhyming word and let your child guess. Play "What rhymes with cat?" during car rides.',
    ARRAY['phonemic-awareness','foundation','warm-up'],
    true
  ),
  -- Unit 2: Letter-Sound Mapping (Foundation, Phonics)
  (
    'b1000000-0000-0000-0000-000000000002',
    'Letter-Sound Mapping',
    'Connecting letters to their primary sounds using multi-sensory approaches.',
    'a1000000-0000-0000-0000-000000000002',
    'PH-LETMAP-01',
    '🔤',
    4, 6, 'published', 2, '2',
    '{"warm_up":"Show 3-4 familiar letter flashcards, ask for sounds","scaffolding":"Use sandpaper letters for tactile learners","challenge":"Blend 2-3 letter sounds into CVC words","red_flags":["Consistently reverses b/d after explicit instruction","Cannot recall any letter sounds from previous session"]}',
    'Put letter magnets on the fridge. Each morning ask your child to find a letter and say its sound. Celebrate every correct answer with a high-five!',
    ARRAY['phonics','foundation','letter-sounds'],
    true
  ),
  -- Unit 3: Sight Word Speedway (Foundation, Fluency)
  (
    'b1000000-0000-0000-0000-000000000003',
    'Sight Word Speedway',
    'Building automatic recognition of high-frequency sight words through timed games.',
    'a1000000-0000-0000-0000-000000000003',
    'FL-SIGHT-01',
    '🏎️',
    4, 7, 'published', 3, '3',
    '{"warm_up":"Flash 5 known sight words for confidence","scaffolding":"Reduce word count to 3 if child shows frustration","challenge":"Add a new word from the current reading passage","red_flags":["Reading speed decreases session over session","Guessing based on first letter only"]}',
    'Make flashcards of the 5 sight words from today''s session. Practice for 2 minutes every evening — try to beat yesterday''s time!',
    ARRAY['fluency','foundation','sight-words','timed'],
    true
  ),
  -- Unit 4: Story Vocabulary Builder (Building, Vocabulary)
  (
    'b1000000-0000-0000-0000-000000000004',
    'Story Vocabulary Builder',
    'Learning new words in context through engaging stories and picture prompts.',
    'a1000000-0000-0000-0000-000000000004',
    'VC-STORY-01',
    '📖',
    7, 9, 'published', 4, '4',
    '{"warm_up":"Review 3 words from last session with sentence prompts","scaffolding":"Provide visual context clues before asking for definitions","challenge":"Child uses each new word in an original sentence","red_flags":["Cannot recall any previously taught words","Struggles with words 2+ grade levels below expected"]}',
    'When you see a new word while reading together, pause and discuss what it might mean. Keep a ''Word Wall'' on the refrigerator with new words your child learns each week.',
    ARRAY['vocabulary','building','context-clues'],
    true
  ),
  -- Unit 5: Reading Detective (Mastery, Comprehension)
  (
    'b1000000-0000-0000-0000-000000000005',
    'Reading Detective',
    'Developing inference and critical thinking through passage analysis with evidence-based questions.',
    'a1000000-0000-0000-0000-000000000005',
    'CM-DETECT-01',
    '🔍',
    10, 12, 'published', 5, '6',
    '{"warm_up":"Preview passage title and images, make predictions","scaffolding":"Highlight key sentences, use graphic organiser","challenge":"Compare two passages on the same topic","red_flags":["Cannot identify main idea after full read","Answers are always literal, no inference capability"]}',
    'After your child reads a chapter book, ask open-ended questions: "Why do you think the character did that?" and "What might happen next?" Encourage them to find evidence in the text.',
    ARRAY['comprehension','mastery','inference','critical-thinking'],
    true
  )
ON CONFLICT (id) DO NOTHING;

-- ── 3. Seed el_videos linked to the skills ──────────────────────────────────
INSERT INTO el_videos (
  id, title, description, skill_id, duration_seconds, has_quiz,
  status, video_source, video_id, display_order, is_active, key_concepts
)
VALUES
  -- 2 videos for Phonemic Awareness skill
  (
    'c1000000-0000-0000-0000-000000000001',
    'Rhyming Pairs Intro',
    'Fun animated introduction to rhyming words with sing-along examples.',
    'a1000000-0000-0000-0000-000000000001',
    180, false, 'published', 'youtube', 'example-rhyme-01', 1, true,
    ARRAY['rhyming','phonological-awareness','listening']
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'Rhyme Time Game Explainer',
    'How to play the rhyming pairs matching game with picture cards.',
    'a1000000-0000-0000-0000-000000000001',
    120, false, 'published', 'youtube', 'example-rhyme-02', 2, true,
    ARRAY['rhyming','game','matching']
  ),
  -- 1 video for Phonics skill
  (
    'c1000000-0000-0000-0000-000000000003',
    'Letter Sounds A-M',
    'Animated tour of letter sounds from A to M with mouth position demonstrations.',
    'a1000000-0000-0000-0000-000000000002',
    240, true, 'published', 'youtube', 'example-phonics-01', 1, true,
    ARRAY['phonics','letter-sounds','articulation']
  )
ON CONFLICT (id) DO NOTHING;

-- ── 4. Seed el_worksheets linked to learning units ──────────────────────────
INSERT INTO el_worksheets (
  id, unit_id, title, asset_url, asset_format, description,
  display_order, is_active
)
VALUES
  (
    'd1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'Rhyming Pairs Practice Sheet',
    'https://storage.example.com/worksheets/pa-rhyme-01.pdf',
    'pdf',
    'Match the rhyming words and draw lines between pairs. Color the pictures.',
    1, true
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000002',
    'Letter-Sound Tracing Cards',
    'https://storage.example.com/worksheets/ph-letmap-01.pdf',
    'pdf',
    'Trace each letter while saying its sound. Circle pictures that start with that sound.',
    1, true
  )
ON CONFLICT (id) DO NOTHING;

-- ── 5. Update one session_template activity_flow with content_refs ───────────
-- This updates the FIRST foundation template (by recommended_order) to have
-- V2-format activity_flow with content_refs pointing to the seeded content.
-- Uses a CTE to find the target template safely.
DO $$
DECLARE
  target_template_id UUID;
BEGIN
  -- Find the first active foundation template
  SELECT id INTO target_template_id
  FROM session_templates
  WHERE age_band = 'foundation' AND is_active = true
  ORDER BY recommended_order ASC
  LIMIT 1;

  IF target_template_id IS NOT NULL THEN
    UPDATE session_templates
    SET activity_flow = '[
      {
        "time": "0-5",
        "activity": "Warm-up: Rhyming Pairs",
        "purpose": "Phonological awareness activation",
        "activity_id": "act_01",
        "activity_name": "Warm-up: Rhyming Pairs",
        "planned_duration_minutes": 5,
        "content_refs": [
          {"type": "video", "id": "c1000000-0000-0000-0000-000000000001", "label": "Rhyming Pairs Intro"},
          {"type": "worksheet", "id": "d1000000-0000-0000-0000-000000000001", "label": "Rhyming Pairs Practice Sheet"}
        ],
        "is_required": true,
        "coach_can_substitute": false
      },
      {
        "time": "5-15",
        "activity": "Letter-Sound Mapping Drill",
        "purpose": "Connect letters to their primary sounds",
        "activity_id": "act_02",
        "activity_name": "Letter-Sound Mapping Drill",
        "planned_duration_minutes": 10,
        "content_refs": [
          {"type": "video", "id": "c1000000-0000-0000-0000-000000000003", "label": "Letter Sounds A-M"},
          {"type": "worksheet", "id": "d1000000-0000-0000-0000-000000000002", "label": "Letter-Sound Tracing Cards"}
        ],
        "is_required": true,
        "coach_can_substitute": true
      },
      {
        "time": "15-25",
        "activity": "Sight Word Speedway Game",
        "purpose": "Build automatic word recognition",
        "activity_id": "act_03",
        "activity_name": "Sight Word Speedway Game",
        "planned_duration_minutes": 10,
        "content_refs": [
          {"type": "video", "id": "c1000000-0000-0000-0000-000000000002", "label": "Rhyme Time Game Explainer"}
        ],
        "is_required": false,
        "coach_can_substitute": true
      },
      {
        "time": "25-30",
        "activity": "Celebration + Parent Handoff",
        "purpose": "Reinforce progress and set home practice",
        "activity_id": "act_04",
        "activity_name": "Celebration + Parent Handoff",
        "planned_duration_minutes": 5,
        "content_refs": [],
        "is_required": true,
        "coach_can_substitute": false
      }
    ]'::jsonb,
    updated_at = NOW()
    WHERE id = target_template_id;

    RAISE NOTICE 'Updated template % with V2 activity_flow + content_refs', target_template_id;
  ELSE
    RAISE NOTICE 'No foundation template found — skipping activity_flow update';
  END IF;
END $$;
