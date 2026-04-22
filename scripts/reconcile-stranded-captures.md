# Stranded-Capture Reconciliation — Post-B1 Republish Batch

**Generated:** 2026-04-21 (after B1 fix commit `b9327fec`)
**Scheduled execution:** 2026-04-22 ~08:30 IST
**Delivery path:** Email-only accepted (P22 WhatsApp template params broken — separate L2 ticket)
**Dedup strategy:** Option C — pick later capture per `(session_id)` pair; prefer one with `content_item_id` populated

## Selection Rules Applied

For each `session_id` with multiple stranded captures:

1. **Rule 1 (both rows match):** If both rows have same `content_item_id` AND same `homework_description` → pick later `created_at`.
2. **Rule 2 (content differs):** If `content_item_id` differs → pick the row with `content_item_id` populated.
3. **Rule 3 (description differs):** If `content_item_id` same but `homework_description` differs → pick later `created_at` (assumed final).

All 7 duplicate pairs in this batch fell under **Rule 1** (identical `content_item_id` + `homework_description` within each pair). No Rule 2/3 tiebreaks were needed.

## The 12 Captures

Ordered by `created_at`. The first row (Ira Rai) was already republished as the single-capture B1 verification on 2026-04-21 14:45 UTC — **SKIP on tomorrow's batch execution (republish count = 11).**

| # | captureId | sessionId | childName | content_item_id | created_at (UTC) | pick_reason | status |
|---|---|---|---|---|---|---|---|
| 1 | `b866bb10-cc92-4b61-8cc6-a084fd373aa3` | `71542160-14f2-4292-bbf3-bea29a541cc6` | Ira Rai | ✅ `d0064a4a` | 2026-04-14 16:14:25 | unique | **ALREADY REPUBLISHED 2026-04-21 14:45 UTC — SKIP** |
| 2 | `08f24312-cd8d-458b-93cf-9d0db9ee3916` | `4be4ecee-19eb-448e-94df-556300c199fa` | Harshi Mandar Sohoni | — | 2026-04-15 05:15:10 | unique (no content attached) | PENDING |
| 3 | `4db9f6af-fa77-4f9e-a5c1-39d0f6468d57` | `991a96ab-c02a-454b-adeb-df625209f477` | Shivaay Vavia | ✅ `229da7aa` | 2026-04-16 16:10:45 | later-of-pair (Rule 1) | PENDING |
| 4 | `57f97b1e-f44e-450d-b783-3cfae7ecb2a9` | `0936f3cd-0b56-42b0-83a8-9c027fca4675` | Shloka Vavia | ✅ `9d5c53b8` | 2026-04-16 16:18:16 | later-of-pair (Rule 1) | PENDING |
| 5 | `2f8a36c0-b8de-438a-ad01-962c2a323762` | `5a8e574d-50c6-4dad-82f0-4f5a934ff7b7` | Lakshmi Pillai | ✅ `e065ead9` | 2026-04-18 02:04:47 | later-of-pair (Rule 1) | PENDING |
| 6 | `889e1e0a-285d-4c97-871c-99d696c496ce` | `e707666a-82b4-49f1-9999-cc11fd6454cd` | Avani aditya dumbre | ✅ `171e1069` | 2026-04-18 02:11:58 | unique | PENDING |
| 7 | `cc36e00f-e750-455a-8659-3ef3f7f46fc3` | `08c1457e-3932-43ac-968a-de6d138f3d60` | Vihaan Mayur Kolhe | ✅ `01b5c231` | 2026-04-18 02:17:22 | later-of-pair (Rule 1) | PENDING |
| 8 | `93f45b31-9807-42a4-930d-9198787f335f` | `14799938-e538-407e-b97d-ad235953cd13` | Yekshit talele | ✅ `b1ce0bee` | 2026-04-18 02:21:53 | unique | PENDING |
| 9 | `5f4b2911-7b8e-457c-ba74-d5ee63cc3133` | `b709fd2b-cd6c-4dad-8532-a68bba51bd86` | Avani aditya dumbre | — | 2026-04-18 08:21:33 | unique (no content attached) | PENDING |
| 10 | `aa503e38-2c35-46f6-8d1e-67bafa1375eb` | `9c6e4098-b71a-4ec4-a5ad-b6dbfe047194` | Parinee Shyam Koli | — | 2026-04-18 13:18:43 | later-of-pair (Rule 1, no content) | PENDING |
| 11 | `98a51b45-5905-4b00-afb2-7969d2fccef7` | `cd7b3785-b57f-4743-b595-fa5f85368283` | Anirudh Sharma | — | 2026-04-18 13:21:57 | later-of-pair (Rule 1, no content) | PENDING |
| 12 | `8d7d50d0-bd46-487a-8242-d64dc81da6ec` | `c3151332-cdfd-4722-9ed2-93ec8e1dd486` | Suryanshi Tomar | — | 2026-04-18 13:24:31 | later-of-pair (Rule 1, no content) | PENDING |

**Rows 1–12 = full audit record. Tomorrow's batch = rows 2–12 (11 captures).**

## Payload template per QStash publish

Target URL: `https://yestoryd.com/api/jobs/post-capture-orchestrator`

For each capture in the PENDING list, publish:

```json
{
  "captureId": "<row.captureId>",
  "sessionId": "<row.sessionId>",
  "childId": "<fetch from structured_capture_responses.child_id>",
  "coachId": "<fetch from structured_capture_responses.coach_id>",
  "sessionModality": "<fetch from structured_capture_responses.session_modality>",
  "timestamp": "<new Date().toISOString()>"
}
```

QStash client settings should match the in-app helper: `retries: 3`, `delay: 1`.

## Expected side-effects per republish

Each successful publish produces:
1. One `learning_events` row (`event_type = 'structured_capture'`) — within ~3s
2. One `parent_daily_tasks` row (`source = 'coach_assigned'`) — within ~6s; `content_item_id` preserved where attached
3. Two `communication_logs` rows for `P22_practice_tasks_assigned`:
   - WhatsApp attempt row → expected `wa_sent: false`, `error_message: "Template params does not match the campaign"` (AiSensy template bug, L2 open ticket)
   - Email row → expected `email_sent: true` (this is the user-visible delivery)

## Post-batch verification query

```sql
SELECT
  scr.id AS capture_id,
  scr.session_id,
  c.name AS child_name,
  EXISTS(SELECT 1 FROM learning_events le
         WHERE le.event_type = 'structured_capture'
           AND le.created_at >= scr.created_at
           AND le.event_data->>'captureId' = scr.id::text) AS event_emitted,
  EXISTS(SELECT 1 FROM parent_daily_tasks pdt
         WHERE pdt.session_id = scr.session_id
           AND pdt.source = 'coach_assigned'
           AND pdt.created_at > NOW() - INTERVAL '2 hours') AS task_created,
  EXISTS(SELECT 1 FROM communication_logs cl
         WHERE cl.template_code = 'P22_practice_tasks_assigned'
           AND cl.context_id = scr.session_id::text
           AND cl.email_sent = true
           AND cl.created_at > NOW() - INTERVAL '2 hours') AS p22_email_delivered
FROM structured_capture_responses scr
LEFT JOIN children c ON c.id = scr.child_id
WHERE scr.id IN (
  '08f24312-cd8d-458b-93cf-9d0db9ee3916',
  '4db9f6af-fa77-4f9e-a5c1-39d0f6468d57',
  '57f97b1e-f44e-450d-b783-3cfae7ecb2a9',
  '2f8a36c0-b8de-438a-ad01-962c2a323762',
  '889e1e0a-285d-4c97-871c-99d696c496ce',
  'cc36e00f-e750-455a-8659-3ef3f7f46fc3',
  '93f45b31-9807-42a4-930d-9198787f335f',
  '5f4b2911-7b8e-457c-ba74-d5ee63cc3133',
  'aa503e38-2c35-46f6-8d1e-67bafa1375eb',
  '98a51b45-5905-4b00-afb2-7969d2fccef7',
  '8d7d50d0-bd46-487a-8242-d64dc81da6ec'
)
ORDER BY scr.created_at;
```

Pass criteria: all 11 rows show `event_emitted = true`, `task_created = true`, `p22_email_delivered = true`.

## Post-Republish Step: Task Date Override (REQUIRED before closing batch)

Run this UPDATE **after** all 11 QStash publishes complete AND the verification query above shows all 11 rows passing. This corrects `task_date` on the newly-created reconciliation tasks so they render as today-actionable in the parent dashboard.

```sql
UPDATE parent_daily_tasks
SET task_date = CURRENT_DATE, updated_at = NOW()
WHERE id IN (
  SELECT id FROM parent_daily_tasks
  WHERE source = 'coach_assigned'
    AND created_at > NOW() - INTERVAL '1 hour'
    AND child_id IN (
      SELECT child_id FROM structured_capture_responses
      WHERE id = ANY(ARRAY[
        '08f24312-cd8d-458b-93cf-9d0db9ee3916',
        '4db9f6af-fa77-4f9e-a5c1-39d0f6468d57',
        '57f97b1e-f44e-450d-b783-3cfae7ecb2a9',
        '2f8a36c0-b8de-438a-ad01-962c2a323762',
        '889e1e0a-285d-4c97-871c-99d696c496ce',
        'cc36e00f-e750-455a-8659-3ef3f7f46fc3',
        '93f45b31-9807-42a4-930d-9198787f335f',
        '5f4b2911-7b8e-457c-ba74-d5ee63cc3133',
        'aa503e38-2c35-46f6-8d1e-67bafa1375eb',
        '98a51b45-5905-4b00-afb2-7969d2fccef7',
        '8d7d50d0-bd46-487a-8242-d64dc81da6ec'
      ]::uuid[])
    )
);
```

Expected: 11 rows updated.

### Rationale

- The orchestrator's Step 2 sets `task_date = capture.session_date` (`app/api/jobs/post-capture-orchestrator/route.ts:180`).
- For reconciliation traffic, `session_date` is 3-11 days old → tasks render as **EXPIRED** immediately in parent dashboard UI, since any UI bucketer that compares `task_date` to `CURRENT_DATE` / `date_trunc('week', CURRENT_DATE)` places them in the "past" bucket.
- Parents would receive the P22 WhatsApp/email (correctly, notifying them of the newly-assigned task) but then open the dashboard and see an "expired" task — bad UX, likely undermines trust and the reconciliation value.
- Override `task_date = CURRENT_DATE` on the 11 reconciliation tasks so they render as today-actionable.
- `session_id` on each task still preserves linkage to the original coaching session for any downstream reporting. Only the calendar-display date changes.

### Verification

```sql
SELECT child_id, title, task_date, created_at, updated_at
FROM parent_daily_tasks
WHERE source = 'coach_assigned'
  AND created_at > NOW() - INTERVAL '2 hours'
  AND child_id IN (
    SELECT child_id FROM structured_capture_responses
    WHERE id = ANY(ARRAY[
      '08f24312-cd8d-458b-93cf-9d0db9ee3916',
      '4db9f6af-fa77-4f9e-a5c1-39d0f6468d57',
      '57f97b1e-f44e-450d-b783-3cfae7ecb2a9',
      '2f8a36c0-b8de-438a-ad01-962c2a323762',
      '889e1e0a-285d-4c97-871c-99d696c496ce',
      'cc36e00f-e750-455a-8659-3ef3f7f46fc3',
      '93f45b31-9807-42a4-930d-9198787f335f',
      '5f4b2911-7b8e-457c-ba74-d5ee63cc3133',
      'aa503e38-2c35-46f6-8d1e-67bafa1375eb',
      '98a51b45-5905-4b00-afb2-7969d2fccef7',
      '8d7d50d0-bd46-487a-8242-d64dc81da6ec'
    ]::uuid[])
  )
ORDER BY child_id, task_date;
```

Expected: all 11 rows show `task_date = CURRENT_DATE` and `updated_at > created_at`.

## Known out-of-scope issues flagged during this exercise

- **L2 (WhatsApp P22)** — AiSensy campaign `P22_practice_tasks_assigned` rejects current payload with `"Template params does not match the campaign"`. Caller sends positional array `[parent_first_name, child_name, task_count, dashboard_link]`; AiSensy template registration expects a different order or named params. Fix is AiSensy-side template edit + possibly `sendCommunication` variable wiring. Tracked separately.
- **RUN 10 Redesign 6 (hardening)** — Make `body` required in `lib/api/verify-cron.ts` to prevent B1-style silent recurrence. Follow-up, not part of this reconciliation.
- **Avani Aditya Dumbre, 2026-04-18** — two captures collapsed to one task (UNIQUE constraint on (child_id, task_date, title)). Parent was notified via P22. Second capture's event emitted to learning_events but no task row. Accepted for this batch.

## OPEN for Week 1 — RUN 10 TASK-001 (createTask signature)

Prevent the task_date override from being needed again for any future reconciliation batch. Sibling work:

- Introduce a `createTask()` function in the homework module that takes `task_date` as an explicit parameter, with a default of `CURRENT_DATE` (today). Internal call sites pass explicit values where they need a non-today date.
- Update `post-capture-orchestrator/route.ts:180` to pass `task_date = today` for real-time captures (not `capture.session_date`). The session linkage is already preserved via `session_id` on the task row — `task_date` should represent "when the parent should do this practice", not "when the session happened".
- Keep `capture.session_date` available on the capture row for reporting, but stop propagating it into `parent_daily_tasks.task_date`.
- After this change: no special reconciliation override is needed when a pipeline outage is repaired — late-republished captures produce today-dated tasks automatically.

### TASK-007 — Session-distinguishing task title (Week 1, sibling to TASK-001)

- Orchestrator Step 2 hardcodes `title = 'Practice Activity'` (`app/api/jobs/post-capture-orchestrator/route.ts:174`), causing UNIQUE collisions on `(child_id, task_date, title)` for same-day multi-session children.
- Observed live during the 2026-04-22 reconciliation batch: Avani had two captures for the same session_date; first insert won, second failed silently inside Step 2's try/catch.
- `createTask()` (introduced by TASK-001) should use a session-distinguishing title — e.g., append first 6 chars of `session_id`, or a session-time-of-day marker — so two same-day sessions for one child produce two distinguishable task rows.
- Fix as part of Week 1 task layer unification, alongside TASK-001 (explicit `task_date` parameter).
