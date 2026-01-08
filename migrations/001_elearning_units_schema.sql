-- =============================================================================
-- YESTORYD E-LEARNING V2: UNITS + GAME ENGINES + CONTENT POOLS
-- Complete database schema migration (FIXED VERSION)
-- Run this in Supabase SQL Editor
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 1: SKILLS TAXONOMY (What we teach)                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Skills are the learning objectives (e.g., "digraphs", "blends", "sight-words")
CREATE TABLE IF NOT EXISTS elearning_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,                    -- "Digraphs"
  slug VARCHAR(100) UNIQUE NOT NULL,             -- "digraphs"
  description TEXT,                              -- "Two letters that make one sound"
  category VARCHAR(50) NOT NULL,                 -- "phonics", "fluency", "comprehension"
  level INT NOT NULL DEFAULT 1,                  -- 1=Pre-Reading, 2=Early, 3=Fluent
  display_order INT NOT NULL DEFAULT 0,          -- For UI ordering
  icon_emoji VARCHAR(10) DEFAULT '📚',           -- Visual identifier
  color_hex VARCHAR(7) DEFAULT '#FF0099',        -- Brand color for this skill
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-skills are specific items within a skill (e.g., "th-sound" within "digraphs")
CREATE TABLE IF NOT EXISTS elearning_sub_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES elearning_skills(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                    -- "TH Sound"
  slug VARCHAR(100) NOT NULL,                    -- "th-sound"
  description TEXT,                              -- "Voiced and voiceless th"
  keywords TEXT[] DEFAULT '{}',                  -- ["th", "voiced", "voiceless", "this", "think"]
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, slug)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 2: CONTENT POOLS (Reusable word/image banks for games)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Content pools are collections of words/items used by game engines
CREATE TABLE IF NOT EXISTS elearning_content_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_skill_id UUID REFERENCES elearning_sub_skills(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,                    -- "TH Words - Beginning"
  slug VARCHAR(100) UNIQUE NOT NULL,             -- "th-words-beginning"
  pool_type VARCHAR(50) NOT NULL,                -- "words", "sentences", "images", "audio"
  difficulty VARCHAR(20) DEFAULT 'medium',       -- "easy", "medium", "hard"
  
  -- The actual content (flexible JSONB)
  content JSONB NOT NULL DEFAULT '[]',
  /*
    Example for words pool:
    [
      {"word": "this", "image_url": "/images/this.png", "audio_url": "/audio/this.mp3"},
      {"word": "that", "image_url": "/images/that.png", "audio_url": "/audio/that.mp3"},
      {"word": "the", "image_url": "/images/the.png", "audio_url": "/audio/the.mp3"}
    ]
    
    Example for sentences pool:
    [
      {"sentence": "This is a cat.", "words": ["This", "is", "a", "cat"]},
      {"sentence": "The dog is big.", "words": ["The", "dog", "is", "big"]}
    ]
  */
  
  item_count INT DEFAULT 0,                      -- Updated by trigger
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update item_count when content changes
CREATE OR REPLACE FUNCTION update_content_pool_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.item_count := jsonb_array_length(COALESCE(NEW.content, '[]'::JSONB));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_pool_count ON elearning_content_pools;
CREATE TRIGGER trg_content_pool_count
  BEFORE INSERT OR UPDATE OF content ON elearning_content_pools
  FOR EACH ROW EXECUTE FUNCTION update_content_pool_count();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 3: GAME ENGINES (Reusable game mechanics)                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Game engines are the reusable game types
CREATE TABLE IF NOT EXISTS elearning_game_engines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,                    -- "Word Match"
  slug VARCHAR(50) UNIQUE NOT NULL,              -- "word-match"
  description TEXT,                              -- "Drag words to matching images"
  component_name VARCHAR(100) NOT NULL,          -- "WordMatchGame" (React component)
  
  -- Game configuration schema (what props the component expects)
  config_schema JSONB NOT NULL DEFAULT '{}',
  /*
    Example:
    {
      "items_per_round": {"type": "number", "default": 6, "min": 4, "max": 10},
      "time_limit_seconds": {"type": "number", "default": 60, "optional": true},
      "show_hints": {"type": "boolean", "default": true},
      "audio_enabled": {"type": "boolean", "default": true}
    }
  */
  
  -- Default XP rewards
  base_xp_reward INT DEFAULT 20,
  perfect_bonus_xp INT DEFAULT 10,
  
  -- Supported content pool types
  supported_pool_types TEXT[] DEFAULT ARRAY['words'],
  
  -- UI metadata
  icon_emoji VARCHAR(10) DEFAULT '🎮',
  preview_image_url TEXT,
  estimated_minutes INT DEFAULT 3,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the 5 core game engines
INSERT INTO elearning_game_engines (name, slug, description, component_name, config_schema, base_xp_reward, icon_emoji, supported_pool_types, estimated_minutes) VALUES
(
  'Word Match',
  'word-match',
  'Drag words to matching images or sounds',
  'WordMatchGame',
  '{
    "items_per_round": {"type": "number", "default": 6, "min": 4, "max": 10},
    "match_type": {"type": "string", "default": "image", "options": ["image", "audio", "definition"]},
    "show_hints": {"type": "boolean", "default": true},
    "audio_enabled": {"type": "boolean", "default": true}
  }',
  20, '🎯', ARRAY['words'], 3
),
(
  'Phonics Pop',
  'phonics-pop',
  'Pop bubbles with the correct sound',
  'PhonicsPopGame',
  '{
    "bubbles_per_round": {"type": "number", "default": 10, "min": 5, "max": 15},
    "speed": {"type": "string", "default": "medium", "options": ["slow", "medium", "fast"]},
    "lives": {"type": "number", "default": 3}
  }',
  25, '🫧', ARRAY['words', 'sounds'], 3
),
(
  'Sentence Builder',
  'sentence-builder',
  'Arrange words to form correct sentences',
  'SentenceBuilderGame',
  '{
    "sentences_per_round": {"type": "number", "default": 5, "min": 3, "max": 8},
    "show_punctuation": {"type": "boolean", "default": true},
    "audio_sentence": {"type": "boolean", "default": true}
  }',
  30, '🧱', ARRAY['sentences'], 4
),
(
  'Story Sequence',
  'story-sequence',
  'Order story pictures in the correct sequence',
  'StorySequenceGame',
  '{
    "images_per_story": {"type": "number", "default": 4, "min": 3, "max": 6},
    "stories_per_round": {"type": "number", "default": 2}
  }',
  35, '📖', ARRAY['stories', 'images'], 5
),
(
  'Rhyme Time',
  'rhyme-time',
  'Find words that rhyme',
  'RhymeTimeGame',
  '{
    "pairs_per_round": {"type": "number", "default": 6, "min": 4, "max": 10},
    "show_images": {"type": "boolean", "default": true},
    "time_limit_seconds": {"type": "number", "default": 90}
  }',
  20, '🎵', ARRAY['words', 'rhymes'], 3
)
ON CONFLICT (slug) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 4: LEARNING UNITS (The main building blocks)                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Units are complete learning experiences (Video + Game + Video + Quiz)
CREATE TABLE IF NOT EXISTS elearning_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_skill_id UUID NOT NULL REFERENCES elearning_sub_skills(id) ON DELETE CASCADE,
  
  -- Basic info
  name VARCHAR(200) NOT NULL,                    -- "TH Sound Adventure"
  slug VARCHAR(200) UNIQUE NOT NULL,             -- "th-sound-adventure"
  quest_title VARCHAR(200),                      -- "Master the TH Sound!" (kid-friendly)
  description TEXT,
  
  -- Sequence of activities (JSONB array)
  sequence JSONB NOT NULL DEFAULT '[]',
  /*
    Example:
    [
      {
        "order": 1,
        "type": "video",
        "video_id": "uuid-here",
        "title": "Introduction to TH",
        "xp_reward": 10
      },
      {
        "order": 2,
        "type": "game",
        "game_engine_slug": "word-match",
        "content_pool_id": "uuid-here",
        "config": {"items_per_round": 6},
        "title": "Match TH Words",
        "xp_reward": 20
      },
      {
        "order": 3,
        "type": "video",
        "video_id": "uuid-here-2",
        "title": "TH Practice",
        "xp_reward": 10
      },
      {
        "order": 4,
        "type": "quiz",
        "quiz_id": "uuid-here",
        "title": "TH Sound Quiz",
        "xp_reward": 50,
        "passing_score": 70
      }
    ]
  */
  
  -- Computed fields (updated by trigger)
  total_xp_reward INT DEFAULT 0,
  activity_count INT DEFAULT 0,
  
  estimated_minutes INT DEFAULT 10,
  
  -- Difficulty and targeting
  difficulty VARCHAR(20) DEFAULT 'medium',       -- "easy", "medium", "hard"
  min_age INT DEFAULT 4,
  max_age INT DEFAULT 12,
  level INT DEFAULT 1,                           -- 1, 2, 3
  
  -- Visual/UI
  icon_emoji VARCHAR(10) DEFAULT '📚',
  thumbnail_url TEXT,
  color_hex VARCHAR(7) DEFAULT '#FF0099',
  
  -- Publishing
  status VARCHAR(20) DEFAULT 'draft',            -- "draft", "published", "archived"
  published_at TIMESTAMPTZ,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',                      -- For RAG/search
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update computed fields when sequence changes
CREATE OR REPLACE FUNCTION update_unit_computed_fields()
RETURNS TRIGGER AS $$
DECLARE
  total_xp INT := 0;
  item JSONB;
BEGIN
  -- Calculate total XP from sequence
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.sequence, '[]'::JSONB))
  LOOP
    total_xp := total_xp + COALESCE((item->>'xp_reward')::INT, 0);
  END LOOP;
  
  NEW.total_xp_reward := total_xp;
  NEW.activity_count := jsonb_array_length(COALESCE(NEW.sequence, '[]'::JSONB));
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_unit_computed_fields ON elearning_units;
CREATE TRIGGER trg_unit_computed_fields
  BEFORE INSERT OR UPDATE OF sequence ON elearning_units
  FOR EACH ROW EXECUTE FUNCTION update_unit_computed_fields();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 5: UNIT PREREQUISITES (Mastery-based unlocking)                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS elearning_unit_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES elearning_units(id) ON DELETE CASCADE,
  requires_unit_id UUID NOT NULL REFERENCES elearning_units(id) ON DELETE CASCADE,
  required_score INT DEFAULT 80,                 -- Must score 80%+ to unlock
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_id, requires_unit_id),
  CHECK (unit_id != requires_unit_id)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 6: CHILD UNIT PROGRESS (Tracking completion per child)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS child_unit_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES elearning_units(id) ON DELETE CASCADE,
  
  -- Overall progress
  status VARCHAR(20) DEFAULT 'not_started',      -- "not_started", "in_progress", "completed"
  current_step INT DEFAULT 0,                    -- Which activity they're on (0-indexed)
  completion_percentage INT DEFAULT 0,
  
  -- Detailed step progress (JSONB)
  step_progress JSONB DEFAULT '[]',
  /*
    Example:
    [
      {"step": 0, "type": "video", "completed": true, "completed_at": "...", "xp_earned": 10},
      {"step": 1, "type": "game", "completed": true, "score": 85, "xp_earned": 20},
      {"step": 2, "type": "video", "completed": false},
      {"step": 3, "type": "quiz", "completed": false}
    ]
  */
  
  -- Scoring
  total_xp_earned INT DEFAULT 0,
  best_score INT DEFAULT 0,                      -- Best quiz/overall score
  attempts INT DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Spaced repetition (for review scheduling)
  next_review_at TIMESTAMPTZ,
  review_count INT DEFAULT 0,
  ease_factor FLOAT DEFAULT 2.5,                 -- SM-2 algorithm
  interval_days INT DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(child_id, unit_id)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 7: CHILD GAME PROGRESS (Track individual game plays)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS child_game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES elearning_units(id) ON DELETE SET NULL,
  game_engine_slug VARCHAR(50) NOT NULL,
  content_pool_id UUID REFERENCES elearning_content_pools(id) ON DELETE SET NULL,
  
  -- Game results
  score INT NOT NULL,
  max_score INT NOT NULL,
  percentage INT DEFAULT 0,                      -- Updated by trigger
  
  -- Detailed results
  correct_items INT DEFAULT 0,
  total_items INT DEFAULT 0,
  time_taken_seconds INT,
  mistakes JSONB DEFAULT '[]',                   -- Track what they got wrong for analysis
  
  -- XP
  xp_earned INT DEFAULT 0,
  is_perfect BOOLEAN DEFAULT false,
  
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to calculate percentage
CREATE OR REPLACE FUNCTION update_game_percentage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.max_score > 0 THEN
    NEW.percentage := ROUND((NEW.score::FLOAT / NEW.max_score) * 100);
  ELSE
    NEW.percentage := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_percentage ON child_game_progress;
CREATE TRIGGER trg_game_percentage
  BEFORE INSERT OR UPDATE OF score, max_score ON child_game_progress
  FOR EACH ROW EXECUTE FUNCTION update_game_percentage();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 8: DAILY GOALS (Habit formation)                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS child_daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Goal configuration
  target_activities INT DEFAULT 3,               -- Complete 3 activities
  target_minutes INT DEFAULT 15,                 -- Or 15 minutes
  
  -- Progress
  completed_activities INT DEFAULT 0,
  completed_minutes INT DEFAULT 0,
  is_achieved BOOLEAN DEFAULT false,
  achieved_at TIMESTAMPTZ,
  
  -- Rewards
  xp_bonus INT DEFAULT 25,                       -- Bonus for completing daily goal
  treasure_claimed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(child_id, goal_date)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 9: RAI RECOMMENDATIONS LOG (Track what rAI suggests)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS rai_recommendation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  
  -- What was recommended
  recommended_units UUID[] DEFAULT '{}',
  focus_area VARCHAR(100),                       -- "digraphs"
  focus_reason TEXT,                             -- "Based on coaching session"
  focus_source VARCHAR(100),                     -- "Session on Dec 28"
  
  -- AI analysis
  gemini_response JSONB,                         -- Full AI response for debugging
  
  -- User interaction
  user_selected_unit UUID,
  was_override BOOLEAN DEFAULT false,            -- Did user use "Ask rAI"?
  override_topic VARCHAR(100),                   -- What they asked for instead
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 10: CHILD BADGES TABLE                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS child_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  badge_slug VARCHAR(100) NOT NULL,
  badge_name VARCHAR(100) NOT NULL,
  badge_icon VARCHAR(20) DEFAULT '🏆',
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, badge_slug)
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 11: ELEARNING QUIZZES TABLE (for standalone quizzes)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS elearning_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_skill_id UUID REFERENCES elearning_sub_skills(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  /*
    Example:
    [
      {
        "id": "q1",
        "question": "Which word starts with TH?",
        "options": ["cat", "think", "dog", "run"],
        "correct_answer": 1,
        "explanation": "Think starts with TH sound"
      }
    ]
  */
  passing_score INT DEFAULT 70,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 12: INDEXES FOR PERFORMANCE                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Skills
CREATE INDEX IF NOT EXISTS idx_skills_category ON elearning_skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_level ON elearning_skills(level);
CREATE INDEX IF NOT EXISTS idx_sub_skills_skill ON elearning_sub_skills(skill_id);

-- Content pools
CREATE INDEX IF NOT EXISTS idx_content_pools_sub_skill ON elearning_content_pools(sub_skill_id);
CREATE INDEX IF NOT EXISTS idx_content_pools_type ON elearning_content_pools(pool_type);

-- Units
CREATE INDEX IF NOT EXISTS idx_units_sub_skill ON elearning_units(sub_skill_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON elearning_units(status);
CREATE INDEX IF NOT EXISTS idx_units_level ON elearning_units(level);
CREATE INDEX IF NOT EXISTS idx_units_tags ON elearning_units USING gin(tags);

-- Child progress
CREATE INDEX IF NOT EXISTS idx_child_unit_progress_child ON child_unit_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_child_unit_progress_status ON child_unit_progress(status);
CREATE INDEX IF NOT EXISTS idx_child_unit_progress_review ON child_unit_progress(next_review_at) 
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_child_game_progress_child ON child_game_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_child_game_progress_played ON child_game_progress(played_at);

-- Daily goals
CREATE INDEX IF NOT EXISTS idx_daily_goals_child_date ON child_daily_goals(child_id, goal_date);

-- RAI logs
CREATE INDEX IF NOT EXISTS idx_rai_logs_child ON rai_recommendation_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_rai_logs_created ON rai_recommendation_logs(created_at);

-- Badges
CREATE INDEX IF NOT EXISTS idx_child_badges_child ON child_badges(child_id);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 13: HELPER FUNCTIONS                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Function to check if a unit is unlocked for a child
CREATE OR REPLACE FUNCTION is_unit_unlocked(p_child_id UUID, p_unit_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  prereq RECORD;
  child_score INT;
BEGIN
  -- Check all prerequisites
  FOR prereq IN 
    SELECT requires_unit_id, required_score 
    FROM elearning_unit_prerequisites 
    WHERE unit_id = p_unit_id
  LOOP
    -- Get child's score for required unit
    SELECT best_score INTO child_score
    FROM child_unit_progress
    WHERE child_id = p_child_id AND unit_id = prereq.requires_unit_id;
    
    -- If no progress or score below required, unit is locked
    IF child_score IS NULL OR child_score < prereq.required_score THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  -- All prerequisites met (or no prerequisites)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get next review date (SM-2 spaced repetition)
CREATE OR REPLACE FUNCTION calculate_next_review(
  p_quality INT,           -- 0-5 rating (5 = perfect recall)
  p_ease_factor FLOAT,
  p_interval_days INT,
  p_review_count INT
)
RETURNS TABLE(new_interval INT, new_ease FLOAT, next_review TIMESTAMPTZ) AS $$
DECLARE
  calc_ease FLOAT;
  calc_interval INT;
BEGIN
  -- Update ease factor
  calc_ease := p_ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
  IF calc_ease < 1.3 THEN calc_ease := 1.3; END IF;
  
  -- Calculate new interval
  IF p_quality < 3 THEN
    calc_interval := 1;  -- Reset if poor performance
  ELSIF p_review_count = 0 THEN
    calc_interval := 1;
  ELSIF p_review_count = 1 THEN
    calc_interval := 6;
  ELSE
    calc_interval := ROUND(p_interval_days * calc_ease);
  END IF;
  
  RETURN QUERY SELECT 
    calc_interval, 
    calc_ease, 
    (NOW() + (calc_interval || ' days')::INTERVAL)::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update daily goal progress
CREATE OR REPLACE FUNCTION update_daily_goal_progress(
  p_child_id UUID,
  p_activities_delta INT DEFAULT 1,
  p_minutes_delta INT DEFAULT 0
)
RETURNS child_daily_goals AS $$
DECLARE
  goal child_daily_goals;
BEGIN
  -- Upsert today's goal
  INSERT INTO child_daily_goals (child_id, goal_date, completed_activities, completed_minutes)
  VALUES (p_child_id, CURRENT_DATE, p_activities_delta, p_minutes_delta)
  ON CONFLICT (child_id, goal_date) DO UPDATE SET
    completed_activities = child_daily_goals.completed_activities + p_activities_delta,
    completed_minutes = child_daily_goals.completed_minutes + p_minutes_delta,
    updated_at = NOW()
  RETURNING * INTO goal;
  
  -- Check if goal achieved
  IF NOT goal.is_achieved AND (
    goal.completed_activities >= goal.target_activities OR
    goal.completed_minutes >= goal.target_minutes
  ) THEN
    UPDATE child_daily_goals SET
      is_achieved = true,
      achieved_at = NOW()
    WHERE id = goal.id
    RETURNING * INTO goal;
  END IF;
  
  RETURN goal;
END;
$$ LANGUAGE plpgsql;

-- Function to add XP to a child
CREATE OR REPLACE FUNCTION add_xp(p_child_id UUID, p_xp_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE child_gamification
  SET total_xp = total_xp + p_xp_amount,
      updated_at = NOW()
  WHERE child_id = p_child_id;
  
  -- If no row updated, insert new gamification record
  IF NOT FOUND THEN
    INSERT INTO child_gamification (child_id, total_xp)
    VALUES (p_child_id, p_xp_amount)
    ON CONFLICT (child_id) DO UPDATE SET
      total_xp = child_gamification.total_xp + p_xp_amount,
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 14: ROW LEVEL SECURITY                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Enable RLS on child-related tables
ALTER TABLE child_unit_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rai_recommendation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Parents can view their children's unit progress" ON child_unit_progress;
DROP POLICY IF EXISTS "Parents can update their children's unit progress" ON child_unit_progress;
DROP POLICY IF EXISTS "Parents can view their children's game progress" ON child_game_progress;
DROP POLICY IF EXISTS "Parents can view their children's daily goals" ON child_daily_goals;
DROP POLICY IF EXISTS "Parents can view their children's badges" ON child_badges;

-- Policies for child_unit_progress (parent can see their children's progress)
CREATE POLICY "Parents can view their children's unit progress"
  ON child_unit_progress FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM children 
      WHERE parent_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Parents can update their children's unit progress"
  ON child_unit_progress FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children 
      WHERE parent_email = auth.jwt() ->> 'email'
    )
  );

-- Similar policies for other tables
CREATE POLICY "Parents can view their children's game progress"
  ON child_game_progress FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM children 
      WHERE parent_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Parents can view their children's daily goals"
  ON child_daily_goals FOR ALL
  USING (
    child_id IN (
      SELECT id FROM children 
      WHERE parent_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Parents can view their children's badges"
  ON child_badges FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM children 
      WHERE parent_email = auth.jwt() ->> 'email'
    )
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 15: SEED SAMPLE DATA (Digraphs skill + TH unit)                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Insert Phonics skills
INSERT INTO elearning_skills (name, slug, description, category, level, icon_emoji, color_hex, display_order)
VALUES 
  ('Digraphs', 'digraphs', 'Two letters that make one sound (th, sh, ch, wh)', 'phonics', 2, '🔤', '#FF0099', 1),
  ('Consonant Blends', 'blends', 'Two consonants blended together (bl, cl, fl, br, cr)', 'phonics', 2, '🔠', '#00ABFF', 2),
  ('Sight Words', 'sight-words', 'Common words to recognize instantly', 'vocabulary', 1, '👁️', '#FFDE00', 3),
  ('CVC Words', 'cvc-words', 'Consonant-Vowel-Consonant words (cat, dog, sun)', 'phonics', 1, '📝', '#7B008B', 4)
ON CONFLICT (slug) DO NOTHING;

-- Insert sub-skills for Digraphs (individual inserts to avoid unnest issues)
DO $$
DECLARE
  digraphs_skill_id UUID;
BEGIN
  SELECT id INTO digraphs_skill_id FROM elearning_skills WHERE slug = 'digraphs';
  
  IF digraphs_skill_id IS NOT NULL THEN
    INSERT INTO elearning_sub_skills (skill_id, name, slug, description, keywords, display_order)
    VALUES 
      (digraphs_skill_id, 'TH Sound', 'th-sound', 'Voiced (this, that) and voiceless (think, thank) th sounds', ARRAY['th', 'voiced', 'voiceless', 'this', 'that', 'think', 'thank', 'the'], 1),
      (digraphs_skill_id, 'SH Sound', 'sh-sound', 'The sh sound as in ship, shop, fish', ARRAY['sh', 'ship', 'shop', 'she', 'fish', 'wish'], 2),
      (digraphs_skill_id, 'CH Sound', 'ch-sound', 'The ch sound as in chip, cheese, lunch', ARRAY['ch', 'chip', 'cheese', 'chair', 'lunch', 'much'], 3),
      (digraphs_skill_id, 'WH Sound', 'wh-sound', 'The wh sound as in what, when, where', ARRAY['wh', 'what', 'when', 'where', 'why', 'which'], 4)
    ON CONFLICT (skill_id, slug) DO NOTHING;
  END IF;
END $$;

-- Insert TH words content pool
DO $$
DECLARE
  th_skill_id UUID;
BEGIN
  SELECT id INTO th_skill_id FROM elearning_sub_skills WHERE slug = 'th-sound';
  
  IF th_skill_id IS NOT NULL THEN
    INSERT INTO elearning_content_pools (sub_skill_id, name, slug, pool_type, difficulty, content)
    VALUES (
      th_skill_id,
      'TH Words - Common',
      'th-words-common',
      'words',
      'medium',
      '[
        {"word": "this", "phonetic": "ðɪs", "audio_url": "/audio/th/this.mp3", "image_url": "/images/th/this.png", "type": "voiced"},
        {"word": "that", "phonetic": "ðæt", "audio_url": "/audio/th/that.mp3", "image_url": "/images/th/that.png", "type": "voiced"},
        {"word": "the", "phonetic": "ðə", "audio_url": "/audio/th/the.mp3", "image_url": "/images/th/the.png", "type": "voiced"},
        {"word": "them", "phonetic": "ðɛm", "audio_url": "/audio/th/them.mp3", "image_url": "/images/th/them.png", "type": "voiced"},
        {"word": "think", "phonetic": "θɪŋk", "audio_url": "/audio/th/think.mp3", "image_url": "/images/th/think.png", "type": "voiceless"},
        {"word": "thank", "phonetic": "θæŋk", "audio_url": "/audio/th/thank.mp3", "image_url": "/images/th/thank.png", "type": "voiceless"},
        {"word": "three", "phonetic": "θriː", "audio_url": "/audio/th/three.mp3", "image_url": "/images/th/three.png", "type": "voiceless"},
        {"word": "thumb", "phonetic": "θʌm", "audio_url": "/audio/th/thumb.mp3", "image_url": "/images/th/thumb.png", "type": "voiceless"},
        {"word": "bath", "phonetic": "bɑːθ", "audio_url": "/audio/th/bath.mp3", "image_url": "/images/th/bath.png", "type": "voiceless"},
        {"word": "with", "phonetic": "wɪð", "audio_url": "/audio/th/with.mp3", "image_url": "/images/th/with.png", "type": "voiced"}
      ]'::JSONB
    )
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ E-Learning V2 Schema Created Successfully!';
  RAISE NOTICE '   - elearning_skills table';
  RAISE NOTICE '   - elearning_sub_skills table';
  RAISE NOTICE '   - elearning_content_pools table';
  RAISE NOTICE '   - elearning_game_engines table (5 engines seeded)';
  RAISE NOTICE '   - elearning_units table';
  RAISE NOTICE '   - elearning_unit_prerequisites table';
  RAISE NOTICE '   - child_unit_progress table';
  RAISE NOTICE '   - child_game_progress table';
  RAISE NOTICE '   - child_daily_goals table';
  RAISE NOTICE '   - child_badges table';
  RAISE NOTICE '   - elearning_quizzes table';
  RAISE NOTICE '   - rai_recommendation_logs table';
  RAISE NOTICE '   - Helper functions created';
  RAISE NOTICE '   - RLS policies enabled';
  RAISE NOTICE '   - Sample data seeded (Digraphs skill)';
END $$;
