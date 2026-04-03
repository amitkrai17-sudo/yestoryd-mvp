# Session Manifest — Unified Capture + Batch Scheduling

**Date:** 2026-04-03 / 2026-04-04
**Model:** Claude Opus 4.6 (1M context)

---

## Phases Completed

### Phase 0: Verification (read-only)
- Mapped legacy coaching offline report vs structured capture
- Identified 7 data fields unique to legacy form (voice note, activity tracking, adherence score, session timing, reading clip, unplanned activities, text fallback)
- Catalogued all CHECK constraints on learning_events, scheduled_sessions, structured_capture_responses, tuition_onboarding
- Identified session_modality overwrite bug in complete/route.ts

### Phase 1: Database Migration
- **Migration:** `supabase/migrations/20260404_unified_capture_batch_scheduling.sql`
- Added `batch_id UUID`, `meet_link TEXT`, `calendar_event_id TEXT` to `tuition_onboarding`
- Added `batch_id UUID` to `scheduled_sessions`
- Created partial indexes on both tables
- Backfilled 20 existing tuition_onboarding records with unique batch_ids
- Applied to production via Supabase MCP

### Phase 2: Coaching Offline → Structured Capture
- Unified all 6 session completion permutations to StructuredCaptureForm
- Fixed session_modality overwrite: no longer stamps `'tuition'` — derives from actual `session_mode`/`google_meet_link`
- Deprecated legacy report form (comments only, files preserved)

### Phase 3: Batch Scheduling Engine
- Admin batch assignment dropdown on tuition page
- Batches API endpoint for dropdown data
- Create tuition API accepts batch_id, copies meet_link from siblings
- scheduleTuitionSessions sets batch_id + copies persistent classroom link to sessions

### Phase 4: Recall.ai + Process-Session Fan-Out
- One Recall bot per batch per datetime (dedup by batch_id:date:time)
- Transcript fan-out: creates learning events for all sibling children in batch
- Fan-out events get `signalConfidence: 'medium'` (shared transcript)

### Phase 5: Reschedule Batch Awareness
- Batch reschedule moves all sibling sessions at same datetime
- All parents in batch notified
- Cancel stays per-child (doesn't affect batch)
- Mode switch stays per-session (no batch propagation)

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260404_unified_capture_batch_scheduling.sql` | batch_id + meet_link + calendar_event_id columns |
| `app/api/admin/tuition/batches/route.ts` | GET batches for admin dropdown |

## Files Modified

| File | Phase | Change |
|------|-------|--------|
| `components/coach/SessionCard.tsx` | 2 | All offline Report buttons → StructuredCaptureForm. Removed Link import. |
| `app/api/coach/sessions/[id]/complete/route.ts` | 2 | session_modality from actual delivery mode, not enrollment type |
| `app/admin/tuition/page.tsx` | 3 | Batch dropdown in form, fetches /api/admin/tuition/batches |
| `app/api/admin/tuition/create/route.ts` | 3 | Accepts batchId, copies meet_link from siblings |
| `lib/scheduling/enrollment-scheduler.ts` | 3 | scheduleTuitionSessions sets batch_id + google_meet_link on sessions |
| `lib/recall-auto-bot.ts` | 4 | Batch dedup for Recall bot scheduling |
| `app/api/jobs/process-session/route.ts` | 4 | Batch fan-out — learning events for all sibling children |
| `app/api/sessions/change-request/[id]/approve/route.ts` | 5 | Batch reschedule moves all siblings + notifies parents |
| `lib/database.types.ts` | Post | Regenerated with new columns |

## Files Deprecated (not deleted)

| File | Reason |
|------|--------|
| `app/api/coach/sessions/[id]/offline-report/route.ts` | All completion via StructuredCaptureForm now |
| `app/coach/sessions/[id]/report/page.tsx` | Legacy offline report form — no UI links to it |

---

## Migrations Applied to Production

| Migration | Method | Status |
|-----------|--------|--------|
| `20260404_unified_capture_batch_scheduling.sql` | Supabase MCP `apply_migration` | Applied |

## Types Regenerated

```
npx supabase gen types typescript --project-id agnfzrkrpuwmtjulbbpd
```
- Confirmed: `batch_id`, `meet_link`, `calendar_event_id` present in tuition_onboarding types
- Confirmed: `batch_id` present in scheduled_sessions types
- Fixed: removed npm warning line from generated output

---

## Verification Matrix

| # | Permutation | Completion UI | Event Type | Recall.ai | Batch-Aware |
|---|---|---|---|---|---|
| 1 | Coaching 1:1 Online | StructuredCaptureForm | structured_capture | Yes | No |
| 2 | Coaching 1:1 Offline | StructuredCaptureForm | structured_capture | No | No |
| 3 | Tuition 1:1 Online | StructuredCaptureForm | structured_capture | Yes | Yes (solo) |
| 4 | Tuition 1:1 Offline | StructuredCaptureForm | structured_capture | No | Yes (solo) |
| 5 | Tuition 1:many Online | StructuredCaptureForm | structured_capture | Yes (1 bot) | Yes |
| 6 | Tuition 1:many Offline | StructuredCaptureForm | structured_capture | No | Yes |

---

## Remaining Items (Follow-Up Prompts)

1. **Recurring Calendar Event on First Batch Payment** — enrollment-complete creates recurring event, stores meet_link on all batch siblings, adds new children as attendees
2. **Gemini Batch Transcript Analysis** — batch-aware prompt with per_child_observations, child-specific embeddings
3. **Coach Voice Note on Structured Capture** — optional audio recording on observations card, upload to storage, column on structured_capture_responses

---

## Column Name Convention

- `tuition_onboarding.meet_link` / `.calendar_event_id` — persistent classroom (batch-level)
- `scheduled_sessions.google_meet_link` / `.google_event_id` — per-session copy
- Code comments at copy points: `// Copy persistent classroom link to session`
