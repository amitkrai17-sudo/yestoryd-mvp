# Session 5: Final Wiring — Parent Practice Loop + Coach Engagement Visibility

## Date: 2026-02-12

## Objective
1. Auto-assign practice materials to parents after each session (from session template content_refs)
2. Parent dashboard "Practice This Week" section with content viewing tracking
3. Pre-session brief shows parent content engagement metrics to coach
4. End-to-end verification of the complete data flow (Sessions 1-5)

---

## Pre-Implementation Verification Scan

| Check | Finding |
|-------|---------|
| `parent_practice_assigned` event type | **Not found** — no existing implementation |
| Content ref extraction in parent-summary | **Not found** — summary route had no template/content awareness |
| Parent practice section on dashboard | **Not found** — journey page had timeline + summaries only |
| `/api/parent/content-viewed` route | **Not found** — no content viewing tracking |
| Parent engagement in brief/live routes | **Not found** — only parent_daily_tasks completion tracked |
| Content resolution pattern | **Exists** in `live/route.ts` lines 79-191 — reused pattern |
| AiSensy send pattern | **Exists** in `lib/communication/aisensy.ts` — appended to existing template |
| InfoTab parent section | **Exists** — Parent Activity (task completion) section at lines 143-165 |

---

## Task 1: Parent Content Auto-Assignment

### Modified: `app/api/coach/sessions/[id]/parent-summary/route.ts`

**Changes (3 new steps between summary generation and WhatsApp send):**

**Step 5b — Extract practice materials:**
- Added `session_template_id` to the session query SELECT
- If template exists, fetch `activity_flow` from `session_templates`
- Extract all `content_refs` with type `video` or `worksheet`
- Batch-resolve asset details from `el_videos` and `el_worksheets` (title, asset_url, thumbnail_url)

**Step 5c — Create learning event:**
- New event type: `parent_practice_assigned`
- `event_data` structure:
```json
{
  "session_id": "uuid",
  "session_number": 3,
  "items": [
    { "type": "video", "id": "uuid", "title": "Phonics Song", "asset_url": "https://..." },
    { "type": "worksheet", "id": "uuid", "title": "Letter Tracing", "asset_url": "https://..." }
  ],
  "assigned_at": "2026-02-12T10:00:00Z"
}
```

**Step 5d — Append to WhatsApp summary:**
- Builds "Practice Materials" section with item titles and types
- Appends to the AI-generated summary before sending via AiSensy
- Example output:
```
Arjun had a wonderful session today! We focused on phonics...

Practice Materials:
- Phonics Song (Video)
- Letter Tracing A-E (Worksheet)
```

**Error handling:** Each step wrapped in try-catch. If content extraction fails, summary still sends without practice section.

---

## Task 2: Parent Dashboard Practice Section

### New: `app/api/parent/content-viewed/route.ts`

**Purpose:** Track when a parent opens a practice content item.

**Method:** POST
**Auth:** Supabase session token (Bearer header)
**Body:** `{ event_id: string, content_ref_id: string }`

**Logic:**
1. Fetch the `parent_practice_assigned` learning event by ID
2. Find the matching content item in `event_data.items`
3. Set `viewed_at` timestamp on first view (idempotent — skips if already viewed)
4. Update the learning event's `event_data`

**Response:** `{ success: true }` or `{ success: true, already_viewed: true }`

### Modified: `app/parent/journey/page.tsx`

**New "Practice This Week" section** inserted between Next Session card and Session Timeline.

**Data fetch:**
- Queries `learning_events` where `event_type = 'parent_practice_assigned'` for this child, last 7 days
- Stores in `practiceEvents` state

**UI:**
- Card header: "Practice This Week" with opened/total counter
- Content items displayed as clickable rows with:
  - Type icon (Film for video, FileText for worksheet)
  - Title
  - Type label + "Opened" indicator if viewed
  - External link icon
- On click: opens asset URL in new tab + POSTs to `/api/parent/content-viewed` to track

---

## Task 3: Pre-Session Brief Enhancement

### Modified: `app/api/coach/sessions/[id]/brief/route.ts`

**New step 7b — Parent content engagement:**
- Finds previous completed session date for this child
- Queries `parent_practice_assigned` events since that date
- Aggregates across all events: total items assigned, total items with `viewed_at`
- Returns in response:
```json
{
  "parent_content_engagement": {
    "materials_assigned": 4,
    "materials_viewed": 3,
    "completion_rate": 0.75
  }
}
```
- Returns `null` if no practice events found

### Modified: `app/api/coach/sessions/[id]/live/route.ts`

**Same parent content engagement query** added (step 8b), included in live session response so the Companion Panel has access.

### Modified: `components/coach/live-session/types.ts`

**New interface:**
```typescript
export interface ParentContentEngagement {
  materials_assigned: number;
  materials_viewed: number;
  completion_rate: number; // 0.0-1.0
}
```

Added `parent_content_engagement?: ParentContentEngagement | null` to `LiveSessionData`.

### Modified: `components/coach/live-session/InfoTab.tsx`

**New "Practice Materials" indicator** between Parent Activity and Focus Today sections:
- Progress bar showing viewed/assigned ratio
- Color-coded: green (>75%), amber (25-75%), red (<25%)
- Text: "3/4 viewed"
- Only shows when `materials_assigned > 0`

---

## Task 4: End-to-End Verification

### Complete Data Flow (Sessions 1-5 Wired)

```
1. CONTENT CREATION (Admin)
   admin/templates → session_templates.activity_flow[].content_refs
   ├── References: el_videos, el_worksheets, el_game_content
   └── Each ref: { type, id, label }

2. TEMPLATE ASSIGNMENT (Enrollment Scheduler)
   enrollment-scheduler.ts → season_learning_plans.session_template_id
   └── Maps to: scheduled_sessions.session_template_id

3. SESSION PREP (Coach opens Companion Panel)
   GET /api/coach/sessions/[id]/live
   ├── Fetches session_template.activity_flow
   ├── Resolves content_refs → el_videos, el_worksheets, el_game_content
   ├── Fetches coach_guidance from el_learning_units
   ├── Returns: resolved_content map (index → asset details)
   ├── Returns: parent_content_engagement (since last session)     ◄── NEW (S5)
   └── InfoTab shows: content cards, parent engagement indicator   ◄── NEW (S5)

4. PRE-SESSION BRIEF
   GET /api/coach/sessions/[id]/brief
   ├── Returns: child.learning_profile (Gemini-synthesized)        ◄── S4
   ├── Returns: parent_content_engagement metrics                   ◄── NEW (S5)
   └── Returns: template, recent events, diagnostic status

5. LIVE SESSION (Coach uses Companion Panel)
   FlowTab: Activity cards with timers, status tracking, notes
   InfoTab: Child stats, struggles, content, parent engagement
   rAI Tab: AI suggestions using learning_profile context

6. SESSION COMPLETION (Coach submits activity log)
   POST /api/coach/sessions/[id]/activity-log
   ├── Save activity logs → session_activity_log
   ├── Create/merge learning_event (session_companion_log)
   ├── Create struggle flags (activity_struggle_flag events)
   ├── Mark session completed
   ├── Increment coach streak
   ├── Calculate adherence_score → scheduled_sessions               ◄── S4
   └── Queue parent-summary via QStash (5s delay)

7. PARENT SUMMARY + PRACTICE ASSIGNMENT
   POST /api/coach/sessions/[id]/parent-summary (QStash)
   ├── Generate AI summary via Gemini
   ├── Store parent_session_summary learning_event
   ├── Extract content_refs from session template                   ◄── NEW (S5)
   ├── Resolve video/worksheet assets                               ◄── NEW (S5)
   ├── Create parent_practice_assigned learning_event               ◄── NEW (S5)
   ├── Append practice materials to WhatsApp summary                ◄── NEW (S5)
   ├── Send via AiSensy WhatsApp
   └── Synthesize learning_profile via Gemini → children            ◄── S4

8. PARENT VIEWS PRACTICE (Dashboard)
   app/parent/journey → "Practice This Week" section                ◄── NEW (S5)
   ├── Queries parent_practice_assigned events (last 7 days)
   ├── Displays content cards with type icons
   ├── On click: opens asset + POST /api/parent/content-viewed      ◄── NEW (S5)
   └── Tracks viewed_at per item in event_data

9. NEXT SESSION PREP (Loop closes)
   GET /api/coach/sessions/[id]/brief
   ├── learning_profile: updated by Gemini after last session       ◄── S4
   ├── parent_content_engagement: 3/4 viewed, 75% rate              ◄── NEW (S5)
   └── Coach sees full picture: child profile + parent engagement
```

### Gap Analysis

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| 1 | AiSensy template character limit | Low | Practice materials appended to summary; if total exceeds template var limit, AiSensy may truncate. Monitor first 10 sessions. |
| 2 | No dedicated practice reminder cron | Low | Parents see materials in WhatsApp summary and dashboard, but no follow-up nudge if they don't open. Future enhancement. |
| 3 | Game content excluded from parent practice | By design | Games require coach facilitation; only videos and worksheets sent to parents. |
| 4 | No content_viewed events (separate) | By design | Tracking is inline on the parent_practice_assigned event_data.items[].viewed_at rather than separate events. Simpler to query. |
| 5 | Untyped supabase client in enrollment-scheduler | Low | Uses `createClient()` without `<Database>` generic; query results cast with `as any`. Pre-existing tech debt from Session 3. |

---

## Session Manifest

### Files Modified (6)
| # | File | Changes |
|---|------|---------|
| 1 | `app/api/coach/sessions/[id]/parent-summary/route.ts` | Added content_ref extraction (step 5b), practice event creation (step 5c), WhatsApp practice section (step 5d) |
| 2 | `app/api/coach/sessions/[id]/brief/route.ts` | Added parent content engagement query (step 7b), included in response |
| 3 | `app/api/coach/sessions/[id]/live/route.ts` | Added parent content engagement query (step 8b), included in response |
| 4 | `app/parent/journey/page.tsx` | Added "Practice This Week" section with content cards and view tracking |
| 5 | `components/coach/live-session/InfoTab.tsx` | Added "Practice Materials" engagement indicator with color-coded progress bar |
| 6 | `components/coach/live-session/types.ts` | Added `ParentContentEngagement` interface, updated `LiveSessionData` |

### Files Created (1)
| File | Purpose |
|------|---------|
| `app/api/parent/content-viewed/route.ts` | Tracks parent content viewing, updates event_data with viewed_at |

### Database Changes
No new migrations required. All data stored in existing `learning_events` table using new event_type `parent_practice_assigned` with structured `event_data`.

### New Event Types
| Event Type | Created By | Consumed By |
|------------|-----------|-------------|
| `parent_practice_assigned` | parent-summary route (after session completion) | Parent journey page, brief route, live route |

### API Endpoints
| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/coach/sessions/[id]/parent-summary` | POST | Extracts content_refs, creates practice event, appends to WhatsApp |
| `/api/coach/sessions/[id]/brief` | GET | Returns `parent_content_engagement` metrics |
| `/api/coach/sessions/[id]/live` | GET | Returns `parent_content_engagement` metrics |
| `/api/parent/content-viewed` | POST | **NEW** — tracks content viewing |
| `/parent/journey` | Page | Added "Practice This Week" section |

### Build Status
- TypeScript compilation: PASS (0 errors)
- Next.js build: PASS (all routes compile)
