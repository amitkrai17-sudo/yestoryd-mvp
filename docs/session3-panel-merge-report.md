# Session 3: Companion Panel Content Display + Data Stream Merge

## Date: 2026-02-11

## Objective
1. Display resolved content assets in the Coach Companion Panel during live sessions
2. Merge Companion Panel (coach-logged) and Recall.ai (AI-transcribed) data streams into unified learning events

---

## Pre-Implementation Verification Scan

| Check | Finding |
|-------|---------|
| `ResolvedContent` type in codebase | **Not found** — no prior implementation |
| Content resolution in live route | **Not found** — template returned raw, no content_refs resolution |
| `content_refs` rendering in ActivityTab | **Not found** — renders only text labels |
| Session Materials in InfoTab | **Not found** — only materials_needed text tags |
| Merge logic in activity-log POST | **Not found** — always creates new session_companion_log |
| Merge logic in process-session job | **Not found** — always creates new session event |
| TODO in recall webhook (line 586) | **Found** — acknowledged merge need |

---

## Task 1: Companion Panel Content Display

### types.ts Changes

Added `ResolvedContent` interface with full asset details:
```typescript
interface ResolvedContent {
  type: 'video' | 'game' | 'worksheet';
  id: string;
  label: string;
  title: string;
  thumbnail_url: string | null;
  asset_url: string | null;
  asset_format: string | null;
  duration_seconds: number | null;
  coach_guidance: Record<string, any> | null;
}
```

Extended `TrackedActivity` with `resolved_content?: ResolvedContent[]` and `LiveSessionData` with `resolved_content?: Record<number, ResolvedContent[]>`.

### live/route.ts Changes

After loading the session template, the route now:
1. Collects all `content_ref` IDs from `activity_flow`, grouped by type (video/game/worksheet)
2. Fetches asset details from `el_videos`, `el_game_content`, `el_worksheets` in parallel
3. Fetches `coach_guidance` from parent `el_learning_units` (by skill_id for videos/games, by unit_id for worksheets)
4. Returns `resolved_content` map keyed by activity index

Non-blocking: entire resolution wrapped in try-catch. Old templates return `resolved_content: {}`.

### ActivityTab.tsx Changes

New `ContentCard` component renders under the current activity hero:
- Type icon (Film/Gamepad2/FileText) with color coding (blue/purple/emerald)
- Title, duration (videos), format (worksheets)
- "Open" button → opens `asset_url` in new tab
- Collapsible "Coach Guidance" section showing structured guidance from `el_learning_units`

Only renders when `current?.resolved_content?.length > 0` — old templates show text labels only.

### InfoTab.tsx Changes

New "Session Materials" section below "Areas to Revisit":
- Lists ALL content items across ALL activities for pre-review
- Each item shows: type icon, title, activity number, duration/format
- Quick-open link (ExternalLink icon) for each item with an asset_url

Only renders when resolved content exists.

### LiveSessionPanel.tsx Changes

Activity initialization now injects `resolved_content: data.resolved_content?.[i]` into each `TrackedActivity`. Optional chaining protects old data.

---

## Task 2: Data Stream Merge

### Merge Architecture

Two parallel data streams create `learning_events` entries:
- **Companion Panel** → `event_type: 'session_companion_log'`
- **Recall.ai** → `event_type: 'session'`

Both now check for the other's existing event and merge instead of creating duplicates.

### Scenario A: Companion Panel First

**File:** `app/api/jobs/process-session/route.ts`

When the `saveSessionData` function runs, it now:
1. Queries `learning_events` for existing `session_companion_log` with matching `session_id`
2. If found: **merges** transcript analysis data into the existing event, upgrades `event_type` to `'session'`, adds `ai_summary` and `embedding`
3. If not found: creates new `session` event as before

Merged event contains both companion data (activities, status_counts, coach_notes) AND transcript analysis (focus_area, skills, engagement, key_observations).

### Scenario B: Recall.ai First

**File:** `app/api/coach/sessions/[id]/activity-log/route.ts`

When the activity log POST runs, it now:
1. Queries `learning_events` for existing `session` event with matching `session_id`
2. If found: **merges** companion data into the existing event, adds `activity_statuses`, `companion_activities`, `companion_notes`
3. If not found: creates new `session_companion_log` as before

### Fallback Safety

Both merge paths have try-catch fallbacks that create the old event type if the merge query fails. Existing behavior is fully preserved as a safety net.

### Recall Webhook TODO

Replaced the TODO comment at `app/api/webhooks/recall/route.ts:586` with a DONE comment referencing the implementation in `process-session/route.ts`.

---

## Task 3: Verification

### Backward Compatibility (All 7 Files Verified)

| File | Status | Guard |
|------|--------|-------|
| `types.ts` | OK | All new fields are `?` optional |
| `ActivityTab.tsx` | OK | `current?.resolved_content?.length > 0` |
| `InfoTab.tsx` | OK | `allContent.length > 0` |
| `LiveSessionPanel.tsx` | OK | `data.resolved_content?.[i]` optional chaining |
| `live/route.ts` | OK | `resolvedContentMap` defaults to `{}`, try-catch wrapped |
| `activity-log/route.ts` | OK | Try-catch fallback creates old `session_companion_log` |
| `process-session/route.ts` | OK | Try-catch fallback creates old `session` event |

### Struggle Flags

Untouched. Step 4 (struggle flag creation) in `activity-log/route.ts` runs independently of the merge logic in step 3. Verified by grep.

### TypeScript Compilation

- 0 errors introduced by Session 3 (fixed `Set` spread issues in `live/route.ts` and `content-search/route.ts`)
- Pre-existing: 3 errors in `__tests__/coach-journey.test.ts`, 8 in `enrollment-scheduler.ts` (Supabase strict typing on new columns)

### Dev Server

All routes compile and respond correctly:
- `GET /api/coach/sessions/[id]/live` → 401 (auth required, compiled OK)
- `GET /api/coach/sessions/[id]/activity-log` → 405 (POST only, compiled OK)
- `GET /api/jobs/process-session` → 200 (health check, compiled OK)
- `GET /api/admin/content-search` → 200 (returns data, compiled OK)

---

## Session Manifest

### Files Modified (7)
| # | File | Changes |
|---|------|---------|
| 1 | `components/coach/live-session/types.ts` | Added ResolvedContent interface, extended TrackedActivity + LiveSessionData |
| 2 | `app/api/coach/sessions/[id]/live/route.ts` | Content_refs resolution → el_* asset lookup + coach_guidance fetch |
| 3 | `components/coach/live-session/ActivityTab.tsx` | ContentCard component, coach guidance collapsible, content rendering |
| 4 | `components/coach/live-session/InfoTab.tsx` | "Session Materials" pre-review section |
| 5 | `components/coach/live-session/LiveSessionPanel.tsx` | Inject resolved_content into TrackedActivity |
| 6 | `app/api/coach/sessions/[id]/activity-log/route.ts` | Data stream merge (Scenario B: Recall first) |
| 7 | `app/api/jobs/process-session/route.ts` | Data stream merge (Scenario A: Companion first) |

### Files Patched (2)
| File | Fix |
|------|-----|
| `app/api/webhooks/recall/route.ts` | Updated TODO → DONE comment at line 586 |
| `app/api/admin/content-search/route.ts` | Fixed `Set` spread for TS strict mode |

### Files Created (1)
| File | Purpose |
|------|---------|
| `docs/session3-panel-merge-report.md` | This report |

### Database Changes
- **None** — no schema changes or migrations needed

### API Endpoints Modified
| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/coach/sessions/[id]/live` | GET | Returns `resolved_content` map |
| `/api/coach/sessions/[id]/activity-log` | POST | Merges into existing Recall event if present |
| `/api/jobs/process-session` | POST | Merges into existing companion event if present |

---

## Architecture: Unified Learning Event

After merge, a unified learning_event contains:

```json
{
  "event_type": "session",
  "event_data": {
    // From Companion Panel
    "session_id": "uuid",
    "session_number": 3,
    "activities": [...],
    "status_counts": { "completed": 3, "partial": 1 },
    "session_elapsed_seconds": 1800,
    "coach_notes": "Great session!",

    // From Recall.ai Transcript Analysis
    "focus_area": "phonics",
    "skills_worked_on": ["phonemic_awareness", "fluency"],
    "progress_rating": "improved",
    "engagement_level": "high",
    "key_observations": [...],
    "coach_talk_ratio": 40,
    "child_reading_samples": [...],

    // Merge metadata
    "companion_merged_at": "2026-02-11T...",  // OR
    "transcript_merged_at": "2026-02-11T..."
  }
}
```

---

## Remaining Work

- [ ] Apply seed migration from Session 2 to populate test content
- [ ] Test end-to-end with a real coaching session (V2 template + Recall recording)
- [ ] Add content_refs rendering to pre-session brief route
- [ ] Include parent_instruction from el_learning_units in parent summary generation
- [ ] Adherence scoring: compare activity_flow (planned) vs session_activity_log (actual)
