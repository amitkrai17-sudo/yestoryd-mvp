# Yestoryd — Coach Consistency & Content Architecture Build Plan

**Date:** February 11, 2026  
**Status:** Planning → Pending Audit Verification  
**Owner:** Amit Kumar Rai  
**Builder:** Claude Code

---

## Philosophy

**Franchise model, not SOP prison.**

Yestoryd standardizes WHAT to teach, WHICH activities, WHAT materials, WHAT outcomes to measure. Coaches own HOW they deliver — their tone, analogies, engagement style, and human connection with the child.

Consistency is measured through science and numbers (adherence scoring, child progress correlation, parent feedback), not surveillance. The goal: if Coach A is replaced by Coach B mid-program, the child's learning journey continues without disruption. The platform owns the methodology; coaches bring the magic.

**Create once, serve everywhere.**

Every piece of content is authored once and consumed in three contexts:
- **Coach** sees it during live sessions via Companion Panel (with learning objectives + success criteria)
- **Parent** sees it as homework/practice in their dashboard (with simplified instructions)
- **Child** sees it in self-learn e-learning mode (gamified wrapper)

Content auto-pulls based on session template → no manual assignment needed.

---

## Current State (What's Built)

> **NOTE:** This section will be validated by Claude Code audit. Below is the expected state based on past sessions.

### Session Structure
| Component | Status | What It Does |
|-----------|--------|-------------|
| `session_templates` table | ✅ Built | 40+ templates with `activity_flow` JSONB, age_band, skill_dimensions, difficulty_level |
| Companion Panel (`/coach/sessions/[id]/live`) | ✅ Built | Forces coach through prescribed activity sequence. Two-tab arch with Meet. |
| `session_activity_log` table | ✅ Built | Per-activity: status (done/partial/skipped/struggled), timing, coach note |
| ActionButton (4 statuses) | ✅ Built | Tap = Done + advance, long-press = 4 options |
| localStorage persistence | ✅ Built | Session state survives tab switches and browser crashes |
| Wake lock | ✅ Built | Screen stays on during session |

### Data Continuity
| Component | Status | What It Does |
|-----------|--------|-------------|
| 4 data streams per session | ✅ Built | Activity logs + coach notes + Recall transcript + Gemini analysis → learning_events |
| Struggle flags | ✅ Built | Auto-created on "Struggled" status, carry forward to next session's Info tab |
| Pre-session brief | ✅ Built | `/api/coach/sessions/[id]/brief` returns child context + last session + struggle flags |
| rAI Chain of Thought | ✅ Built | Coach gets learning trajectory analysis + recommendations via `/api/coach/ai-suggestion` |

### Compliance
| Component | Status | What It Does |
|-----------|--------|-------------|
| 45-min nudge cron | ✅ Built | WhatsApp nudge to coach if notes not submitted |
| Coach streak | ✅ Built | `coaches.completed_sessions_with_logs` increments on completion |
| Recall.ai auto-record | ✅ Built | Bot joins every session, transcript exists regardless of coach |
| Gemini parent summary | ✅ Built | Auto-generated + sent via WhatsApp post-session |

---

## The Gap

**`activity_flow` in session_templates contains text labels, not linked content assets.**

When a template says "Phonological Awareness Warm-up: Rhyming pairs game (5 min)", the coach sees a text description. There's no video, worksheet, reading passage, or material object attached. Two coaches interpret this differently — one uses physical flashcards, another freestyles. The child's experience varies.

This single gap, when filled, unlocks:
- Coach consistency (everyone uses the same materials)
- Parent homework (auto-assign the same content post-session)
- E-learning (child self-learns with the same content)
- rAI content recommendations (suggest specific assets based on struggle flags)
- Content effectiveness tracking (which assets correlate with progress)

---

## Build Plan — 3 Builds

### Build 1: Content Library + Activity Linking

**Purpose:** Create a centralized, admin-managed content catalog. Link it to session template activities. Companion Panel displays actual content during sessions instead of just text labels.

#### New Table: `content_library`

```sql
CREATE TABLE content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  content_code TEXT NOT NULL UNIQUE,           -- 'V-PH-001', 'W-FL-012', 'P-CM-003'
  title TEXT NOT NULL,                          -- 'CVC Blending — /b/ /a/ /t/'
  content_type TEXT NOT NULL CHECK (content_type IN (
    'video', 'worksheet', 'reading_passage', 'flashcard_set', 
    'game', 'song', 'activity_guide', 'assessment'
  )),
  
  -- Asset
  asset_url TEXT,                               -- Supabase storage URL or external link
  asset_format TEXT,                            -- 'mp4', 'pdf', 'png', 'interactive'
  thumbnail_url TEXT,                           -- Preview image
  duration_seconds INT,                         -- For video/audio content
  
  -- Classification (matches session_templates taxonomy)
  skill_tags TEXT[] NOT NULL DEFAULT '{}',      -- ['phonics', 'cvc_blending', 'consonant_b']
  age_band TEXT REFERENCES age_band_config(id), -- 'foundation', 'building', 'mastery'
  difficulty_level INT CHECK (difficulty_level BETWEEN 1 AND 10),
  arc_stage TEXT CHECK (arc_stage IN ('assess', 'remediate', 'celebrate')),
  
  -- Three Lenses (same content, different context)
  coach_guidance JSONB DEFAULT '{}',           -- { learning_objective, success_criteria, watch_for, suggested_approach }
  parent_instruction TEXT,                      -- "Practice these sounds with [child]. Play the video and ask them to repeat."
  child_label TEXT,                             -- "Let's play the sound game!" (for e-learning UI)
  
  -- Relationships
  prerequisite_content TEXT[],                  -- content_codes that should come before
  next_progression TEXT[],                      -- content_codes that logically follow
  
  -- Metadata
  created_by TEXT NOT NULL DEFAULT 'rucha',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_content_library_skills ON content_library USING GIN(skill_tags);
CREATE INDEX idx_content_library_age_band ON content_library(age_band) WHERE is_active = TRUE;
CREATE INDEX idx_content_library_type ON content_library(content_type, age_band);
CREATE INDEX idx_content_library_code ON content_library(content_code);
CREATE INDEX idx_content_library_difficulty ON content_library(age_band, difficulty_level);
```

#### Modified: `activity_flow` JSONB Structure

Current (text labels only):
```json
[
  {
    "time": "5 min",
    "activity": "Warm-up: Rhyming pairs game",
    "purpose": "Phonological awareness activation"
  }
]
```

New (content-linked):
```json
[
  {
    "activity_id": "act_01",
    "activity_name": "Warm-up: Rhyming Pairs",
    "purpose": "Phonological awareness activation",
    "planned_duration_minutes": 5,
    "content_ids": ["content-uuid-1", "content-uuid-2"],
    "is_required": true,
    "coach_can_substitute": false
  }
]
```

`content_ids` references `content_library.id`. Multiple content items per activity is supported (e.g., a video + a worksheet for the same activity). `is_required` and `coach_can_substitute` fields give admin control over which activities are locked vs flexible.

#### Modified: Companion Panel

`ActivityTab.tsx` currently shows text labels. Modified to:
- Fetch content_library items for current activity's `content_ids`
- Display: content title, thumbnail, coach_guidance (learning objective + success criteria)
- "Open Material" button to view/play the content asset
- Coach still marks Done/Partial/Skipped/Struggled — no change to ActionButton

`InfoTab.tsx` gains a "Session Materials" section showing all content items for today's session template, pre-loaded for offline-friendly access.

#### Admin: Content Management

New route: `app/admin/content/` — CRUD for content_library items.
- Upload assets to Supabase storage
- Tag with skills, age_band, difficulty
- Write coach_guidance, parent_instruction, child_label
- Link to activities via session template editor

This is Rucha's primary workflow: create content → tag it → link to templates.

#### Downstream Auto-Pull (Built Into Existing Flows)

**Parent auto-assignment:** The existing `parent-summary` QStash job (POST `/api/coach/sessions/[id]/parent-summary`) already runs post-session. Modify to include content_ids from the session's template. Parent dashboard shows these as "Practice This Week" with `parent_instruction` text and asset links.

**rAI context:** Add content_library to rAI's available data. When rAI detects a struggle flag on a skill, it queries content_library for matching `skill_tags` and recommends specific content: "For Aarav's th-sound struggle, try 'Voiced Consonants Practice' (V-PH-023)."

---

### Build 2: Child Learning Profile (Gemini-Synthesized)

**Purpose:** A living, synthesized snapshot of each child that makes coach handover seamless. Updated after every session.

#### New Column or Table

Option A (simpler): Add `learning_profile` JSONB column to `children` table.
Option B (auditable): New `child_learning_profiles` table with version history.

**Recommended: Option A** — keep it simple. One JSONB column that gets overwritten after each session. If version history is needed later, learning_events already captures the raw data.

```sql
ALTER TABLE children ADD COLUMN learning_profile JSONB DEFAULT '{}';
-- Updated after each session by Gemini

-- Structure:
{
  "last_updated": "2026-02-11T10:30:00Z",
  "last_session_id": "uuid",
  "reading_level": {
    "current": "Foundation — Mid",
    "wpm": 34,
    "trend": "improving"
  },
  "active_skills": ["cvc_blending", "consonant_digraphs"],
  "mastered_skills": ["single_letter_sounds", "rhyming"],
  "struggle_areas": [
    { "skill": "th_sound", "sessions_struggling": 3, "severity": "moderate" },
    { "skill": "reading_comprehension_inference", "sessions_struggling": 1, "severity": "mild" }
  ],
  "what_works": [
    "Visual cues (mouth position diagrams)",
    "Game-based activities",
    "Repetition with variety — same skill, different words"
  ],
  "what_doesnt_work": [
    "Long reading passages without breaks — attention drops after 3 minutes"
  ],
  "personality_notes": "Enthusiastic starter, needs encouragement mid-activity. Responds well to praise. Gets frustrated with timed activities.",
  "parent_engagement": {
    "level": "high",
    "daily_task_completion_rate": 0.8,
    "attends_updates": true
  },
  "recommended_focus_next_session": "Continue th-sound with minimal pairs. Introduce 'th' in sentence context, not isolation.",
  "sessions_completed": 5,
  "sessions_remaining": 4
}
```

#### Gemini Trigger

Post-session flow (already exists as QStash job):
1. Activity logs saved ✅ (existing)
2. Recall transcript processed ✅ (existing)
3. Parent summary generated ✅ (existing)
4. **NEW: Gemini synthesizes/updates learning_profile**

The Gemini prompt receives:
- Current `learning_profile` (previous state)
- This session's activity_log (structured data from Companion Panel)
- This session's coach notes
- Recall transcript (if available)
- Gemini analysis from parent-summary step

Outputs updated `learning_profile` JSONB. Stored on `children.learning_profile`.

#### Where It's Consumed

- **Pre-session brief:** `/api/coach/sessions/[id]/brief` includes `learning_profile` — coach sees synthesized child snapshot, not raw data
- **rAI queries:** "Tell me about Aarav" → rAI reads learning_profile instead of running full RAG search
- **Coach handover:** New coach assigned → reads learning_profile → fully briefed in 30 seconds
- **Parent dashboard:** Simplified version shown as "Your child's progress"
- **Admin dashboard:** At-risk detection from `struggle_areas` severity + trend

---

### Build 3: Adherence Score (Gemini Post-Session)

**Purpose:** Measure how closely a session followed the prescribed template. Not punitive — diagnostic. Correlated with child outcomes over time to improve both templates and coaching.

#### New Columns

```sql
ALTER TABLE scheduled_sessions ADD COLUMN adherence_score DECIMAL(3,2);
-- 0.00 to 1.00 (percentage)

ALTER TABLE scheduled_sessions ADD COLUMN adherence_details JSONB DEFAULT '{}';
-- Breakdown per activity
```

#### Adherence Calculation

Post-session, compare `session_activity_log` against the session template's `activity_flow`:

```json
// adherence_details structure
{
  "score": 0.85,
  "activities_planned": 5,
  "activities_completed": 4,
  "activities_skipped": 1,
  "activities_struggled": 0,
  "sequence_followed": true,
  "total_planned_minutes": 30,
  "total_actual_minutes": 28,
  "per_activity": [
    {
      "activity_id": "act_01",
      "activity_name": "Warm-up: Rhyming Pairs",
      "status": "completed",
      "planned_minutes": 5,
      "actual_minutes": 4,
      "on_time": true
    },
    {
      "activity_id": "act_03",
      "activity_name": "New Sound Introduction",
      "status": "skipped",
      "planned_minutes": 8,
      "actual_minutes": 0,
      "reason": "skipped"
    }
  ]
}
```

#### Scoring Logic

This is simple math, NOT Gemini (keeping it deterministic):

```
adherence_score = (
  (completed_activities / planned_activities) × 0.60 +
  (sequence_match ? 1.0 : 0.5) × 0.20 +
  (time_within_range ? 1.0 : time_ratio) × 0.20
)
```

Where:
- `completed_activities` includes "completed" and "partial" (not "skipped")
- `sequence_match` = true if activities were done in template order
- `time_within_range` = actual total within ±25% of planned total

Gemini is NOT used for scoring — that's deterministic. Gemini IS used optionally to generate a qualitative note: "Coach covered 4/5 activities. Skipped New Sound Introduction, likely due to extra time on Blending Practice where the child needed reinforcement. This is a reasonable adaptation." This note goes into `adherence_details.ai_note`.

#### Where It's Consumed

- **Admin dashboard:** Adherence trends per coach over time (avg, trend direction)
- **Coach profile:** Coach sees their own adherence trend (self-awareness, not punishment)
- **Correlation analysis (future):** Admin can see: does higher adherence = better child progress? This answers the question "are our templates good?" not "are our coaches obedient?"

---

## What's NOT in This Build (Intentional Deferrals)

| Feature | Why Deferred | When It Makes Sense |
|---------|-------------|-------------------|
| E-learning browser | Needs content_library populated with actual videos (production work) | After 50+ content items exist |
| Content effectiveness tracking | Needs enough sessions to have statistical signal | After 100+ sessions with content_library linked |
| Coach comparison dashboard | Needs adherence + effectiveness data accumulated | After 3+ coaches with 20+ sessions each |
| Drift detection alerts | Needs adherence baseline established | After 50+ sessions with adherence scores |
| Adaptive content sequencing | Needs prerequisite/progression data proven | After content library is mature |
| Parent engagement tier calibration | Needs parent usage data | After 30+ active parents |
| Coach field notes on content | Nice-to-have, not critical path | When coaches request it |

---

## Build Sequence & Effort

| # | Build | Depends On | Estimated Effort | Impact |
|---|-------|-----------|-----------------|--------|
| 1 | Content Library table + Admin CRUD | Nothing — foundation | 8-10 hours | Unlocks everything |
| 1b | Modify activity_flow to reference content_ids | Build 1 | 3-4 hours | Links content to sessions |
| 1c | Modify Companion Panel to display content | Build 1b | 4-5 hours | Coach sees real materials |
| 1d | Parent auto-assignment post-session | Build 1b | 2-3 hours | Parents get homework |
| 2 | Child Learning Profile (Gemini synthesis) | Existing 4 data streams | 4-5 hours | Coach handover solved |
| 3 | Adherence Score | Build 1b (needs content-linked templates) | 3-4 hours | Consistency measurement |
| **Total** | | | **24-31 hours** | |

**Recommended execution order:** 1 → 1b → 2 → 1c → 3 → 1d

Build 2 (Child Learning Profile) can start in parallel with 1b since it depends on existing data streams, not the content library. This lets two Claude Code sessions work simultaneously if needed.

---

## Claude Code Execution Plan

### Session 1: Content Library Foundation
1. Run audit prompt (separate file) — verify current state
2. Create `content_library` table migration
3. Build admin CRUD at `app/admin/content/`
4. Seed 5-10 sample content items for testing
5. Modify `activity_flow` JSONB structure in session_templates

### Session 2: Companion Panel + Child Profile
1. Modify `/api/coach/sessions/[id]/live` to JOIN content_library
2. Update `ActivityTab.tsx` to render content cards
3. Add `learning_profile` column to children
4. Build Gemini synthesis prompt + post-session trigger
5. Modify pre-session brief to include learning_profile

### Session 3: Adherence Score + Parent Auto-Assignment
1. Add adherence columns to scheduled_sessions
2. Build adherence calculation in activity-log POST route
3. Modify parent-summary job to include content links
4. Add adherence view to admin dashboard
5. Add adherence trend to coach profile

---

## Success Metrics

After these 3 builds are live and 30+ sessions have run:

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Coach handover disruption | Parent NPS before/after coach change | No drop > 0.5 points |
| Content coverage consistency | Avg adherence score across coaches | > 0.80 |
| Parent homework engagement | % of assigned content viewed by parent | > 50% |
| Session prep time | Coach self-reported time reviewing brief | < 3 minutes |
| Child progress velocity | WPM improvement rate per session | Baseline → improve 10% |

---

## Files to Be Modified (Expected)

### New Files
- `app/admin/content/page.tsx` — Content library admin UI
- `app/api/admin/content/route.ts` — Content CRUD API
- Migration SQL for `content_library` table
- Migration SQL for `children.learning_profile` column
- Migration SQL for `scheduled_sessions.adherence_score` + `adherence_details`

### Modified Files
- `app/api/coach/sessions/[id]/live/route.ts` — JOIN content_library
- `components/coach/live-session/ActivityTab.tsx` — Render content cards
- `components/coach/live-session/InfoTab.tsx` — Show session materials
- `app/api/coach/sessions/[id]/activity-log/route.ts` — Calculate adherence score
- `app/api/coach/sessions/[id]/parent-summary/route.ts` — Include content links + trigger learning_profile update
- `app/api/coach/sessions/[id]/brief/route.ts` — Include learning_profile

> **IMPORTANT:** This list will be refined after Claude Code audit confirms actual file paths and current implementations.

---

*Document Version: 1.0*  
*Last Updated: February 11, 2026*  
*Next Step: Run Claude Code audit → Validate → Execute Build 1*
