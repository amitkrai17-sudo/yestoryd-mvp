# Session 4: Child Learning Profile + Adherence Score

## Date: 2026-02-11

## Objective
1. Persistent AI-synthesized child learning profile (Gemini) updated after every session
2. Deterministic adherence score comparing planned vs actual session activity

---

## Pre-Implementation Verification Scan

| Check | Finding |
|-------|---------|
| `learning_profile` column on children | **Not found** — no column, no type, no usage |
| `adherence_score` / `adherence_details` columns | **Not found** — no columns, no calculation logic |
| Gemini profile synthesis | **Not found** — only parent summaries exist (WhatsApp, <300 chars) |
| `what_works` / `what_doesnt_work` | **Not found** — planning docs only |
| `parent-summary/route.ts` | **161 lines** — generates WhatsApp summary, queued by activity-log |
| `brief/route.ts` | **185 lines** — returns session + child + template + last 2 events, NO profile |
| `ai-suggestion/route.ts` | **309 lines** — uses last 5 events raw, NO profile context |
| `activity-log/route.ts` | **288 lines** — saves logs, creates events, queues parent-summary via QStash |
| Gemini import pattern | `GoogleGenerativeAI` from `@google/generative-ai`, model `gemini-2.5-flash-lite` |

---

## Task 1: Child Learning Profile

### Migration

**File:** `supabase/migrations/20260211_child_learning_profile.sql`

```sql
ALTER TABLE children ADD COLUMN IF NOT EXISTS learning_profile JSONB DEFAULT '{}';
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS adherence_score DECIMAL(3,2) CHECK (adherence_score >= 0 AND adherence_score <= 1);
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS adherence_details JSONB DEFAULT '{}';
```

### Gemini Synthesis (parent-summary/route.ts)

Added `synthesizeLearningProfile()` function called AFTER parent summary generation and WhatsApp send. Runs inside the same QStash-triggered job.

**Data Collection (5 queries):**
1. `children` — current `learning_profile` (previous state, empty `{}` for first session)
2. `learning_events` — this session's merged event (session or session_companion_log)
3. `learning_events` — last 5 events (session, diagnostic_assessment, session_companion_log)
4. `learning_events` — active struggle flags (event_type = 'activity_struggle_flag', limit 10)
5. `parent_daily_tasks` — completion rate (try-catch, table may not exist)
6. `enrollments` + `scheduled_sessions` — sessions completed / remaining

**Gemini Prompt:**
- Model: `gemini-2.5-flash-lite`
- Input: current profile + this session's data + history + struggles + parent engagement
- Output: ONLY valid JSON with exact schema (reading_level, active/mastered skills, struggle areas, what works/doesn't, personality notes, parent engagement, recommended next focus)
- Instruction to UPDATE previous profile, not start from scratch

**Output Schema:**
```json
{
  "last_updated": "ISO timestamp",
  "reading_level": { "current": "Foundation — Early/Mid/Late", "wpm": null, "trend": "improving" },
  "active_skills": ["phonemic_awareness", "phonics"],
  "mastered_skills": [],
  "struggle_areas": [{ "skill": "fluency", "sessions_struggling": 2, "severity": "mild" }],
  "what_works": ["Visual cues", "Game-based activities"],
  "what_doesnt_work": ["Long passages without breaks"],
  "personality_notes": "Enthusiastic but needs structured transitions",
  "parent_engagement": { "level": "high", "task_completion_rate": 0.75 },
  "recommended_focus_next_session": "Continue phonics with blending practice",
  "sessions_completed": 3,
  "sessions_remaining": 6
}
```

**Error Handling:**
- Outer try-catch: if entire synthesis fails, logs error, parent summary still succeeds
- GEMINI_API_KEY check: returns early with log if missing
- JSON parse: explicit try-catch with first 200 chars of response in error message
- Markdown fence stripping: handles ` ```json ` wrapper from Gemini
- Structure validation: checks `last_updated` and `reading_level` exist
- Column missing: learning_profile select and update wrapped in try-catch

### Consumers

**brief/route.ts:**
- Fetches `learning_profile` in separate query with try-catch (backward compatible if column missing)
- Injects into response as `child.learning_profile` (null before migration applied)

**ai-suggestion/route.ts:**
- Fetches `learning_profile` with try-catch
- Builds rich `profileContext` string injected into Gemini prompt:
  - Reading Level + Trend
  - Active/Mastered/Struggling Skills
  - What Works / What Doesn't Work
  - Personality Notes
  - Parent Engagement
  - Recommended Next Focus
- Falls back to raw history context if profile unavailable

---

## Task 2: Adherence Score

### Calculation (activity-log/route.ts, Step 7)

Added between coach streak increment (step 6) and parent summary queue (step 8).

**Formula:**
```
adherence_score = (
  completion_ratio × 0.60 +
  sequence_score × 0.20 +
  time_score × 0.20
)
```

**Components:**
- `completion_ratio` = min(completed_or_partial / planned_count, 1.0)
  - Counts activities with status 'completed' or 'partial'
  - Capped at 1.0 (can't exceed 100%)
- `sequence_score` = 1.0 if completed indices ascending, 0.5 otherwise
  - Single activity or zero activities = 1.0 (trivially in order)
- `time_score` = 1.0 if within ±25% of planned time
  - Outside range: min(actual/planned, 1.5) / 1.5, capped at 1.0
  - If totalPlannedMinutes = 0 (no durations on template): defaults to 1.0

**Edge Cases Handled:**
- No template → skip (guarded by `if (session.session_template_id)`)
- No activity_flow or empty → skip (guarded by `activityFlow.length > 0`)
- All skipped → completionRatio = 0, score reflects that
- No planned_duration_minutes → totalPlannedMinutes = 0, time_score defaults to 1.0
- Old templates without activity_id → per_activity match falls back to activity_name
- Column doesn't exist → entire step wrapped in try-catch, logs and continues

**adherence_details Structure:**
```json
{
  "activities_planned": 4,
  "activities_completed": 3,
  "activities_partial": 0,
  "activities_skipped": 1,
  "activities_struggled": 0,
  "sequence_followed": true,
  "total_planned_minutes": 30,
  "total_actual_minutes": 27.5,
  "time_within_range": true,
  "per_activity": [
    { "activity_name": "Warm-up: Rhyming Pairs", "status": "completed", "planned_minutes": 5, "actual_minutes": 4.5 },
    { "activity_name": "Letter-Sound Mapping Drill", "status": "completed", "planned_minutes": 10, "actual_minutes": 12.0 },
    { "activity_name": "Sight Word Speedway Game", "status": "completed", "planned_minutes": 10, "actual_minutes": 8.0 },
    { "activity_name": "Celebration + Parent Handoff", "status": "skipped", "planned_minutes": 5, "actual_minutes": null }
  ]
}
```

---

## Task 3: Verification

### Backward Compatibility (All 4 Files Verified)

| File | Status | Guard |
|------|--------|-------|
| `parent-summary/route.ts` | OK | Outer try-catch on synthesis call, separate learning_profile select with try-catch |
| `brief/route.ts` | OK | Separate learning_profile query with try-catch, returns `null` if column missing |
| `ai-suggestion/route.ts` | OK | Try-catch on learning_profile select, empty profileContext if unavailable |
| `activity-log/route.ts` | OK | Entire adherence step in try-catch, skips if no template or no activity_flow |

### Compile Results

| Route | Method | HTTP Code | Status |
|-------|--------|-----------|--------|
| `/api/coach/sessions/[id]/brief` | GET | 200 | Compiled, returns child with learning_profile: null |
| `/api/coach/sessions/[id]/activity-log` | GET | 405 | Compiled (POST only) |
| `/api/coach/sessions/[id]/parent-summary` | POST | 404 | Compiled (session not found for test UUID) |
| `/api/coach/sessions/[id]/live` | GET | 200 | Session 3 routes still working |

### Migration

Migration file created. **Requires manual application** via Supabase Dashboard SQL Editor (CLI migration history out of sync with remote). Apply the 3 ALTER TABLE statements from `supabase/migrations/20260211_child_learning_profile.sql`.

After migration is applied:
- `learning_profile` will default to `{}` for all existing children
- `adherence_score` will be `null` for all existing sessions
- `adherence_details` will default to `{}` for all existing sessions
- New sessions will populate both fields automatically

### Database Types

Regenerated `lib/supabase/database.types.ts` via `npx supabase gen types`. Note: new columns won't appear in generated types until migration is applied to remote database.

---

## Session Manifest

### Files Modified (4)
| # | File | Changes |
|---|------|---------|
| 1 | `app/api/coach/sessions/[id]/parent-summary/route.ts` | Added `synthesizeLearningProfile()` function (step 7), ~120 lines added |
| 2 | `app/api/coach/sessions/[id]/brief/route.ts` | Separate learning_profile query with try-catch, inject into response |
| 3 | `app/api/coach/ai-suggestion/route.ts` | Fetch learning_profile, build profileContext for Gemini prompt |
| 4 | `app/api/coach/sessions/[id]/activity-log/route.ts` | Added adherence calculation (step 7), ~85 lines added |

### Files Created (2)
| File | Purpose |
|------|---------|
| `supabase/migrations/20260211_child_learning_profile.sql` | Schema: learning_profile, adherence_score, adherence_details |
| `docs/session4-profile-adherence-report.md` | This report |

### Database Changes
| Change | Table | Column | Type |
|--------|-------|--------|------|
| ADD | `children` | `learning_profile` | JSONB DEFAULT '{}' |
| ADD | `scheduled_sessions` | `adherence_score` | DECIMAL(3,2) CHECK (0-1) |
| ADD | `scheduled_sessions` | `adherence_details` | JSONB DEFAULT '{}' |

### API Endpoints Modified
| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/coach/sessions/[id]/parent-summary` | POST | Triggers learning_profile synthesis after summary |
| `/api/coach/sessions/[id]/brief` | GET | Returns `child.learning_profile` |
| `/api/coach/ai-suggestion` | POST | Uses learning_profile as primary Gemini context |
| `/api/coach/sessions/[id]/activity-log` | POST | Calculates + stores adherence_score and details |

---

## Data Flow

```
Coach completes session via Companion Panel
    │
    ▼
POST /api/coach/sessions/[id]/activity-log
    │
    ├── 1. Save activity logs to session_activity_log
    ├── 2. Create/merge learning_event
    ├── 3. Create struggle flags
    ├── 4. Mark session completed
    ├── 5. Increment coach streak
    ├── 6. Calculate adherence_score → save to scheduled_sessions    ◄── NEW
    └── 7. Queue parent-summary via QStash (5s delay)
              │
              ▼
         POST /api/coach/sessions/[id]/parent-summary
              │
              ├── Generate WhatsApp summary via Gemini
              ├── Store in learning_events
              ├── Send via AiSensy
              └── Synthesize learning_profile via Gemini → save to children    ◄── NEW
```

---

## Remaining Work

- [ ] Apply migration via Supabase Dashboard SQL Editor
- [ ] Regenerate database.types.ts after migration applied
- [ ] Test end-to-end with a real session completion (triggers profile synthesis)
- [ ] Monitor Gemini JSON output quality across first 10 sessions
- [ ] Consider capping profile synthesis history (currently last 5 events)
- [ ] Add adherence_score to admin CRM session view
- [ ] Add learning_profile summary to pre-session brief UI
