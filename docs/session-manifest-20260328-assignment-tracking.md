# Session Manifest: Assignment Tracking Unification
**Date:** 2026-03-28
**Scope:** Coaching + Tuition homework tracking end-to-end

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260328120000_extend_parent_daily_tasks.sql` | DB migration: session_id, photo_url, source CHECK update, practice_completed event type, indexes |

## Files Modified

| File | Change |
|------|--------|
| `lib/database.types.ts` | Regenerated — new columns visible (session_id, photo_url, source) |
| `lib/rai/learning-events.ts` | Added `practice_completed` to `LearningEventType` union |
| `lib/tasks/generate-daily-tasks.ts` | Added `session_id` and `source: 'template_generated'` to task INSERT |
| `app/api/cron/intelligence-practice-recommendations/route.ts` | Added `source: 'ai_recommended'` to all 3 INSERT points |
| `app/api/parent/tasks/[childId]/route.ts` | JOIN enrollments + sessions, return program_label/session context |
| `app/api/parent/tasks/[childId]/complete/route.ts` | Generate `practice_completed` learning_event on task completion (UIP B4 fix) |
| `app/api/coach/sessions/[id]/brief/route.ts` | Added homework_status query (section 7c), return in response |
| `app/parent/tasks/page.tsx` | Program badge (Coaching/Tuition), session number in weekly checklist |
| `app/coach/sessions/[id]/page.tsx` | Homework Status card with progress bar + pending list |
| `components/coach/PreSessionBrief.tsx` | Homework section in overview tab with progress + pending tasks |
| `docs/CURRENT-STATE.md` | Updated parent_daily_tasks column count (12 -> 15) |

## Database Changes

### parent_daily_tasks (extended)
| Column | Type | Notes |
|--------|------|-------|
| `session_id` | UUID FK -> scheduled_sessions | Nullable, SET NULL on delete |
| `photo_url` | TEXT | For physical homework photo verification |
| (existing) `source` | CHECK updated | Added `parent_summary` to allowed values |

### Indexes Added
| Index | Columns | Notes |
|-------|---------|-------|
| `idx_parent_daily_tasks_session` | session_id | Partial: WHERE session_id IS NOT NULL |
| `idx_parent_daily_tasks_child_active` | child_id, is_completed, created_at DESC | Composite for parent portal queries |

### learning_events (CHECK constraints updated)
| Constraint | Added Values |
|------------|-------------|
| `learning_events_event_type_check` | `practice_completed` |
| `chk_signal_source` | `parent_whatsapp`, `elearning` (sync TS -> DB) |
| `chk_session_modality` | `online_group` (sync TS -> DB) |

## What Was Verified

- Tuition sessions already create `parent_daily_tasks` via shared complete route (no gate on billing_model)
- `enrollment_id` already existed on `parent_daily_tasks` (populated by generate-daily-tasks.ts)
- `source` column already existed with CHECK (template_generated, ai_recommended, coach_assigned, system)
- Task completion had ZERO intelligence signal generation (confirmed UIP B4 gap)
- `practice_completed` was missing from both DB CHECK and TS type
- TypeScript builds clean (only pre-existing errors in database.types.ts line 1 noise, test vitest imports, and layout type)

## What Was Assumed

- `insertLearningEvent()` handles embedding generation automatically (verified from its source)
- `signalConfidence: 'low'` is appropriate for parent self-report of task completion
- Coach pre-session brief modal receives `homework_status` via the session data prop (the modal is opened from a page that passes session data — the `homework_status` field needs to be forwarded from the brief API through whatever data-loading layer populates the PreSessionBrief props)

## Known Issues / Next Steps (NOT in scope)

| Item | Priority | Notes |
|------|----------|-------|
| Photo upload UI on parent task completion | P2 | Needs Supabase Storage bucket setup for `homework-photos` |
| Practice reminder nudge cron (48h overdue -> WA nudge) | P2 | New dispatcher entry, AiSensy template needed |
| Parent task streak tracking in UIP | P3 | `practice_completed` events now exist, UIP refresh can aggregate |
| `content_viewed` -> learning_event generation | P3 | Separate concern, not tied to assignments |
| PreSessionBrief homework_status prop wiring | P1 | The modal receives a `Session` interface — the page that opens it needs to pass `homework_status` from the brief API response into the session prop |
