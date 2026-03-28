# Session Manifest: Assignment Tracking Phase 2
**Date:** 2026-03-28
**Scope:** Photo upload, PreSessionBrief wiring, practice nudge cron

---

## Files Created

| File | Purpose |
|------|---------|
| `app/api/parent/tasks/[childId]/upload-photo/route.ts` | Photo upload API: multipart form → Supabase Storage → update task photo_url |
| `app/api/cron/practice-nudge/route.ts` | Daily cron: nudge parents with overdue tasks (48h+), max 1 nudge per 48h |

## Files Modified

| File | Change |
|------|--------|
| `components/coach/PreSessionBrief.tsx` | Fetches homework_status from brief API on mount when not provided via props; resolves prop vs fetched data |
| `app/parent/tasks/page.tsx` | Photo completion bottom sheet: camera capture + "done without photo" option; photo preview + upload progress |
| `app/api/parent/tasks/[childId]/complete/route.ts` | Re-fetches photo_url before learning_event; includes has_photo, photo_url in event_data; photo bumps confidence to 'medium' |
| `app/api/coach/sessions/[id]/brief/route.ts` | Generates signed URLs for homework items with photo_url |
| `app/coach/sessions/[id]/page.tsx` | "Completed with Photos" section showing thumbnail gallery in homework status card |
| `app/api/cron/dispatcher/route.ts` | Added practice-nudge job at 10:00 AM IST |

## Database Changes

| Change | Details |
|--------|---------|
| `communication_templates` row | `practice_nudge` template seeded: WA + email, 4 variables, send window 09:00-20:00 IST |

## Storage

- Uses existing `child-artifacts` Supabase Storage bucket (admin client, no RLS needed)
- Photo path convention: `homework/{childId}/{taskId}.{ext}`
- Signed URLs (1h expiry) generated server-side for coach viewing

## What Was Verified

- PreSessionBrief modal on sessions LIST page had no homework_status data (different data source than brief API)
- `artifact-storage.ts` pattern: admin client upload, no RLS, sharp processing — reused bucket without sharp (homework photos don't need processing for v1)
- Dispatcher Job type matches: `{ type: 'daily', istHour: 10, istMinute: 0 }`
- `verifyCronRequest()` returns `isValid` (not `valid`)
- `communication_templates.required_variables` is PostgreSQL ARRAY type (not JSON)
- TypeScript builds clean
- Post-change verification: zero hardcoded phones/emails/Gemini instances

## What Was Assumed

- `child-artifacts` bucket already exists in Supabase Storage (verified by existing artifact-storage.ts code)
- `communication_logs` table has `template_code` and `recipient_id` columns for dedup check (used by other crons)
- AiSensy `practice_nudge` template needs Meta approval before WhatsApp delivery works; email via Resend works immediately
- HEIC images are stored as-is without conversion (acceptable for v1)

## AiSensy Template (Ready for Submission)

**Template name:** `practice_nudge`
**Category:** UTILITY

```
Hi {{1}},

{{2}} has {{3}} practice task(s) waiting to be completed.

Regular practice between sessions is what makes the real difference in reading improvement!

Open tasks: {{4}}

Tap here to mark them done: https://yestoryd.com/parent/tasks

Team Yestoryd
```

Variables: {{1}}=parent_name, {{2}}=child_name, {{3}}=pending_count, {{4}}=task_list

**Status:** Template seeded in DB. Pending Meta/AiSensy approval for WhatsApp delivery.

## Known Issues / Next Steps

| Item | Priority | Notes |
|------|----------|-------|
| Sharp image processing for homework photos | P3 | Could add thumbnail generation like artifact-storage for coach brief performance |
| Photo lightbox in coach brief | P3 | Currently opens in new tab; could add inline modal |
| Submit AiSensy template to Meta | P1 | Required for WhatsApp delivery; email fallback works now |
| Homework photo in parent task list | P3 | Show small thumbnail next to completed tasks in parent view |
