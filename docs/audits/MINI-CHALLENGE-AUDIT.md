# Mini Challenge Feature - Codebase Audit Report
**Date:** February 6, 2026
**Status:** ✅ Complete
**Purpose:** Understand existing patterns before building Mini Challenge

---

## Audit Results

### 1. Goal Capture Component ✅ FOUND

**Location:** `components/assessment/GoalsCapture.tsx`

**Goals Available:**
```typescript
// From lib/constants/goals.ts
- reading (📖 Reading & Phonics) - ages 4-12
- grammar (✏️ Grammar & Sentences) - ages 4-12
- comprehension (🧠 Reading Comprehension) - ages 4-12
- creative_writing (🎨 Creative Writing) - ages 4-12
- olympiad (🏅 Olympiad Prep) - ages 4-12
- competition_prep (🏆 Competition Prep) - ages 4-12
- speaking (🎤 Speaking Confidence) - ages 4-12
```

**Storage:** `children` table columns:
- `parent_goals` (JSONB array) - Selected goal IDs
- `goals_captured_at` (timestamp)
- `goals_capture_method` (string: 'results_page', 'whatsapp', 'enroll')
- `parent_primary_goal` (text)
- `parent_stated_goals` (text)
- `parent_concerns` (text)

**Current Usage:**
- **Results Page:** Shows after assessment (app/assessment/results/[id]/page.tsx)
- **Enrollment Flow:** FocusAreasCard component (app/enroll/_components/FocusAreasCard.tsx)
- **WhatsApp Bot:** Captures via AiSensy webhook (app/api/webhooks/aisensy/goals/route.ts)
- **Auto-reminder:** P7 job sends WhatsApp 30 mins after assessment if goals not captured (app/api/jobs/goals-capture/route.ts)
- **API:** POST /api/children/goals saves goals, merges with existing

**UI Pattern:**
- 2-column grid of selectable goal cards
- Auto-saves 1.5s after last selection (debounced)
- Excludes 'reading' (since they just did reading assessment)
- Age-filtered goals via `getGoalsForAge(age)`
- Shows icons, short labels, visual feedback
- No forced selection - optional

**Key Insight:** 🎯 **Goals are parent-driven, not AI-suggested. This is critical - Mini Challenge should use these goals, not force topics based on assessment.**

---

### 2. Database State

#### Children Table Goal Columns:
```sql
-- Goal-related columns (7 total)
parent_primary_goal TEXT
parent_stated_goals TEXT
parent_goals JSONB[]
goals_captured_at TIMESTAMP
goals_capture_method TEXT
goals_message_sent BOOLEAN
goals_message_sent_at TIMESTAMP

-- Additional relevant columns
assessment_completed_at TIMESTAMP
latest_assessment_score INTEGER
reading_rank TEXT
reading_rank_emoji TEXT
assessment_wpm INTEGER
phonics_focus TEXT[]
struggling_phonemes TEXT[]
```

#### Content/Video/Quiz Tables:
- ✅ **elearning_units** EXISTS
  ```sql
  Columns: id, sub_skill_id, name, slug, quest_title, description,
          sequence, total_xp_reward, activity_count, estimated_minutes,
          difficulty, min_age, max_age, level, icon_emoji, thumbnail_url,
          color_hex, status, published_at, tags, is_featured,
          display_order, created_at, updated_at
  ```
- ⚠️ No `videos`, `quizzes`, `challenges`, `mini_challenges` tables
- ⚠️ No `elearning_sessions` table (checked earlier)

#### Learning Event Types (5 existing):
```
- assessment
- daily_recommendations
- session
- session_cancelled
- session_rescheduled
```

**Recommendation:** Add `mini_challenge_completed` event type

#### Goal/Preference Tables:
- ℹ️ No separate goal tables - all goals stored in `children` table
- This is correct design - goals are child attributes, not entities

---

### 3. Assessment Flow

#### Pages:
```
app/assessment/
  ├── page.tsx (Entry point - server component)
  ├── AssessmentPageClient.tsx (Main assessment UI)
  ├── results/[id]/page.tsx (Results with GoalsCapture)
  └── final/page.tsx (Final assessment for enrolled students)
```

#### Post-Assessment Journey:
```mermaid
Assessment Complete
    ↓
Results Page (/assessment/results/[id])
    ↓
[GoalsCapture Component Shown]
    ↓
User Options:
  1. Book Discovery Call (/lets-talk)
  2. Enroll Directly (/enroll)
  3. Checkout (/checkout)
```

**Goal Selection Step:** ✅ EXISTS on results page
- Optional (user can skip)
- Saves to children.parent_goals
- Used in enrollment flow
- **PERFECT LOCATION for Mini Challenge CTA**

**Flow Insight:**
- Assessment → Results → [Goal Capture] → **[MINI CHALLENGE HERE]** → Discovery Call/Enroll
- Mini Challenge should sit between results and conversion

---

### 4. Reusable Components

#### Quiz/MCQ:
✅ **`components/elearning/QuizPlayer.tsx`**
- Features: Question progression, answer selection, instant feedback, streak tracking, XP rewards
- Props: `quizId`, `onComplete`, `onExit`
- Returns: score, maxScore, correctItems, mistakes[]
- Integrations: Sound effects (`playSound`), haptics (`playHaptic`), TTS (`speak`)
- Animations: framer-motion

#### Video Player:
✅ **`components/elearning/VideoPlayer.tsx`**
- Features: Play/pause, volume, progress bar, YouTube embed support
- Props: `videoId`, `title`, `onComplete`, `onExit`
- Handles: Both native video and YouTube URLs
- Auto-completes after 20s for YouTube videos

#### Gamification:
✅ **`components/elearning/GamificationDisplay.tsx`**
- **XPProgressBar:** Level display, XP progress, level-up animations
- **BadgeUnlock:** components/child/BadgeUnlock.tsx
- **XPAwardPopup:** components/elearning/XPAwardPopup.tsx
- **Leaderboard:** components/elearning/Leaderboard.tsx
- **CelebrationOverlay:** components/elearning/CelebrationOverlay.tsx

#### Selection UI:
✅ **GoalsCapture** (already covered)
✅ **OptionSelector pattern** used throughout:
- 2-column grid layout
- Visual feedback (borders, colors)
- Touch-friendly (min 44px height)
- Icon + label design

---

### 5. Gemini Integration

#### Utility Files:
- **Primary:** `lib/gemini/client.ts` - Direct Gemini functions
- **Fallback System:** `lib/ai/provider.ts` - Multi-provider with failover

#### Gemini Pattern:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// For text
const result = await model.generateContent(prompt);
const responseText = result.response.text();

// For audio + text
const result = await model.generateContent([
  { text: prompt },
  { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
]);
```

#### Current Gemini Uses:
1. **Reading Assessment Analysis** (analyzeReading)
   - Audio + passage → scores, feedback, strengths, areas to improve
   - Age-appropriate strictness
   - Returns structured JSON

2. **Session Notes Generation** (generateSessionNotes)
3. **Session Agenda** (generateAgenda)
4. **Embeddings** (for RAG)
5. **Session Summaries** (generateSessionSummary)

#### Models Available:
- `gemini-2.5-flash-lite` (cheapest, fast)
- `gemini-2.5-flash` (primary)
- Fallback to OpenAI GPT-4o-mini if Gemini fails

#### Prompt Pattern:
```
You are [persona - e.g., "an expert reading coach"]

CONTEXT:
[Structured data - child info, goals, etc.]

TASK:
[Clear instructions with numbered steps]

OUTPUT FORMAT: Return ONLY valid JSON, no markdown:
{
  "field1": value,
  "field2": value
}
```

**Key Insight:** Always request JSON output, strip markdown fences, parse with try/catch

---

### 6. Site Settings Pattern

#### Pattern:
```typescript
// Server-side (API routes, server components)
import { getAssessmentSettings, getSetting } from '@/lib/settings';

const settings = await getAssessmentSettings();
const value = await getSetting('specific_key');

// Client-side
import { useSiteSettings } from '@/lib/hooks/useSiteSettings';

const { settings, loading } = useSiteSettings(['key1', 'key2']);
```

#### Storage:
- Table: `site_settings`
- Columns: `key` (text), `value` (JSONB/text), `category` (text), `description` (text)
- JSON fields auto-parsed by helper

#### Categories in Use:
```
hero, transformation, header, problem, arc, faq, story, rai,
testimonials, journey, pricing, cta, footer, floating,
triangulation, contact, videos, content, assessment
```

#### Relevant Existing Config:
```sql
-- Assessment settings
assessment_page_title
assessment_page_subtitle
assessment_trust_badges (JSONB)
assessment_cta_messages (JSONB)
assessment_passages (JSONB)

-- Could add for Mini Challenge:
mini_challenge_enabled BOOLEAN
mini_challenge_video_url TEXT
mini_challenge_title TEXT
mini_challenge_subtitle TEXT
mini_challenge_topics JSONB
mini_challenge_reward_xp INTEGER
```

---

## 7. Recommendations

### ✅ REUSE (Existing Components/Patterns):

1. **GoalsCapture Component**
   - Use parent_goals to determine Mini Challenge topic
   - Don't force topics based on assessment

2. **QuizPlayer Component**
   - Already gamified with sounds, haptics, streak tracking
   - Just need to provide quiz data

3. **VideoPlayer Component**
   - Handles both native and YouTube
   - Use for educational video portion

4. **GamificationDisplay Components**
   - XP rewards, level progress, celebrations already built
   - Reuse XPAwardPopup after Mini Challenge completion

5. **Gemini Pattern**
   - Use existing `lib/ai/provider.ts` for failover
   - Follow structured prompt → JSON response pattern

6. **Site Settings Pattern**
   - Store all Mini Challenge config in `site_settings`
   - Use `getSettings()` server-side, `useSiteSettings()` client-side

7. **Learning Events Pattern**
   - Log `mini_challenge_completed` event with JSONB metadata
   - Store: topic, score, duration, mistakes, timestamp

### 🔧 EXTEND (Tables/Components to Enhance):

1. **elearning_units Table**
   - Add `unit_type` column: 'quest' | 'mini_challenge' | 'activity'
   - Add `content_type` column: 'video' | 'quiz' | 'video_quiz' | 'game'
   - Mini Challenges can be special unit_type

2. **learning_events Table**
   - Add new event_type: `mini_challenge_completed`
   - Use existing JSONB structure for metadata

3. **children Table Columns** (optional enhancement)
   - `mini_challenges_completed` INTEGER (count)
   - `last_mini_challenge_at` TIMESTAMP
   - `mini_challenge_streak` INTEGER

### 🆕 CREATE NEW (Only What Must Be New):

1. **Mini Challenge UI Components**
   - `MiniChallengeEntry.tsx` - Entry point component
   - `MiniChallengeFlow.tsx` - Orchestrates video → quiz flow
   - Wrapper that combines VideoPlayer + QuizPlayer

2. **API Routes**
   - `GET /api/mini-challenge/content?childId=xxx&topic=xxx`
     - Returns video URL + quiz questions based on goals
     - Gemini generates personalized quiz questions
   - `POST /api/mini-challenge/complete`
     - Saves result, awards XP, logs event

3. **Database Migration** (optional)
   ```sql
   -- Add to elearning_units
   ALTER TABLE elearning_units
   ADD COLUMN unit_type TEXT DEFAULT 'quest',
   ADD COLUMN content_type TEXT;

   -- Create mini challenge content entries
   INSERT INTO elearning_units (
     name, slug, unit_type, content_type,
     description, difficulty, min_age, max_age
   ) VALUES ...
   ```

4. **Site Settings** (add these keys)
   ```sql
   INSERT INTO site_settings (category, key, value, description) VALUES
   ('mini_challenge', 'enabled', 'true', 'Enable Mini Challenge feature'),
   ('mini_challenge', 'xp_reward', '50', 'XP awarded for completion'),
   ('mini_challenge', 'topics', '["grammar","comprehension","creative_writing"]', 'Available topics'),
   ('mini_challenge', 'video_base_url', 'https://...', 'Base URL for videos');
   ```

---

## 8. Implementation Strategy

### Phase 1: Foundation (Use Existing)
```typescript
// 1. Check parent_goals after assessment
const goals = await supabase
  .from('children')
  .select('parent_goals')
  .eq('id', childId)
  .single();

// 2. If goals exist, show Mini Challenge CTA
if (goals?.parent_goals?.length > 0) {
  <MiniChallengeCTA
    childId={childId}
    selectedGoals={goals.parent_goals}
  />
}
```

### Phase 2: Content Generation (Gemini)
```typescript
// Use Gemini to generate quiz based on goals
const quiz = await generateMiniChallengeQuiz({
  childName,
  childAge,
  goals: parent_goals, // From database
  assessmentScore,
});

// Returns:
{
  topic: 'grammar',
  videoUrl: 'https://...',
  questions: [
    { question, options, correct_answer, explanation }
  ]
}
```

### Phase 3: Gamification (Reuse Existing)
```typescript
// After completion
<XPAwardPopup xp={50} reason="Mini Challenge Complete!" />
<CelebrationOverlay show={true} />

// Log event
await logLearningEvent({
  childId,
  eventType: 'mini_challenge_completed',
  eventData: {
    topic,
    score,
    duration,
    mistakes: [],
  }
});
```

---

## 9. Architecture Diagram

```
Assessment Results Page
  ↓
[Goals Captured? YES]
  ↓
Mini Challenge CTA
  ↓
MiniChallengeFlow Component
  ├─ VideoPlayer (existing)
  │   └─ Shows educational video
  ↓
  ├─ QuizPlayer (existing)
  │   └─ 3-5 questions based on goals
  ↓
  └─ Completion
      ├─ XPAwardPopup (existing)
      ├─ Log learning_event (existing pattern)
      └─ CTA: Book Discovery Call
```

---

## Key Findings Summary

✅ **Goal capture exists and works perfectly** - use it!
✅ **Reusable quiz/video/gamification components** - extend them
✅ **Gemini integration pattern** - follow it
✅ **Site settings pattern** - use for all config
✅ **Learning events for tracking** - add new event type
✅ **E-learning units table** - can store Mini Challenge content

⚠️ **Do NOT create**:
- New goal system (use parent_goals)
- New gamification (reuse existing)
- New video/quiz players (extend existing)
- Separate tables for Mini Challenge (use elearning_units + learning_events)

---

## Next Steps

1. **Design Mini Challenge content strategy**
   - Which goals → which video/quiz combinations?
   - Use Gemini to generate OR curated content?

2. **Create API endpoints**
   - GET /api/mini-challenge/content
   - POST /api/mini-challenge/complete

3. **Build wrapper component**
   - MiniChallengeFlow.tsx
   - Orchestrates VideoPlayer → QuizPlayer → Completion

4. **Add to results page**
   - Show CTA after GoalsCapture
   - Before discovery call booking

5. **Test with real goals**
   - Verify goal-based content selection works
   - Measure completion rate
