# 🎯 Yestoryd E-Learning V2

## Premium AI-Powered Learning Experience for Children

This is the complete e-learning system redesign featuring:
- **Units** instead of individual videos
- **5 Game Engines** for reusable gameplay
- **Content Pools** for infinite combinations
- **Gemini-Powered rAI** for intelligent recommendations
- **Focus Mode UI** for reduced cognitive load
- **Spaced Repetition** for retention
- **Daily Goals** for habit formation

---

## 📁 File Structure

```
elearning-v2/
├── migrations/
│   └── 001_elearning_units_schema.sql    # Database schema
├── types/
│   └── elearning.ts                       # TypeScript types
├── app/
│   ├── api/
│   │   └── elearning/
│   │       └── session/
│   │           └── route.ts               # Session API (Gemini-powered)
│   └── child/
│       └── [childId]/
│           └── play/
│               └── page.tsx               # Focus Mode child page
├── components/
│   ├── elearning/
│   │   ├── MissionCard.tsx                # Single clear action card
│   │   ├── DailyGoalCard.tsx              # Daily goal progress
│   │   └── AskRAIModal.tsx                # Topic selector
│   └── games/
│       └── WordMatchGame.tsx              # First game engine
└── README.md
```

---

## 🚀 Installation

### Step 1: Run Database Migration

Go to **Supabase SQL Editor** and run:

```sql
-- Copy and run the entire contents of:
-- migrations/001_elearning_units_schema.sql
```

This creates:
- `elearning_skills` - Skill taxonomy
- `elearning_sub_skills` - Sub-skills (TH, SH, CH sounds)
- `elearning_content_pools` - Word banks for games
- `elearning_game_engines` - 5 game types
- `elearning_units` - Learning units (sequences)
- `elearning_unit_prerequisites` - Mastery unlocking
- `child_unit_progress` - Progress tracking
- `child_game_progress` - Game results
- `child_daily_goals` - Daily goals
- `rai_recommendation_logs` - AI recommendation history

### Step 2: Copy Files to Your Project

```powershell
# Types
Copy-Item "types/elearning.ts" -Destination "C:\yestoryd-mvp\types\elearning.ts" -Force

# API
New-Item -ItemType Directory -Force -Path "C:\yestoryd-mvp\app\api\elearning\session"
Copy-Item "app/api/elearning/session/route.ts" -Destination "C:\yestoryd-mvp\app\api\elearning\session\route.ts" -Force

# Child page
Copy-Item "app/child/[childId]/play/page.tsx" -Destination "C:\yestoryd-mvp\app\child\[childId]\play\page.tsx" -Force

# Components - elearning
New-Item -ItemType Directory -Force -Path "C:\yestoryd-mvp\components\elearning"
Copy-Item "components/elearning/MissionCard.tsx" -Destination "C:\yestoryd-mvp\components\elearning\MissionCard.tsx" -Force
Copy-Item "components/elearning/DailyGoalCard.tsx" -Destination "C:\yestoryd-mvp\components\elearning\DailyGoalCard.tsx" -Force
Copy-Item "components/elearning/AskRAIModal.tsx" -Destination "C:\yestoryd-mvp\components\elearning\AskRAIModal.tsx" -Force

# Components - games
New-Item -ItemType Directory -Force -Path "C:\yestoryd-mvp\components\games"
Copy-Item "components/games/WordMatchGame.tsx" -Destination "C:\yestoryd-mvp\components\games\WordMatchGame.tsx" -Force
```

### Step 3: Install Dependencies

```powershell
cd C:\yestoryd-mvp
npm install @google/generative-ai framer-motion lucide-react
```

### Step 4: Environment Variables

Add to `.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🏗️ Architecture

### The Learning Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THE YESTORYD LEARNING LOOP                        │
│                                                                             │
│   ┌────────────┐     ┌─────────────┐     ┌────────────────────────────┐    │
│   │  COACHING  │────▶│   rAI RAG   │────▶│   RECOMMENDS E-LEARNING    │    │
│   │  SESSION   │     │  (Gemini)   │     │   UNITS FOR CHILD          │    │
│   └────────────┘     └─────────────┘     └────────────────────────────┘    │
│                             ▲                         │                     │
│                             │                         ▼                     │
│                      ┌──────┴──────┐      ┌────────────────────────────┐   │
│                      │  PROGRESS   │◀─────│   CHILD E-LEARNING UI       │   │
│                      │  STORED     │      │   (Focus Mode)              │   │
│                      └─────────────┘      └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Unit Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UNIT: "TH Sound Adventure"                                                 │
│                                                                             │
│  Sequence:                                                                  │
│  ┌─────────┐   ┌─────────────┐   ┌─────────┐   ┌───────────┐              │
│  │ 🎬      │   │ 🎮          │   │ 🎬      │   │ 📝        │              │
│  │ Video   │──▶│ Word Match  │──▶│ Video   │──▶│ Quiz      │              │
│  │ +10 XP  │   │ +20 XP      │   │ +10 XP  │   │ +50 XP    │              │
│  └─────────┘   └─────────────┘   └─────────┘   └───────────┘              │
│                                                                             │
│  Total: 90 XP | ~10 min                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Game Engines

| Engine | Slug | Description |
|--------|------|-------------|
| Word Match | `word-match` | Drag words to images/sounds |
| Phonics Pop | `phonics-pop` | Pop correct sound bubbles |
| Sentence Builder | `sentence-builder` | Arrange words to form sentences |
| Story Sequence | `story-sequence` | Order story pictures |
| Rhyme Time | `rhyme-time` | Match rhyming words |

---

## 🎨 UI/UX Principles

### Focus Mode (Default)

Instead of overwhelming with 6-8 cards, show **ONE clear action**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 YOUR MISSION TODAY                                                      │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │         🦁 The TH Sound Adventure                                   │    │
│  │                                                                     │    │
│  │         ⚡ +50 XP    ⏱️ 5 min    🎮 Fun game inside                 │    │
│  │                                                                     │    │
│  │              [ ▶ START ADVENTURE ]                                  │    │
│  │                                                                     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Want something else? [Ask rAI ✨]  |  [See all 📚]                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Audio-First (Ages 4-7)

- Auto-play instructions
- Visual + audio cues
- Large touch targets

### Celebration Ladder

- START: "Let's go!" + woosh
- CORRECT: Star burst + ding
- STREAK: Fire animation
- FINISH: Confetti + XP
- PERFECT: Special celebration

---

## 📊 Database Schema Overview

### Core Tables

| Table | Purpose |
|-------|---------|
| `elearning_skills` | Skill taxonomy (Phonics, Fluency, etc.) |
| `elearning_sub_skills` | Sub-skills (TH Sound, SH Sound, etc.) |
| `elearning_content_pools` | Word banks for games |
| `elearning_game_engines` | 5 game types |
| `elearning_units` | Learning sequences |
| `elearning_unit_prerequisites` | Mastery-based unlocking |

### Progress Tables

| Table | Purpose |
|-------|---------|
| `child_unit_progress` | Unit completion + spaced repetition |
| `child_game_progress` | Individual game results |
| `child_daily_goals` | Daily goal tracking |
| `rai_recommendation_logs` | AI recommendation history |

---

## 🔧 API Endpoints

### GET /api/elearning/session?childId=xxx

Returns complete session data:
- Child info
- Today's focus (rAI recommended)
- Queue of units
- Daily goal progress
- Gamification stats

### POST /api/elearning/session

Override rAI recommendation:
```json
{
  "childId": "xxx",
  "topic": "sight-words"
}
```

---

## 🧪 Testing

### Test Child

Create a test enrollment in Supabase, then visit:
```
http://localhost:3000/child/{childId}/play
```

### Seed Sample Unit

```sql
-- Insert a sample unit
INSERT INTO elearning_units (
  sub_skill_id,
  name,
  slug,
  quest_title,
  description,
  sequence,
  estimated_minutes,
  difficulty,
  level,
  status,
  icon_emoji
)
SELECT 
  id,
  'TH Sound Adventure',
  'th-sound-adventure',
  'Master the TH Sound!',
  'Learn the voiced and voiceless TH sounds',
  '[
    {"order": 1, "type": "video", "title": "Intro to TH", "xp_reward": 10},
    {"order": 2, "type": "game", "game_engine_slug": "word-match", "title": "Match TH Words", "xp_reward": 20},
    {"order": 3, "type": "quiz", "title": "TH Quiz", "xp_reward": 50, "passing_score": 70}
  ]'::JSONB,
  10,
  'medium',
  2,
  'published',
  '🦁'
FROM elearning_sub_skills WHERE slug = 'th-sound';
```

---

## 📝 Next Steps

### Phase 1 Complete ✅
- [x] Database schema
- [x] TypeScript types
- [x] Focus Mode UI
- [x] Session API with Gemini
- [x] Word Match game engine
- [x] Mission Card
- [x] Daily Goal Card
- [x] Ask rAI Modal

### Phase 2 (Next)
- [ ] Phonics Pop game engine
- [ ] Sentence Builder game engine
- [ ] Story Sequence game engine
- [ ] Rhyme Time game engine
- [ ] Unit player (video + game + quiz flow)
- [ ] Spaced repetition scheduling
- [ ] Parent summary view

### Phase 3 (Future)
- [ ] Offline support
- [ ] Voice practice with Gemini
- [ ] WhatsApp nudge automation
- [ ] Analytics dashboard

---

## 💡 Key Improvements Over V1

| V1 | V2 |
|----|----|
| Individual videos in carousel | Units (complete experiences) |
| Keyword-based recommendations | Gemini AI recommendations |
| 6-8 cards (overwhelming) | Focus Mode (1 clear action) |
| No spaced repetition | SM-2 algorithm for retention |
| No daily goals | Daily goal + treasure chest |
| Only MCQ quizzes | 5 interactive game engines |

---

## 🎉 Credits

Built for Yestoryd by Claude (Anthropic)
Architecture designed with Amit Kumar Rai
