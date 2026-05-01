# PR 7 — Week 5b Deferred Implementation

Phase 7 Policy Change 5 was scope-revised mid-week. Week 5 (this commit)
ships ONLY the `communication_templates` row for `parent_weekly_summary_v1`
(inserted directly via Supabase MCP, no migration file — same pattern as
the Week 3 `task_max_pending` site_settings write). The cron route,
dispatcher entry, and live activation defer to Week 5b.

## Why we split

1. **AiSensy campaign for `parent_weekly_summary_v1` must exist before the
   route activates.** Rucha owns the WhatsApp body copy and the Meta
   template submission. Until both are done, the row stays
   `is_active: false` and any `sendNotification('parent_weekly_summary_v1', …)`
   call returns `template_disabled` without sending.

2. **Cron route is untested in production until first Sunday after deploy.**
   Splitting allows manual `sendNotification()` verification from a dev
   console / test page before letting the cron own the send loop. Catches
   payload-shape mismatches and missing-param failures one parent at a time
   instead of fanning out across all enrolled children at once.

3. **Email leg deferred to V2 pending engagement data.** The row currently
   has `use_email: false` and `email_subject` / `email_body_html` are NULL.
   When/if engagement data shows email is needed, V2 adds the email leg and
   bumps the row to `parent_weekly_summary_v2` (or in-place if no shape
   change is needed).

## Pre-conditions before Week 5b ships

- [ ] AiSensy campaign `parent_weekly_summary_v1` created with body matching
      `wa_variables` order:
      `[child_first_name, week_label, tasks_completed_count, tasks_total_count, sessions_count, coach_first_name]`.
- [ ] Meta approves the campaign (24–48h cycle per CLAUDE.md WA gotchas).
- [ ] Manual `sendNotification('parent_weekly_summary_v1', <test_parent_id>, <test_params>)`
      from a dev console returns `success: true`.
- [ ] SQL flip:
      `UPDATE communication_templates SET is_active = true WHERE template_code = 'parent_weekly_summary_v1';`

## Then Week 5b ships

- `app/api/cron/parent-weekly-summary/route.ts`:
  - Auth via `verifyCronRequest()`.
  - Sunday-only guard (mirror Week 2's weekend-skip pattern, inverted —
    `if (istDay !== 0) return skip;`). Logs
    `parent_weekly_summary_non_sunday_skip` to `activity_log` on non-Sunday
    invocations.
  - Iterate active enrollments. For each child:
    - Inline 3-SQL aggregation: `parent_daily_tasks` (completed/total this
      week), `learning_events` where `event_type = 'practice_completed'`
      (difficulty mix), `scheduled_sessions` where `status = 'completed'`
      and `scheduled_date` in window (session count).
    - Skip silently if zero activity (no tasks completed, no sessions
      attended) — log skip count to summary, no per-child activity_log row.
    - Build named params: `parent_name`, `child_name`, `week_label`
      (e.g. "Apr 24–Apr 30"), `tasks_completed_count` (string-coerced),
      `tasks_total_count`, `sessions_count`, `coach_name`.
    - Call `sendNotification('parent_weekly_summary_v1', parent.id, namedParams,
      { triggeredBy: 'cron', contextType: 'weekly_summary', contextId: <weekStart-yyyy-mm-dd> })`.
  - End-of-run summary `activity_log` row:
    `parent_weekly_summary_complete` with
    `{ children_processed, sends_attempted, sends_succeeded, skipped_zero_activity, errors }`.

- `app/api/cron/dispatcher/route.ts`:
  - Add entry:
    `{ name: 'parent-weekly-summary', path: '/api/cron/parent-weekly-summary',
      schedule: { type: 'daily', istHour: 20, istMinute: 0 }, method: 'GET',
      description: 'Sunday-only weekly digest to parents (Mon–Sun summary)' }`.
  - 19:00 IST is held by `practice-nudge` (Week 1). 20:00 IST chosen — after
    dinner, before WA quiet hour starts at 21:00 IST.

- Activity-log shape EXACTLY matches Week 2's weekend-skip pattern
  (`fdc12896`) for consistent observability.

## Inserted row reference (for 5b grounding)

```
template_code:           parent_weekly_summary_v1
name:                    Weekly Summary
recipient_type:          parent
channel:                 aisensy
wa_template_name:        parent_weekly_summary_v1
use_whatsapp:            true
use_email:               false   (deferred to V2)
is_active:               false   (AiSensy 2-step deploy — flip after approval)
meta_category:           utility
cost_per_send:           0.50
trigger_contexts:        ['cron_weekly_summary']

required_variables (canonical, caller passes these):
  [parent_name, child_name, week_label, tasks_completed_count,
   tasks_total_count, sessions_count, coach_name]

wa_variables (post-derivation, AiSensy positional order):
  [child_first_name, week_label, tasks_completed_count,
   tasks_total_count, sessions_count, coach_first_name]

wa_variable_derivations:
  {
    "child_first_name": { "source": "child_name", "transform": "first_word" },
    "coach_first_name": { "source": "coach_name", "transform": "first_word" }
  }
```

## Open implementation notes for 5b

a. **Numeric variables string-coerced before sendNotification call.**
   `tasks_completed_count`, `tasks_total_count`, `sessions_count` are passed
   as strings per `sendNotification`'s `Record<string, string>` contract.
   Cron must coerce: `String(count)` before passing. Do NOT pass raw
   numbers — TypeScript will reject and runtime will silently stringify
   inconsistently.

b. **Validator empty-string handling for "0" or null counts (verify in 5b).**
   `lib/communication/validate-notification.ts` runs Rule 1 (missing params)
   against `wa_variables`. Need to confirm `"0"` is treated as present
   (string of length > 0) and not as missing. If empty-string fails Rule 1
   for genuinely-zero weeks, the cron must substitute a non-empty literal
   ("none", "0", or skip the child entirely under the zero-activity rule).
   Verify in 5b before activation.

c. **Coach handling when coach_name is null (decide before 5b).**
   Some children may not have a coach assigned (mid-season reassignment,
   pre-onboarding, etc.). `required_variables` includes `coach_name`, so
   missing it fails Rule 1. Two options to choose between in 5b:
     - Skip the child for V1 (cleanest, no coach name → no digest).
     - Substitute `"your coach"` literal — appears verbatim in the WA body
       via the `coach_first_name` derivation (`"your coach".split(' ')[0]`
       → `"your"`, which reads weird).
   First option recommended; document the policy choice in the route's
   top-of-file comment.

d. **Week label format "MMM D–MMM D" suggested.**
   E.g. `"Apr 24–Apr 30"` via `formatDate()` from `lib/utils/date-format.ts`.
   Confirm the en-dash vs. hyphen choice and test rendering on AiSensy +
   parent device locales before 5b ships. Avoid `formatDateRelative()` here
   — relative dates in a once-a-week recap age confusingly.

e. **meta_category resolved to 'utility'.**
   Closed during Week 5 audit. The new row uses `meta_category: 'utility'`
   matching existing taxonomy. No new category was created — `weekly_communication`
   was the working name during audit and was rejected before insert.
