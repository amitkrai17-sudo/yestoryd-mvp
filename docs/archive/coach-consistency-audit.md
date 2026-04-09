# Yestoryd Coach Consistency & Content Architecture Audit

**Generated:** 11 February 2026
**Audited by:** Claude Code (5 parallel agents scanning full codebase)

---

## Executive Summary

Yestoryd has a **mature, well-integrated session delivery system** with a Companion Panel that guides coaches through structured activity flows, captures per-activity statuses (completed/partial/skipped/struggled), and generates parent summaries via Gemini AI. The template library infrastructure is fully built (admin CRUD, coach display, activity flow JSONB editor) but **only has ~3 templates populated** against a target of 40+. Two parallel data streams exist — Companion Panel (coach-logged) and Recall.ai (AI-transcribed) — but they are **not yet merged** into a unified learning event. The biggest architectural gap is the **absence of a content library** — activities reference text labels only, with no linked videos, worksheets, or practice materials.

---

## What Exists (Verified)

### 1. Session Templates

**Schema (V2 — actively used in API routes):**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| template_code | TEXT | Unique, e.g. 'F01', 'B05', 'M12' |
| age_band | ENUM | 'foundation' / 'building' / 'mastery' |
| session_number | INT | Position in age band |
| title | TEXT | Session title |
| description | TEXT | Nullable |
| focus_area | TEXT | Nullable |
| skill_dimensions | TEXT[] | e.g. ['phonemic_awareness', 'fluency'] |
| skills_targeted | TEXT[] | Nullable |
| difficulty_level | INT | 1-10 scale |
| duration_minutes | INT | Default 45 |
| prerequisites | TEXT[] | Array of template codes |
| recommended_order | INT | Curriculum position |
| materials_needed | TEXT[] | e.g. ['Flashcards', 'Whiteboard'] |
| activity_flow | JSONB | Array of ActivityStep objects |
| coach_prep_notes | TEXT | Nullable |
| parent_involvement | TEXT | Nullable |
| is_diagnostic | BOOLEAN | Session 1 marker |
| is_season_finale | BOOLEAN | Season-ending assessment marker |
| is_active | BOOLEAN | Visibility toggle |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| created_by | TEXT | Admin email |

**Activity Flow JSONB Structure:**

```json
[
  { "time": "0-5",   "activity": "Icebreaker: Letter Hunt",       "purpose": "Build confidence, letter recognition" },
  { "time": "5-20",  "activity": "Phoneme Blending Exercise",     "purpose": "Develop blending skills (CVC words)" },
  { "time": "20-40", "activity": "Passage Reading + Comprehension","purpose": "Apply skills in context" },
  { "time": "40-45", "activity": "Celebration + Parent Handoff",   "purpose": "Reinforce progress, set home practice expectations" }
]
```

**TypeScript interface** (`components/coach/live-session/types.ts`):
```typescript
interface ActivityStep {
  time: string;      // e.g. "0-5"
  activity: string;  // e.g. "Warm-up: Sound Recognition"
  purpose: string;   // e.g. "Activate phonemic awareness"
}
```

**Template Count:** ~3 rows in production (target: 40+ across F01-F15, B01-B13, M01-M12)

**Admin Management:** Yes — full CRUD
- List page: `app/admin/templates/page.tsx` (filter by age_band, search, toggle active)
- Edit/create page: `app/admin/templates/[id]/page.tsx` (full form with JSONB activity_flow editor)
- API: `app/api/admin/templates/route.ts` (GET list, POST create)
- API: `app/api/admin/templates/[id]/route.ts` (GET detail, PATCH update)

**Schema Mismatch Note:** `lib/supabase/database.types.ts` still has the OLD schema (template_name, structure, tips). The API routes use V2 fields directly, bypassing TypeScript type safety. No migration file found in `supabase/migrations/` for the V2 schema — table may have been created/altered via Supabase Dashboard.

---

### 2. Companion Panel (Live Session)

**Files** (`components/coach/live-session/`):

| File | Purpose |
|------|---------|
| `LiveSessionPanel.tsx` | Main orchestrator — manages phases (pre/live/complete), activity state, timer, localStorage persistence |
| `ActivityTab.tsx` | Renders activity flow with progress indicators, status icons, current activity hero card |
| `ActionButton.tsx` | Primary interaction — quick tap = "completed", long press (≥500ms) = 4-option menu |
| `InfoTab.tsx` | Context panel — child stats, areas to revisit (struggle flags), last session, parent activity, focus today |
| `RaiTab.tsx` | AI chat interface — quick prompts, calls `/api/coach/ai-suggestion` |
| `SessionHeader.tsx` | Sticky header — child info, timer bar (green/amber/red), Meet button, session progress |
| `SessionComplete.tsx` | Completion form — status counts grid, per-activity notes (150 char), session notes, save to API |
| `ProgressBar.tsx` | Horizontal bar — one segment per activity, color-coded by status |
| `types.ts` | Shared types — ActivityStep, TrackedActivity, LiveSessionData, ActivityStatus |
| `index.ts` | Barrel export |

**Activity Rendering:** Text labels only — coach sees activity name + purpose + time allocation. No actual interactive content, videos, or worksheets. The Companion Panel is a guide + timer alongside Google Meet.

**Data Capture per Activity:**

```typescript
interface TrackedActivity {
  index: number;
  activity: string;          // from template
  purpose: string;           // from template
  time: string;              // from template
  status: 'completed' | 'partial' | 'skipped' | 'struggled' | null;
  startedAt: number | null;  // timestamp ms
  completedAt: number | null;
  actualSeconds: number | null;
  coachNote: string | null;
}
```

**ActionButton Statuses:**
- Quick tap (<500ms) → `completed` (auto-advance)
- Long press menu → `completed` / `partial` / `skipped` / `struggled`
- End session early → current = `partial`, remaining = `skipped`

**Session Complete Flow** (trace from submit to DB):
1. `SessionComplete.handleSubmit()` — collects per-activity notes + session notes
2. **POST** `/api/coach/sessions/{id}/activity-log` — payload with activities[], elapsed time, notes
3. **Bulk insert** into `session_activity_log` table
4. **Create** `learning_events` entry (type: `session_companion_log`) — full activities array, status counts, elapsed time
5. **Create** struggle flags — separate `learning_events` entry (type: `activity_struggle_flag`) for each `status='struggled'`
6. **Update** `scheduled_sessions` — status → 'completed', companion_panel_completed → true, coach_notes, session_timer_seconds
7. **Increment** `coaches.completed_sessions_with_logs`
8. **Queue** parent summary generation via QStash (5s delay) → `/api/coach/sessions/{id}/parent-summary`

**Persistence:** localStorage saves every 10s during live phase. 24-hour TTL. Auto-resume banner if coach returns within window.

**Wake Lock:** Prevents screen sleep during active session.

---

### 3. Session Activity Log

**Table Schema** (`supabase/migrations/20260209_session_activity_log.sql`):

| Column | Type | Constraint |
|--------|------|-----------|
| id | UUID | PK |
| session_id | UUID | NOT NULL, FK → scheduled_sessions ON DELETE CASCADE |
| activity_index | INT | NOT NULL |
| activity_name | TEXT | NOT NULL |
| activity_purpose | TEXT | Nullable |
| status | TEXT | NOT NULL, CHECK: 'completed', 'partial', 'skipped', 'struggled' |
| planned_duration_minutes | INT | Nullable |
| actual_duration_seconds | INT | Nullable |
| coach_note | TEXT | Nullable |
| started_at | TIMESTAMPTZ | Nullable |
| completed_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Index:** `idx_sal_session` on session_id

**Companion Panel V2 columns** added to `scheduled_sessions` (`20260209_companion_panel_v2.sql`):
- `session_started_at` TIMESTAMPTZ — when coach clicks Start
- `companion_panel_completed` BOOLEAN DEFAULT false — activity logs submitted
- `transcript_status` TEXT DEFAULT 'none' — Recall.ai state ('none'/'awaiting'/'processing'/'completed')
- `completion_nudge_sent_at` TIMESTAMPTZ — re-engagement tracking

**Coach metric:** `coaches.completed_sessions_with_logs` INT DEFAULT 0 — incremented on each activity-log submission.

---

### 4. Data Streams & Learning Events

**Three parallel data streams feed `learning_events`:**

#### Stream 1: Companion Panel (Coach-Logged)
```
Coach completes live panel → POST /activity-log
  → session_activity_log (per-activity rows)
  → learning_events (type: 'session_companion_log')
  → learning_events (type: 'activity_struggle_flag') × N
  → learning_events (type: 'parent_session_summary') via QStash
```

#### Stream 2: Recall.ai Recording (Auto-Transcribed)
```
Recall.ai bot.done webhook → quick attendance analysis
  → QStash queue → /api/jobs/process-session
  → Gemini analyzes 15k chars transcript
  → scheduled_sessions (full analysis fields)
  → learning_events (type: 'session' with AI analysis)
  → children (cache: last_session_summary, focus, date)
```

#### Stream 3: Assessments & Milestones
```
Diagnostic → learning_events (type: 'diagnostic_assessment')
Exit assessment → learning_events (type: 'exit_assessment')
E-learning → learning_events (type: 'unit_completed')
```

**All `event_type` values found in codebase:**

| Event Type | Source | Purpose |
|------------|--------|---------|
| `session` | Recall.ai + Gemini | Full transcript analysis (focus, skills, progress, engagement) |
| `session_companion_log` | Companion Panel | Coach-logged activities with statuses |
| `activity_struggle_flag` | Companion Panel | Per-activity struggle marker |
| `parent_session_summary` | QStash → Gemini | WhatsApp-friendly 2-3 sentence summary |
| `diagnostic_assessment` | Coach diagnostic form | Initial child baseline |
| `exit_assessment` | Season finale | Before/after metrics |
| `assessment` | Assessment retry | Re-scored reading assessment |
| `session_rescheduled` | Reschedule action | Audit trail |
| `session_cancelled` | Cancel action | Audit trail |
| `session_missed` | No-show detection | Attendance tracking |
| `unit_completed` | E-learning | Course progress |
| `milestone` | Achievement | Progress markers |
| `quiz` | Quiz result | E-learning quizzes |
| `handwritten` | Writing eval | Handwriting assessment |
| `note` | Manual entry | Freeform coach note |

**Gemini AI Integration Points:**

| File | Model | Purpose |
|------|-------|---------|
| `app/api/coach/sessions/[id]/parent-summary/route.ts` | gemini-2.5-flash-lite | Transform activity logs → parent WhatsApp message (<300 chars) |
| `app/api/jobs/process-session/route.ts` | gemini-2.5-flash-lite | Analyze Recall transcript → structured session analysis |
| `app/api/learning-events/route.ts` | gemini-2.5-flash-lite + text-embedding-004 | Summarize events + generate embeddings for RAG |
| `app/api/coach/ai-suggestion/route.ts` | gemini-2.5-flash-lite | Real-time coaching recommendations |

**Recall.ai webhook** (`app/api/webhooks/recall/route.ts`, 736 lines):
- Handles bot status changes (joining, in_call_recording, fatal, timeout)
- On `bot.done`: quick attendance analysis, queues heavy processing to QStash
- Smart transcript chunking: 40% beginning + 20% middle summary + 40% end
- Stores recording URL, duration, attendance in `recall_bot_sessions`

**Critical TODO** (line 586-589 of recall webhook):
```
// TODO: When process-session job completes, merge Recall transcript
//       insights with session_activity_log data from the Companion Panel.
//       Check if companion_panel_completed is true on the session, and
//       if so, enrich the existing learning_event with transcript analysis.
```

---

### 5. Struggle Flags & Continuity

**Creation:** In `POST /api/coach/sessions/[id]/activity-log`:
- Filters activities where `status === 'struggled'`
- Creates one `learning_events` row per struggle with `event_type: 'activity_struggle_flag'`
- Stores: `activity_name`, `activity_purpose`, `coach_note`, `session_number`, `logged_by`

**Display in Next Session:** In `GET /api/coach/sessions/[id]/live`:
- Queries `learning_events WHERE event_type = 'activity_struggle_flag' AND child_id = ? ORDER BY created_at DESC LIMIT 5`
- Extracts: `activity_name`, `session_number`, `coach_note`
- Returns as `recent_struggles` array

**InfoTab.tsx "Areas to Revisit":** Yes — renders `recent_struggles` array with:
- Activity name + session number
- Coach note (if available)
- Amber warning theme styling

---

### 6. Pre-Session Brief

**Route:** `GET /api/coach/sessions/[id]/brief/route.ts` (186 lines)

**Returns:**
```typescript
{
  session: { id, child_id, session_number, session_type, is_diagnostic,
             duration_minutes, scheduled_date, scheduled_time, status,
             google_meet_link, total_sessions, companion_panel_completed,
             parent_summary },
  child: { id, child_name, age, age_band, parent_name, parent_email,
           latest_assessment_score },
  template: { id, template_code, title, description, activity_flow,
              materials_needed, coach_prep_notes, parent_involvement,
              skill_dimensions, difficulty_level, duration_minutes,
              is_diagnostic } | null,
  recent_sessions: [{ id, event_type, summary, data, created_at }],  // last 3
  diagnostic_completed: boolean,
  activity_logs: [{ activity_index, activity_name, activity_purpose,
                    status, coach_note, actual_duration_seconds }] | null,  // post-completion
  companion_log_notes: string | null,  // from session_companion_log event
  next_session_id: string | null
}
```

**Includes previous session data:** Yes — `recent_sessions` fetches last 3 learning_events of types 'session', 'diagnostic_assessment', 'session_companion_log'.

**Includes struggle flags:** No — brief route does NOT fetch struggles. Only the live route does.

**Daily digest for coaches:** No dedicated daily digest cron found. Coach reminders exist (`/api/cron/coach-reminders-1h`) but not a learning-context digest.

---

### 7. rAI Coach Support

**Route:** `POST /api/coach/ai-suggestion/route.ts`

**Context Received:**
- childId, childName, childAge
- primaryFocus (one of 8 focus areas: phonics, fluency, comprehension, vocabulary, grammar, creative_writing, pronunciation, story_analysis)
- skillsPracticed (today's session)
- highlights, challenges
- focusProgress ('breakthrough', 'significant_improvement', 'improved', 'same', 'declined')
- engagementLevel ('low', 'moderate', 'high')
- Previous 5 sessions from `learning_events` table

**AI Model:** Gemini 2.5 Flash Lite

**Capabilities:**
- Analyzes child's history trajectory
- Generates 2-3 sentence actionable recommendations
- Returns specific activity suggestions based on progress level
- Fallback to template-based suggestions if Gemini unavailable

**rAI Library** (`lib/rai/`):

| File | Purpose |
|------|---------|
| `prompts.ts` | System prompts for parent, coach, and session prep contexts |
| `admin-insights.ts` | Admin analytics |
| `intent-classifier.ts` | WhatsApp intent classification |
| `proactive-notifications.ts` | Engagement notifications |
| `hybrid-search.ts` | Vector + text search over learning_events |
| `embeddings.ts` | Vector embedding generation |

**Chain of Thought:** Not explicitly implemented. Uses single-turn Gemini prompt with context injection.

---

### 8. Compliance & Quality

**Session Completion Nudge** (`app/api/cron/session-completion-nudge/route.ts`):
- Runs every 15 minutes (configured in `vercel.json`)
- Finds sessions in `in_progress` status > 45 minutes old with `companion_panel_completed = false`
- Sends WhatsApp via AiSensy template `session_completion_nudge`
- Marks `completion_nudge_sent_at` to prevent duplicate sends

**Re-enrollment Nudge** (`app/api/cron/re-enrollment-nudge/route.ts`):
- 4-message sequence at days 1, 3, 7, 14 after season completion
- Queries `re_enrollment_nudges` table
- Customized message per nudge_number
- Checks if child already re-enrolled (skips if active enrollment exists)

**Vercel Cron Jobs** (from `vercel.json`):

| Schedule | Route | Purpose |
|----------|-------|---------|
| `0 0 * * *` | `/api/cron/enrollment-lifecycle` | Daily enrollment management |
| `0 4 7 * *` | `/api/cron/monthly-payouts` | Monthly coach payouts |
| `*/15 * * * *` | `/api/cron/session-completion-nudge` | 45-min completion nudge |

**Additional cron routes exist** but are NOT configured in `vercel.json`:
- `/api/cron/coach-reminders-1h`
- `/api/cron/coach-engagement`
- `/api/cron/lead-scoring`
- `/api/cron/discovery-followup`
- `/api/cron/payment-reconciliation`
- `/api/cron/compute-insights`
- `/api/cron/re-enrollment-nudge`

**Coach Streak:** `coaches.completed_sessions_with_logs` — incremented in activity-log route, displayed in Companion Panel header.

---

### 9. Diagnostic & Exit Assessment

**Diagnostic** (`app/api/coach/diagnostic/[id]/route.ts`):
- GET: Retrieve existing diagnostic + session details
- POST: Save diagnostic → `learning_events` (type: 'diagnostic_assessment')
- Triggers `generateLearningPlan()` — creates roadmap_id, season plan items, focus areas

**Exit Assessment** (`app/api/coach/sessions/[id]/exit-assessment/route.ts`):
- GET: Load exit data + diagnostic baseline for before/after comparison
- POST: Save exit → `learning_events` (type: 'exit_assessment')
- Triggers `completeSeason()` — marks enrollment 'season_completed', creates next season roadmap, schedules re-enrollment nudges

**Skill fields by age band** (for before/after deltas):
- Foundation: Sound skills, letter sounds, blending, rhyming
- Building: Decoding, fluency, comprehension, vocabulary
- Mastery: Grammar, expression, prosody, stamina

---

### 10. E-Learning Platform

**Status:** Fully implemented

**API Routes** (`app/api/elearning/`):
- `/dashboard` — child avatar, identity, gamification stats
- `/progress` — learning progress tracking
- `/quiz/[quizId]` — quiz content & questions
- `/submit-quiz` — scoring
- `/videos/[videoId]/progress` — video progress
- `/games/[gameId]` — game content
- `/gamification` — XP, badges, leaderboard
- `/recommendations` — AI-recommended units
- `/avatar` — avatar customization
- `/unit/[unitId]` — unit content
- `/session` — e-learning session tracking
- `/complete` — mark unit/quiz complete

**Database Tables:** `el_child_avatars`, `el_child_identity`, `el_child_gamification`, `el_child_badges`, `el_learning_units`, `el_skills`, `el_modules`, `el_stages`

---

### 11. Parent Dashboard

**Parent Pages:**

| Page | Purpose |
|------|---------|
| `app/parent/sessions/page.tsx` | All sessions (upcoming/completed/cancelled), reschedule/cancel, join link |
| `app/parent/journey/page.tsx` | Season roadmap, session timeline with activity status, AI-generated highlights |
| `app/parent/report/[enrollmentId]/page.tsx` | Season completion report — before/after skill growth, coach message, share via WhatsApp |
| `app/parent/tasks/page.tsx` | Daily reading tasks (10 min), weekly calendar, streak tracking |
| `app/parent/re-enroll/page.tsx` | Re-enrollment flow |

**Parent API Routes (12+):**
- `/api/parent/dashboard`, `/api/parent/report/[enrollmentId]`, `/api/parent/roadmap/[childId]`
- `/api/parent/tasks/[childId]`, `/api/parent/tasks/[childId]/complete`
- `/api/parent/re-enroll/[childId]`, `/api/parent/session/reschedule`
- `/api/parent/session/available-slots`, `/api/parent/progress`
- `/api/parent/referral`, `/api/parent/enrolled-child`, `/api/parent/notification-preferences`

**Post-session content delivery:** Parent summary sent via WhatsApp (Gemini-generated, <300 chars). Visible in journey page. No links to practice materials.

---

### 12. Season & Learning Plans

**Tables:**
- `season_roadmaps` — child_id, enrollment_id, season_number, age_band, roadmap_data (JSONB), status (draft/active/completed)
- `season_learning_plans` — roadmap_id, session_number, session_template_id (FK), focus_area, objectives, success_criteria, status

---

## What's Missing (Gaps)

### GAP 1: Content Library (Critical)

**Current state:** No `content_library`, `content_items`, or `content_assets` table exists anywhere in migrations, SQL files, or code.

**What `activity_flow` contains:** Plain text labels only — `{ time, activity, purpose }`. No content IDs, no video references, no worksheet links, no material URLs.

**Impact:** Coaches see "Phoneme Blending Exercise" as a text label but have no linked worksheets, video demos, or practice materials. Content delivery depends entirely on coach training and memory.

**What's needed:** A content_assets table linking reusable materials (videos, worksheets, games, reading passages) to activity steps, plus a UI for coaches to access them during live sessions.

---

### GAP 2: Data Stream Merge (High Priority)

**Current state:** Companion Panel logs (coach-entered) and Recall.ai analysis (AI-generated) create separate `learning_events` entries. There is a TODO comment (recall webhook line 586) acknowledging the need to merge them.

**Impact:** rAI and dashboards see two partial views of the same session instead of one unified record. Parent summaries only use Companion Panel data (not transcript insights).

---

### GAP 3: Adherence Scoring (Medium)

**Current state:** No comparison of `session_activity_log` (actual) vs `session_templates.activity_flow` (planned). No compliance percentage, deviation tracking, or quality metrics.

**Missing tables:** No `session_effectiveness` table found.

**Partial signal:** `status_counts` (completed/partial/skipped/struggled) are stored in learning_events but not aggregated into a coach performance score.

---

### GAP 4: Coach Comparison / Quality Dashboard

**Current state:** `app/admin/completion/page.tsx` tracks enrollment-level risk (overdue, at-risk, inactive) but does NOT compare coach performance.

**Missing:** No coach comparison metrics, no average status distribution per coach, no session quality scoring, no adherence leaderboard.

---

### GAP 5: Template Assignment Automation

**Current state:** `session_template_id` FK exists on `scheduled_sessions` but is not auto-populated. `season_learning_plans` has `session_template_id` FK but plan generation doesn't systematically assign templates.

**Impact:** Templates must be manually assigned. No system auto-selects template based on age_band + session_number + diagnostic results.

---

### GAP 6: Child Learning Profile (Synthesized)

**Current state:** No unified "child learning profile" view. Data is distributed across:
- `learning_events` (multiple event types)
- `children` (cached last_session_summary, assessment score, streak)
- `session_activity_log` (activity-level data)
- `season_roadmaps` (roadmap data)

**Missing:** A synthesized profile that combines all data streams into a single child trajectory view.

---

### GAP 7: Parent Content Delivery

**Current state:** Parent receives WhatsApp summary (2-3 sentences) after each session. Journey page shows timeline + highlights.

**Missing:**
- No homework/practice assignment system (fields exist in `scheduled_sessions` but not populated via Companion Panel)
- No links to practice materials or worksheets
- No parent-facing activity content

---

### GAP 8: Template Population

**Current state:** ~3 templates exist. Target: 40+ (F01-F15, B01-B13, M01-M12).

**Infrastructure ready:** Admin CRUD, JSONB editor, coach display — all functional. Just needs content population.

---

### GAP 9: database.types.ts Stale

**Current state:** Generated Supabase types file still has OLD session_templates schema (template_name, structure, tips). API routes bypass type safety by using V2 columns directly.

**Fix needed:** Run `supabase db pull` → `supabase gen types` to regenerate.

---

## File Inventory

### Session Templates
| File | Lines | Purpose |
|------|-------|---------|
| `app/api/admin/templates/route.ts` | 127 | GET list, POST create |
| `app/api/admin/templates/[id]/route.ts` | 114 | GET detail, PATCH update |
| `app/admin/templates/page.tsx` | 309 | Template list UI (filter, search, toggle) |
| `app/admin/templates/[id]/page.tsx` | 565 | Template create/edit form with JSONB editor |

### Companion Panel
| File | Lines | Purpose |
|------|-------|---------|
| `components/coach/live-session/LiveSessionPanel.tsx` | ~400 | Main orchestrator (phases, state, timer, persistence) |
| `components/coach/live-session/ActivityTab.tsx` | ~150 | Activity flow display with progress |
| `components/coach/live-session/ActionButton.tsx` | ~100 | Status capture (tap/long-press) |
| `components/coach/live-session/InfoTab.tsx` | ~200 | Context panel (struggles, last session, parent tasks) |
| `components/coach/live-session/RaiTab.tsx` | ~120 | AI chat interface |
| `components/coach/live-session/SessionHeader.tsx` | ~100 | Timer bar, child info, Meet button |
| `components/coach/live-session/SessionComplete.tsx` | ~250 | Completion form, per-activity notes |
| `components/coach/live-session/ProgressBar.tsx` | ~50 | Color-coded status bar |
| `components/coach/live-session/types.ts` | 101 | Shared TypeScript types |
| `components/coach/live-session/index.ts` | 3 | Barrel export |

### Session API Routes
| File | Lines | Purpose |
|------|-------|---------|
| `app/api/coach/sessions/[id]/live/route.ts` | 285 | GET live data + PATCH mark in_progress |
| `app/api/coach/sessions/[id]/activity-log/route.ts` | 240 | POST save activity logs + create events |
| `app/api/coach/sessions/[id]/brief/route.ts` | 186 | GET pre/post session data |
| `app/api/coach/sessions/[id]/parent-summary/route.ts` | 162 | Gemini summary → WhatsApp |
| `app/api/coach/sessions/[id]/complete/route.ts` | ~150 | Legacy completion flow |
| `app/api/coach/sessions/[id]/exit-assessment/route.ts` | 295 | Exit assessment + season completion |
| `app/api/coach/diagnostic/[id]/route.ts` | ~200 | Diagnostic assessment + learning plan |
| `app/api/coach/ai-suggestion/route.ts` | ~150 | rAI coaching recommendations |

### Recall.ai & Processing
| File | Lines | Purpose |
|------|-------|---------|
| `app/api/webhooks/recall/route.ts` | 736 | Recall.ai webhook handler |
| `app/api/jobs/process-session/route.ts` | ~500 | Gemini transcript analysis |

### Cron Jobs
| File | Purpose |
|------|---------|
| `app/api/cron/session-completion-nudge/route.ts` | 45-min companion panel nudge |
| `app/api/cron/re-enrollment-nudge/route.ts` | Post-season parent re-enrollment |
| `app/api/cron/enrollment-lifecycle/route.ts` | Daily enrollment management |

### Parent Pages
| File | Purpose |
|------|---------|
| `app/parent/sessions/page.tsx` | Session list (upcoming/completed) |
| `app/parent/journey/page.tsx` | Season roadmap + timeline |
| `app/parent/report/[enrollmentId]/page.tsx` | Season completion report |
| `app/parent/tasks/page.tsx` | Daily reading tasks + streaks |
| `app/parent/re-enroll/page.tsx` | Re-enrollment flow |

### rAI Library
| File | Purpose |
|------|---------|
| `lib/rai/prompts.ts` | System prompts for parent/coach/session prep |
| `lib/rai/admin-insights.ts` | Admin analytics |
| `lib/rai/intent-classifier.ts` | WhatsApp intent classification |
| `lib/rai/proactive-notifications.ts` | Engagement notifications |
| `lib/rai/hybrid-search.ts` | Vector + text search |
| `lib/rai/embeddings.ts` | Vector embedding generation |

### Season & Completion
| File | Purpose |
|------|---------|
| `lib/completion/complete-season.ts` | Season completion logic (marks enrollment, creates next roadmap, schedules nudges) |
| `lib/plan-generation/` | Learning plan generation from diagnostic |

---

## Database Tables Inventory

### Core Session Delivery

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `scheduled_sessions` | 90+ columns | Central session record (scheduling, status, notes, AI analysis, recordings) |
| `session_activity_log` | 12 columns | Per-activity tracking during live sessions |
| `session_templates` | 20+ columns | Reusable session designs with activity_flow |
| `learning_events` | 15+ columns | Unified event store (all learning moments) |
| `session_change_requests` | 12 columns | Parent cancel/reschedule requests |

### Planning & Roadmaps

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `season_roadmaps` | 11 columns | Season-level learning roadmap |
| `season_learning_plans` | 12 columns | Per-session plan within roadmap |
| `age_band_config` | 11 columns | Age band parameters (Foundation/Building/Mastery) |

### Parent Engagement

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `parent_daily_tasks` | 12 columns | Daily practice tasks with completion tracking |
| `re_enrollment_nudges` | 9 columns | Post-season nudge scheduling |

### Coach Management

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `coaches` | incl. completed_sessions_with_logs | Coach metrics |
| `coach_specializations` | 7 columns | Skill area proficiency |
| `coach_reassignment_log` | 14 columns | Coach change audit trail |
| `coach_engagement_log` | 11 columns | Automated engagement messages |
| `scheduling_queue` | 13 columns | Manual scheduling escalation |

### Recordings

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `recall_bot_sessions` | bot_id, status, recording_url, duration | Recall.ai bot tracking |

### E-Learning

| Table | Purpose |
|-------|---------|
| `el_learning_units` | Content units |
| `el_child_gamification` | XP, badges, streaks |
| `el_child_avatars` | Avatar customization |
| `el_child_badges` | Earned badges |
| `el_skills`, `el_modules`, `el_stages` | Skill hierarchy |
| `learning_games` | Game definitions |
| `learning_modules` | Module definitions |

---

## Recommended Build Sequence

Based on the gaps identified, here is the recommended priority order:

### Phase 1: Foundation (Content & Templates)
1. **Populate template library** — Create all 40+ session templates (F01-F15, B01-B13, M01-M12) with complete activity_flow, materials, coach_prep_notes, parent_involvement
2. **Fix database.types.ts** — Run `supabase gen types` to regenerate accurate TypeScript types
3. **Template auto-assignment** — Build logic to assign session_template_id to scheduled_sessions based on age_band + session_number from season_learning_plans

### Phase 2: Content Assets
4. **Create `content_assets` table** — id, title, type (video/worksheet/game/passage), url, age_band, skill_dimensions, duration_minutes, thumbnail_url
5. **Link activities to content** — Extend activity_flow JSONB to include `content_ids: string[]` per step
6. **Coach content panel** — Add content links/previews to Companion Panel ActivityTab (open in new tab alongside Meet)

### Phase 3: Data Unification
7. **Merge data streams** — Implement the TODO: combine Companion Panel logs + Recall.ai transcript analysis into unified learning_event per session
8. **Synthesized child profile** — Create a view or API that aggregates all learning_events, activity_logs, and assessment data into a single child trajectory

### Phase 4: Quality & Compliance
9. **Adherence scoring** — Compare session_activity_log (actual) vs session_templates.activity_flow (planned) → generate deviation % and quality score
10. **Coach quality dashboard** — Admin view comparing coaches on: completion rates, activity status distributions, streak, adherence scores
11. **Homework/practice assignment** — Enable coaches to assign take-home content from content_assets via Companion Panel completion form

### Phase 5: Parent Content
12. **Parent content delivery** — Post-session: share relevant practice materials, video links, and worksheets via WhatsApp + parent dashboard
13. **Daily task enrichment** — Link parent_daily_tasks to content_assets for guided practice

---

*End of audit. All findings verified against actual codebase — no assumptions.*
