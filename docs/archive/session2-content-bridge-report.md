# Session 2: Content Bridge Report

## Date: 2026-02-11

## Objective
Extend the coaching system to link session templates to actual content assets from `el_*` tables, enabling coaches to see exactly which videos, games, and worksheets to use during each activity step.

---

## Pre-Implementation Verification Scan

Before writing any code, we audited the codebase for existing implementations:

| Check | Finding |
|-------|---------|
| `content_refs` in codebase | **Not found** — no prior implementation |
| `ActivityStep` structure | Only `{time, activity, purpose}` — no content linking fields |
| Template auto-assignment | `session_template_id` FK exists on `scheduled_sessions` but **never populated** |
| `season_learning_plans` usage | Table defined but **never queried** in enrollment flow |
| Content picker in admin | Template editor is **text-only** — no asset browser |
| `el_worksheets` data | Table exists (from Session 1), **0 rows** |
| `coach_guidance` column | Exists on `el_learning_units`, all values **NULL** |

---

## Tasks Completed

### Task 1: Extend ActivityStep Types (Backward Compatible)

**Files modified:**
- `components/coach/live-session/types.ts`
- `app/admin/templates/[id]/page.tsx`

**Changes:**
- Added `ContentRef` interface: `{ type: 'video' | 'game' | 'worksheet', id: string, label: string }`
- Extended `ActivityStep` with optional V2 fields:
  - `activity_id` — unique within template (e.g. `"act_01"`)
  - `activity_name` — structured name (fallback to `activity`)
  - `planned_duration_minutes` — numeric duration
  - `content_refs` — array of linked `el_*` content assets
  - `is_required` — whether step must be completed
  - `coach_can_substitute` — whether similar content is acceptable
- Added `getActivityDisplayName()` helper function
- All new fields are **optional** — legacy templates with `{time, activity, purpose}` continue to work unchanged

**Backward compatibility proof:** The `LiveSessionPanel.tsx` spreads `...step` into `TrackedActivity`, so new optional fields propagate automatically. Existing renderers only access `time`, `activity`, `purpose`.

---

### Task 2: Wire Template Auto-Assignment in Enrollment Scheduler

**File modified:** `lib/scheduling/enrollment-scheduler.ts`

**Changes:**
- Added Step 5.5 in both `scheduleEnrollmentSessions()` and `createSessionsSimple()`
- After sessions are created, queries `season_learning_plans` for matching `child_id + week_number`
- Maps `session_template_id` from learning plans to `scheduled_sessions`
- Non-blocking: wrapped in try-catch, logs errors but doesn't fail enrollment
- Only processes `coaching` session types (skips diagnostic, celebration, etc.)

**Flow:**
```
Enrollment → Create sessions → Query season_learning_plans →
  For each plan with session_template_id:
    UPDATE scheduled_sessions SET session_template_id = ?
    WHERE enrollment_id = ? AND session_number = ?
```

---

### Task 3: Content Picker for Admin Template Editor

**Files modified:**
- `app/admin/templates/[id]/page.tsx` — UI with content picker modal
- `app/api/admin/content-search/route.ts` — Search API (created)

**Content Search API (`/api/admin/content-search`):**
- Query params: `q` (text), `skill` (skill_id), `age_band` (foundation/building/mastery), `limit` (max 50)
- Queries `el_learning_units` with `el_skills` join
- Fetches linked `el_videos`, `el_worksheets`, `el_game_content` in parallel
- Groups content by unit/skill and returns enriched results
- Tested: returns existing units successfully

**Content Picker UI:**
- Each activity step row now has a "Link Content" button (chain icon)
- Opens a modal with:
  - Text search input
  - Auto-filters by template's `age_band`
  - Results show learning units with collapsible content sections
  - Videos (blue), games (purple), worksheets (green) each have click-to-add buttons
  - "Added" state shown for already-linked content
- Selected content displayed as color-coded chips under each activity row
- Chips show type icon + label + remove button

---

### Task 4: Seed Test Data

**File created:** `supabase/migrations/20260211_seed_content_bridge.sql`

**Seeded data:**

| Table | Count | Details |
|-------|-------|---------|
| `el_skills` | 5 | phonemic_awareness, phonics, fluency, vocabulary, comprehension |
| `el_learning_units` | 5 | With coach_guidance JSONB, parent_instruction, content_code |
| `el_videos` | 3 | 2 for phonemic_awareness, 1 for phonics |
| `el_worksheets` | 2 | Linked to rhyming pairs and letter-sound mapping units |

**Template update:** First active foundation `session_template` updated with V2 `activity_flow` containing `content_refs` pointing to seeded videos and worksheets.

All inserts use `ON CONFLICT (id) DO NOTHING` for idempotency.

---

## Session Manifest

### Files Created (2)
| File | Purpose |
|------|---------|
| `app/api/admin/content-search/route.ts` | Content search API for admin picker |
| `supabase/migrations/20260211_seed_content_bridge.sql` | Seed data migration |

### Files Modified (3)
| File | Changes |
|------|---------|
| `components/coach/live-session/types.ts` | Added ContentRef, extended ActivityStep with V2 fields |
| `app/admin/templates/[id]/page.tsx` | Content picker modal + content_refs chips UI |
| `lib/scheduling/enrollment-scheduler.ts` | Template auto-assignment via season_learning_plans |

### Database Changes
- **No schema changes** — all columns already exist from Session 1 consolidation
- **Seed data** — 5 skills, 5 units, 3 videos, 2 worksheets, 1 template activity_flow update

### API Endpoints
| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/admin/content-search` | GET | New - verified working |

---

## Architecture Decisions

1. **Content linking via JSONB, not FK:** `content_refs` is stored inline in `activity_flow` JSONB rather than a junction table. This keeps the template self-contained and avoids complex joins during session load.

2. **Skill-based video grouping:** Videos are linked to skills, not units. The content picker groups videos by skill through the unit's `skill_id`. This means a video shared across multiple units in the same skill appears once.

3. **Non-blocking template assignment:** The enrollment scheduler's template lookup is wrapped in try-catch. If `season_learning_plans` is empty or the query fails, sessions are still created — they just won't have templates pre-assigned.

4. **Backward-compatible types:** All V2 fields are optional TypeScript fields. The `getActivityDisplayName()` helper gracefully falls back to the legacy `activity` field.

---

## Remaining Work

- [ ] Apply seed migration to production database
- [ ] Populate `season_learning_plans` with actual curriculum mapping
- [ ] Add more content to `el_worksheets` and `el_videos` tables
- [ ] Companion Panel: render `content_refs` as clickable links during live session
- [ ] Parent summary: include `parent_instruction` from linked `el_learning_units`
