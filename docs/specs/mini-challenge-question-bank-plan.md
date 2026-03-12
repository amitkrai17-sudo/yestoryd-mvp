# Mini Challenge: Database-Driven Question Bank

## Overview

Replace AI-generated questions with curated question bank controlled by Rucha. This ensures curriculum alignment, consistent quality, and enables progress tracking.

---

## Current State

**How questions work now:**
```
Child starts Mini Challenge
       ↓
POST /api/mini-challenge/generate
       ↓
Gemini AI generates questions on-the-fly
       ↓
Returns 3-5 random questions based on goal + age
```

**File:** `app/api/mini-challenge/generate/route.ts`

**Problems:**
- Inconsistent quality
- No curriculum alignment
- Can't track specific skills
- Unpredictable content
- API cost per child

---

## Proposed Architecture

```
Child starts Mini Challenge
       ↓
POST /api/mini-challenge/generate
       ↓
SELECT questions FROM quiz_questions
WHERE goal + age + difficulty match
       ↓
Returns curated questions from database
       ↓
(Fallback to Gemini if no questions found)
```

---

## Database Schema

### Table: quiz_questions

```sql
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Categorization
  goal_area TEXT NOT NULL,           -- phonics, reading_fluency, vocabulary, comprehension, grammar, speaking_confidence, writing
  skill_tag TEXT,                    -- specific skill: 'bl_blend', 'sh_sound', 'sight_words', etc.
  sub_skill TEXT,                    -- even more specific: 'initial_bl', 'final_bl'
  
  -- Age targeting
  age_min INTEGER DEFAULT 4,
  age_max INTEGER DEFAULT 12,
  
  -- Difficulty
  difficulty TEXT DEFAULT 'medium',  -- easy, medium, hard
  difficulty_score INTEGER,          -- 1-10 for finer control
  
  -- Question content
  question TEXT NOT NULL,
  question_audio_url TEXT,           -- Pre-generated TTS audio URL
  question_image_url TEXT,           -- Optional image for visual questions
  
  -- Options
  options JSONB NOT NULL,            -- ["Ship", "Chip", "Skip", "Flip"]
  correct_index INTEGER NOT NULL,    -- 0-based index
  
  -- Feedback
  explanation TEXT NOT NULL,         -- Shown after answering
  explanation_audio_url TEXT,        -- Pre-generated TTS for explanation
  hint TEXT,                         -- Optional hint for struggling kids
  
  -- Metadata
  source TEXT,                       -- 'rucha_original', 'adapted', 'ai_generated'
  curriculum_reference TEXT,         -- Link to curriculum standard
  
  -- Analytics
  times_shown INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  avg_time_seconds DECIMAL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_quiz_goal_age ON quiz_questions(goal_area, age_min, age_max, is_active);
CREATE INDEX idx_quiz_skill ON quiz_questions(skill_tag, is_active);
CREATE INDEX idx_quiz_difficulty ON quiz_questions(difficulty, difficulty_score);
```

### Table: quiz_question_sets (Optional - for curated sets)

```sql
CREATE TABLE quiz_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                -- "Phonics Basics - Level 1"
  description TEXT,
  goal_area TEXT NOT NULL,
  age_min INTEGER DEFAULT 4,
  age_max INTEGER DEFAULT 12,
  question_ids UUID[] NOT NULL,      -- Ordered array of question IDs
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Goal Areas & Skill Tags

### Phonics
```
goal_area: 'phonics'
skill_tags:
  - letter_sounds        (a, b, c individual sounds)
  - short_vowels         (a in cat, e in bed)
  - long_vowels          (a in cake, e in bee)
  - consonant_blends     (bl, br, cl, cr, dr, fl, fr, gl, gr, pl, pr, sc, sk, sl, sm, sn, sp, st, sw, tr, tw)
  - digraphs             (sh, ch, th, wh, ph, ck, ng)
  - vowel_teams          (ai, ay, ea, ee, ie, oa, oe, ue, ui)
  - r_controlled         (ar, er, ir, or, ur)
  - silent_e             (a_e, i_e, o_e, u_e)
  - word_families        (-at, -an, -ig, -op, etc.)
```

### Reading Fluency
```
goal_area: 'reading_fluency'
skill_tags:
  - sight_words          (the, is, are, was, were)
  - high_frequency       (common words)
  - phrasing             (reading in chunks)
  - expression           (reading with emotion)
  - punctuation_awareness (pausing at periods, etc.)
```

### Vocabulary
```
goal_area: 'vocabulary'
skill_tags:
  - synonyms
  - antonyms
  - context_clues
  - word_meanings
  - multiple_meanings
  - prefixes
  - suffixes
  - compound_words
```

### Comprehension
```
goal_area: 'comprehension'
skill_tags:
  - main_idea
  - supporting_details
  - sequence
  - cause_effect
  - inference
  - prediction
  - character_traits
  - setting
  - problem_solution
```

### Grammar
```
goal_area: 'grammar'
skill_tags:
  - nouns
  - verbs
  - adjectives
  - pronouns
  - articles
  - tenses_past
  - tenses_present
  - tenses_future
  - subject_verb_agreement
  - punctuation
  - capitalization
```

### Speaking Confidence
```
goal_area: 'speaking_confidence'
skill_tags:
  - pronunciation
  - word_stress
  - sentence_intonation
  - clarity
```

### Writing
```
goal_area: 'writing'
skill_tags:
  - letter_formation
  - spelling
  - sentence_structure
  - punctuation
  - capitalization
```

---

## Sample Questions (Phonics - Consonant Blends)

```json
[
  {
    "goal_area": "phonics",
    "skill_tag": "consonant_blends",
    "sub_skill": "bl_blend",
    "age_min": 4,
    "age_max": 7,
    "difficulty": "easy",
    "question": "Which word starts with the 'bl' sound?",
    "options": ["Blue", "Clue", "Glue", "True"],
    "correct_index": 0,
    "explanation": "Great job! 'Blue' starts with 'bl'. Can you hear it? Bl-ue!",
    "hint": "Listen carefully: bl... bl... blue"
  },
  {
    "goal_area": "phonics",
    "skill_tag": "consonant_blends",
    "sub_skill": "bl_blend",
    "age_min": 4,
    "age_max": 7,
    "difficulty": "medium",
    "question": "Which picture shows something that starts with 'bl'?",
    "options": ["Block", "Clock", "Flock", "Rock"],
    "correct_index": 0,
    "explanation": "Yes! 'Block' starts with 'bl'. Bl-ock!",
    "question_image_url": "/images/quiz/bl-blend-pictures.png"
  },
  {
    "goal_area": "phonics",
    "skill_tag": "consonant_blends",
    "sub_skill": "sh_digraph",
    "age_min": 5,
    "age_max": 8,
    "difficulty": "easy",
    "question": "Which word has the 'sh' sound?",
    "options": ["Ship", "Chip", "Tip", "Hip"],
    "correct_index": 0,
    "explanation": "Correct! 'Ship' has the 'sh' sound at the beginning. Sh-ip!"
  }
]
```

---

## API Update: generate/route.ts

```typescript
// app/api/mini-challenge/generate/route.ts

import { supabaseAdmin } from '@/lib/supabase/server';
import { getMiniChallengeSettings } from '@/lib/mini-challenge/settings';

export async function POST(request: NextRequest) {
  const { childId, goalArea } = await request.json();
  
  // Get child data
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('id, child_name, child_age, parent_goals, assessment_data')
    .eq('id', childId)
    .single();
  
  // Get settings (question count based on age)
  const settings = await getMiniChallengeSettings(child.child_age);
  const goal = goalArea || child.parent_goals?.[0] || 'phonics';
  
  // TRY: Get questions from database
  let questions = await getQuestionsFromDB(goal, child.child_age, settings.questionsCount);
  
  // FALLBACK: If no questions in DB, use Gemini
  if (!questions || questions.length < settings.questionsCount) {
    console.log('[mini-challenge] No DB questions, falling back to Gemini');
    questions = await generateQuestionsWithGemini(child, goal, settings.questionsCount);
  }
  
  // Get video
  const video = await getMiniChallengeVideo(goal, child.child_age);
  
  return NextResponse.json({
    child_name: child.child_name,
    child_age: child.child_age,
    goal,
    questions,
    video,
    settings: {
      xp_correct: settings.xpCorrect,
      xp_video: settings.xpVideo,
      video_skip_delay: settings.videoSkipDelay
    }
  });
}

async function getQuestionsFromDB(
  goal: string, 
  age: number, 
  count: number
): Promise<Question[] | null> {
  
  const { data, error } = await supabaseAdmin
    .from('quiz_questions')
    .select(`
      id,
      question,
      options,
      correct_index,
      explanation,
      difficulty,
      skill_tag,
      question_audio_url,
      question_image_url
    `)
    .eq('goal_area', goal)
    .eq('is_active', true)
    .lte('age_min', age)
    .gte('age_max', age)
    .order('difficulty_score', { ascending: true })
    .limit(count * 2); // Get more than needed for randomization
  
  if (error || !data || data.length < count) {
    return null;
  }
  
  // Shuffle and take required count
  const shuffled = data.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

---

## Admin Interface

### Location: `/app/admin/quiz-questions/page.tsx`

### Features Needed:
1. **List View**
   - Filter by goal_area, skill_tag, age, difficulty
   - Search by question text
   - Bulk enable/disable

2. **Add/Edit Form**
   - Goal area dropdown
   - Skill tag dropdown (filtered by goal)
   - Age range slider
   - Difficulty selector
   - Question text (with preview)
   - Options editor (4 fields)
   - Correct answer selector
   - Explanation text
   - Image upload (optional)
   - Audio preview/generate button

3. **Import/Export**
   - CSV import for bulk upload
   - JSON export for backup
   - Template download

4. **Analytics Dashboard**
   - Most missed questions
   - Average time per question
   - Questions needing review

---

## Content Creation Workflow

### Step 1: Rucha Creates Questions
```
Google Sheet or Notion with columns:
- Goal Area
- Skill Tag
- Age Range
- Difficulty
- Question
- Option A, B, C, D
- Correct Answer (A/B/C/D)
- Explanation
```

### Step 2: Export to CSV
```csv
goal_area,skill_tag,age_min,age_max,difficulty,question,option_a,option_b,option_c,option_d,correct,explanation
phonics,bl_blend,4,7,easy,"Which word starts with 'bl'?",Blue,Clue,Glue,True,A,"Great job! 'Blue' starts with 'bl'."
```

### Step 3: Import via Admin
- Upload CSV
- Validate format
- Preview questions
- Confirm import

### Step 4: Review & Activate
- Review imported questions
- Test audio generation
- Activate for production

---

## Pre-Generated Audio Strategy

Instead of generating TTS on every request, pre-generate audio for all questions:

```typescript
// scripts/generate-question-audio.ts

async function generateAudioForAllQuestions() {
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question, explanation')
    .is('question_audio_url', null);
  
  for (const q of questions) {
    // Generate question audio
    const questionAudio = await generateSpeech({ text: q.question });
    const questionUrl = await uploadToStorage(questionAudio, `questions/${q.id}-question.mp3`);
    
    // Generate explanation audio
    const explanationAudio = await generateSpeech({ text: q.explanation });
    const explanationUrl = await uploadToStorage(explanationAudio, `questions/${q.id}-explanation.mp3`);
    
    // Update database
    await supabase
      .from('quiz_questions')
      .update({
        question_audio_url: questionUrl,
        explanation_audio_url: explanationUrl
      })
      .eq('id', q.id);
  }
}
```

**Benefits:**
- Zero TTS API calls during Mini Challenge
- Faster load times
- Consistent audio quality
- One-time cost per question

---

## Question Analytics

Track how questions perform:

```sql
-- Update after each answer
UPDATE quiz_questions
SET 
  times_shown = times_shown + 1,
  times_correct = times_correct + CASE WHEN was_correct THEN 1 ELSE 0 END,
  avg_time_seconds = (avg_time_seconds * times_shown + new_time) / (times_shown + 1)
WHERE id = question_id;
```

**Dashboard queries:**

```sql
-- Hardest questions (lowest success rate)
SELECT question, goal_area, skill_tag,
  ROUND(times_correct::decimal / NULLIF(times_shown, 0) * 100, 1) as success_rate
FROM quiz_questions
WHERE times_shown > 10
ORDER BY success_rate ASC
LIMIT 20;

-- Questions needing review (very low success)
SELECT * FROM quiz_questions
WHERE times_shown > 20 
AND (times_correct::decimal / times_shown) < 0.3;
```

---

## Migration Path

### Phase 1: Database Setup (30 mins)
- Create quiz_questions table
- Add indexes
- Insert sample questions (10-20 per goal)

### Phase 2: API Update (1 hour)
- Update generate route to query DB first
- Keep Gemini as fallback
- Add logging for which source used

### Phase 3: Admin Interface (2-3 hours)
- List/filter questions
- Add/edit form
- CSV import

### Phase 4: Content Population (Ongoing)
- Rucha creates questions in spreadsheet
- Import via admin
- Generate audio for new questions

### Phase 5: Analytics (1 hour)
- Track question performance
- Dashboard for insights
- Identify problem questions

---

## Files to Create/Modify

```
New Files:
├── migrations/quiz-questions-schema.sql
├── app/admin/quiz-questions/page.tsx
├── app/admin/quiz-questions/[id]/page.tsx
├── app/api/admin/quiz-questions/route.ts
├── app/api/admin/quiz-questions/import/route.ts
├── lib/mini-challenge/questions.ts
├── scripts/generate-question-audio.ts
└── scripts/seed-sample-questions.ts

Modified Files:
├── app/api/mini-challenge/generate/route.ts
└── components/mini-challenge/QuestionCard.tsx (use pre-generated audio URL)
```

---

## Claude Code Prompt (When Ready)

```markdown
# Implement Database-Driven Question Bank for Mini Challenge

## Context
- Current: Gemini generates questions on-the-fly
- Goal: Use curated questions from database
- Fallback: Gemini if no DB questions

## Reference
See: /home/claude/mini-challenge-question-bank-plan.md

## Tasks

### Phase 1: Database
1. Create quiz_questions table (see schema in plan)
2. Create indexes
3. Insert 20 sample questions across goals

### Phase 2: API
1. Create lib/mini-challenge/questions.ts with getQuestionsFromDB()
2. Update app/api/mini-challenge/generate/route.ts to use DB first
3. Keep Gemini fallback

### Phase 3: Admin (if time)
1. Create basic list page at /admin/quiz-questions
2. Add/edit form
3. CSV import

## Design System
- Follow existing admin page patterns
- Use premium card styling (bg-gray-800/50 border-gray-700)
```

---

## Estimated Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Database setup | 30 mins | P0 |
| API update | 1 hour | P0 |
| Admin interface | 2-3 hours | P1 |
| Content creation | Ongoing | P1 |
| Pre-generate audio | 1 hour | P2 |
| Analytics | 1 hour | P2 |

**Total MVP:** ~4 hours (DB + API + basic admin)

---

*Document created: February 6, 2026*
*For: Yestoryd Mini Challenge Enhancement*
