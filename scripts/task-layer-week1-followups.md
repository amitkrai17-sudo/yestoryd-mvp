# Task Layer Unification — Week 1 Follow-ups

**Context:** Migration `20260422140000_task_layer_unification.sql` adds retirement state, progress tracking, and eviction chain columns to `parent_daily_tasks`, and extends `learning_events.event_type` with `practice_in_progress` / `practice_abandoned`. Migration is schema-only — no consumer code reads or writes the new columns yet. The items below land the behavior changes.

**Ordering:** Items 1 & 2 can ship independently. Item 3 (index cleanup) must come **after** Item 1 (filters merged). Items 4–6 form a coherent writer-unification group that should ship as one PR.

---

## 1. CONSUMER UPDATES — add `is_retired = false` filter

Goal: switch the "active task" semantic from `is_completed = false` to `is_retired = false AND is_completed = false` at every read site. Retired tasks must stop appearing in active queries, pending counts, and backlog scans.

### Call sites (6 identified in Phase 0 grep)

| File:line | Current filter | Change |
|---|---|---|
| `lib/tasks/pending-count.ts:18-21` | `.eq('child_id', ?).eq('is_completed', false)` | Add `.eq('is_retired', false)` |
| `app/api/parent/tasks/[childId]/route.ts:69-78` | `.eq('child_id', ?).eq('is_completed', false)` + ORDER BY | Add `.eq('is_retired', false)` |
| `app/api/coach/sessions/[id]/complete/route.ts:245-248` | backlog `count: exact, head: true` | Add `.eq('is_retired', false)` |
| `app/api/coach/sessions/[id]/live/route.ts:233-236` | week-range + child filter | Add `.eq('is_retired', false)` |
| `app/api/coach/children/[id]/homework/route.ts` (3 call sites at 91, 393, 436) | homework list + counts | Add `.eq('is_retired', false)` to the active/unfinished variants; leave the full-history variant (line 91) unfiltered |
| `lib/homework/content-matcher.ts:116-120` | `.eq('child_id', ?).gte('task_date', cutoff)` (worksheet dedup) | Add `.eq('is_retired', false)` so retired tasks' worksheets are eligible for reuse |

### Verification after merge

```sql
-- No retired rows leaking into parent active-task API
SELECT COUNT(*) FROM parent_daily_tasks
WHERE is_retired = true AND is_completed = false;
-- Expected: N retired rows exist in DB but should NOT appear in /api/parent/tasks response
```

Manual QA: test one child with a retired task and confirm `/parent/dashboard` does not show it.

---

## 2. SORT ORDER FIX — parent active-tasks

**Location:** `app/api/parent/tasks/[childId]/route.ts:78`

**Current:** `.order('created_at', { ascending: false })` — ranks by insertion time only.

**Change to:** `.order('task_date', { ascending: false }).order('created_at', { ascending: false })` — ranks by display-date first, then by insertion time as tiebreaker.

**Rationale (Observation 1 from Phase 0):** reconciled / backdated tasks can have `task_date = CURRENT_DATE` but an old `created_at` — current ORDER BY `created_at DESC` would hide them. After fix, today-dated tasks consistently rank top regardless of when they were inserted.

**Index support:** `idx_task_active_per_child (child_id, task_date DESC)` (added by this migration) serves the new ordering once Item 1 has added the `is_retired = false` filter. Until then, falls back to a filesort on ~dozens of rows per child — acceptable.

---

## 3. INDEX CLEANUP (Week 2, after Item 1 lands)

**Location:** `supabase/migrations/20260429XXXXXX_child_active_index_retire_filter.sql`

**Change:**
```sql
DROP INDEX idx_parent_daily_tasks_child_active;
CREATE INDEX idx_parent_daily_tasks_child_active
  ON parent_daily_tasks (child_id, is_completed, created_at DESC)
  WHERE is_retired = false;
```

**Rationale (Observation 2 from Phase 0):** once every consumer filters `is_retired = false`, the old index wastes space indexing retired rows that no query reads. A partial index with the retirement filter cuts index size and speeds scans.

**Gate:** do NOT ship until Item 1 is fully merged. Pre-check before drop:
```
-- Grep for any remaining queries using is_completed=false without is_retired=false
```

---

## 4. `createTask()` unified writer (TASK-001 + TASK-002 + TASK-007)

**New file:** `lib/tasks/create-task.ts`

**Signature (draft):**
```ts
export async function createTask(params: {
  childId: string;
  enrollmentId?: string | null;
  sessionId?: string | null;
  title: string;           // TASK-007: caller supplies; distinguishable per-session
  description: string;
  coachNotes?: string;
  taskDate?: string;       // TASK-001: defaults to CURRENT_DATE (today), not session_date
  source: 'template_generated' | 'ai_recommended' | 'coach_assigned' | 'system' | 'parent_summary';
  durationMinutes?: number;
  contentItemId?: string | null;
  supabase: SupabaseClient;
}): Promise<{ taskId: string; evictedTaskIds: string[] }>;
```

**Behavior:**
- **Default `taskDate = today`** (TASK-001 fix) — stop propagating `capture.session_date` into `task_date`. Session linkage lives on `session_id` column.
- **Session-distinguishing title** (TASK-007 fix) — the orchestrator's current hardcoded `title = 'Practice Activity'` moves to the caller. Recommended pattern for coach-assigned tasks:
  ```ts
  title: `Practice Activity (${sessionId.slice(0, 6)})`
  ```
  or use session date/time-of-day suffix. This breaks the `(child_id, task_date, title)` UNIQUE collision observed in the 2026-04-22 reconciliation batch (Avani, both captures on Apr 18).
- **Cap of 3 active tasks per child** (TASK-002) — before insert, count active tasks (`is_retired=false AND is_completed=false`) for the child. If ≥ 3, auto-retire the oldest by `task_date ASC, created_at ASC` with `retirement_reason = 'evicted_for_newer'` and `evicted_for_task_id = <new task id>`. Return evicted IDs.
- **Emit `parent_practice_assigned` learning_event** for each new task (existing behavior).
- **Emit `practice_abandoned` learning_event** for each auto-evicted task (new, enabled by Part E of this migration).

---

## 5. Retirement cron — `app/api/cron/retire-stale-tasks`

**Schedule:** daily at 02:00 UTC (07:30 IST) via the dispatcher.

**Query:**
```sql
UPDATE parent_daily_tasks
SET is_retired = true,
    retired_at = NOW(),
    retirement_reason = 'age_expired'
WHERE created_at < NOW() - INTERVAL '7 days'
  AND is_completed = false
  AND is_retired = false
RETURNING id, child_id;
```

**Follow-up for each retired row:**
- Emit `learning_events` row with `event_type = 'practice_abandoned'` (enabled by Part E of this migration), `signal_source = 'system_generated'`, `signal_confidence = 'medium'`.
- Log aggregate count to `activity_log`.

**Observability:** admin daily health check (7 AM IST) counts yesterday's retirements and flags if > 20% of active tasks retired in a single run (indicates a dashboard outage, not normal churn).

**Threshold source of truth:** the `7 days` age threshold should live in `site_settings` key `task_retirement_age_days` (integer, default `7`). Read via `getSiteSetting()`. No hardcoding.

---

## 6. Per-writer migration — switch 6 `.insert()` callers to `createTask()`

Once Item 4 is merged, replace the direct `.from('parent_daily_tasks').insert({...})` calls with `createTask()`:

| File:line | Today | After |
|---|---|---|
| `app/api/jobs/post-capture-orchestrator/route.ts:167-182` | direct insert, hardcoded title + session_date | `createTask({ title: \`Practice Activity (\${sessionId.slice(0,6)})\`, taskDate: today, ... })` |
| `app/api/parent/tasks/[childId]/upload-photo/route.ts:139` | direct insert | `createTask({ source: 'parent_summary', ... })` |
| `lib/tasks/generate-daily-tasks.ts:732` | direct insert | `createTask({ source: 'template_generated', ... })` |
| `lib/homework/generate-smart-practice.ts:188` | **update only** (sets content_item_id) — leave as-is | no change |
| `app/api/coach/sessions/[id]/parent-summary/route.ts:373, 526` | direct insert | `createTask({ source: 'parent_summary', ... })` |
| `app/api/parent/artifacts/upload/route.ts:166, 224` | direct updates — leave as-is | no change |

After migration: grep should find zero `.from('parent_daily_tasks').insert(` outside `lib/tasks/create-task.ts`.

---

## Deferred / out of scope

- **Partial UNIQUE replacement** — rejected at Phase 0. Keep existing `(child_id, task_date, title)` UNIQUE; TASK-007's title-distinguishing pattern is the primary fix.
- **`is_in_progress` consumers** — schema column added by this migration but no UI wired up yet. Parent-UI "mark as started" button is a separate ticket.
- **Eviction chain traversal UI** — admin-only "see which task replaced this one" view, backed by `evicted_for_task_id`. Not part of Week 1.
