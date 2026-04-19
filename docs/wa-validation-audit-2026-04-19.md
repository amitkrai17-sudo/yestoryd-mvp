# WhatsApp Validation Audit

**Date:** 2026-04-19
**Scope:** Template registry health, AiSensy campaign reconciliation, logging integrity
**Mode:** Read-only. No code changes.

---

## Section 1: Template Registry Health

### 1a. DB State

- **Total templates (use_whatsapp=true):** 62
- **All 62 have `wa_template_name`:** YES (zero NULL/empty)
- **All active have `wa_variables`:** YES (1 exception: `parent_auto_reply_redirect_v3` has empty array `[]` — correct, template takes 0 params)
- **All have `cost_per_send`:** YES, zero NULL

### 1b. Cost Distribution

| cost_per_send | Count | Notes |
|---------------|-------|-------|
| 0.1000 | 1 | `parent_otp_v3` only (authentication category) |
| 0.1450 | 56 | Standard utility rate |
| 1.0900 | 5 | Marketing templates: `P22_practice_tasks_assigned`, `P3_nudge_booking_24h`, `parent_goals_capture_v3`, `parent_group_micro_insight_v3`, `practice_nudge` |

### 1c. Variable Count Distribution

| var_count | Templates |
|-----------|-----------|
| 0 | `parent_auto_reply_redirect_v3` |
| 1 | `admin_daily_health_v3`, `parent_otp_v3`, `parent_proactive_notification_v3` |
| 2 | `C2_application_approved`, `P20_session_reminder_1h`, `P23_session_noshow`, `P3_nudge_booking_24h`, `P_manual_scheduling`, `R9_emergency_reschedule`, `parent_final_assessment_v3` |
| 3 | `AD2_consecutive_noshow`, `AD3_coach_noshow`, `C7_onboarding_complete`, `coach_report_deadline_v3`, `group_class_parent_feedback_request`, `parent_feedback_request_v3`, `parent_offline_notification_v3` |
| 4 | 16 templates |
| 5 | 7 templates |
| 6 | 6 templates (`C9_session_reminder`, `C_session_rescheduled`, `P_session_rescheduled`, `coach_discovery_assigned`, `parent_tuition_onboarding_v3`, `parent_tuition_renewal_v3`, `parent_tuition_payment_v3`) |
| 7 | 1 (`P1_assessment_complete`) |
| 9 | 3 (`admin_daily_digest_v3`, `admin_discovery_booked_v4`, `admin_new_lead_v4`) |

---

## Section 2: AiSensy Campaign Reconciliation

### 2a. API Access Limitation

AiSensy does not expose a campaign list API endpoint. The only endpoint used in code is the send endpoint (`backend.aisensy.com/campaign/t1/api/v2`). Campaign existence is inferred from error responses in `communication_logs`.

### 2b. Reconciliation from Error Logs (since 2026-04-01)

| DB template_code | DB wa_template_name | AiSensy Error | Status |
|------------------|---------------------|---------------|--------|
| `P_session_scheduled` | `parent_session_scheduled_v3` | "Campaign does not exist." + "Campaign is Not Live" | **P0 - NOT IN AISENSY** |
| `P_session_cancelled` | `parent_session_cancelled_v5` | "Campaign does not exist." | **P0 - NOT IN AISENSY** |
| `practice_nudge` | `parent_practice_nudge_v3` | "Campaign does not exist." | **P0 - NOT IN AISENSY** |
| (no DB row) | `coach_session_reminder` (old name) | "Campaign is Not Live" | **P1 - STALE CALLER** |
| (no DB row) | `admin_new_lead` (old name) | "Campaign is Not Live" | **P1 - STALE CALLER** |

### 2c. Templates with zero send attempts (no log data — cannot verify AiSensy existence)

The following 62 DB templates have `use_whatsapp=true` but only ~15 distinct `wa_template_name` values appear in recent logs. The remaining ~47 templates cannot be verified without an AiSensy list API or test sends.

### 2d. "Template params does not match" errors

| Template | Error | Count | Cause |
|----------|-------|-------|-------|
| `parent_tuition_onboarding_v3` | "Template params does not match the campaign" | 4 | AiSensy campaign expects different param count than code sends. Pre-migration sends used wrong variable count. |

---

## Section 3: Logging Health

### 3a. Logging Architecture

**sendNotification() path (post-migration):**
1. `sendNotification()` → validates template, resolves phone, checks caps
2. If all checks pass → calls `sendWhatsAppMessage()` in `aisensy.ts`
3. `sendWhatsAppMessage()` → calls `logCommunication()` which does **1 INSERT** into `communication_logs`
4. On success → `sendNotification()` does **1 UPDATE** on the same row, adding: `idempotency_key`, `cost_per_send`, `channel`, `triggered_by`, `triggered_by_user_id`, `context_type`, `context_id`
5. On failure before reaching `sendWhatsAppMessage()` (template not found, phone not found, daily cap, quiet hours, duplicate) → `sendNotification()` calls `logCommunication()` directly (**1 INSERT**, no UPDATE needed)

**Expected per send:** 1 INSERT + 0-1 UPDATE = 1 row per send attempt.

### 3b. INSERT columns (from aisensy.ts via logCommunication)

`template_code`, `recipient_type`, `recipient_id`, `recipient_phone`, `recipient_email`, `wa_sent`, `email_sent`, `sms_sent`, `error_message`, `sent_at`, `triggered_by`, `triggered_by_user_id`, `context_type`, `context_id`, `context_data`

### 3c. UPDATE columns (from notify.ts post-send annotation)

`idempotency_key`, `cost_per_send`, `channel`, `triggered_by`, `triggered_by_user_id`, `context_type`, `context_id`

### 3d. UPDATE failure risk

The UPDATE uses a 10-second window SELECT: find the most recent row matching `template_code` + `recipient_phone` where `idempotency_key IS NULL` and `created_at` within last 10 seconds. **Risk scenarios:**

1. **Concurrent sends of same template to same phone:** Two INSERTs within 10s, UPDATE grabs the wrong row. Mitigated by `ORDER BY created_at DESC LIMIT 1`.
2. **aisensy.ts INSERT takes >10s:** UPDATE window expires, row stays unannotated. Low risk — DB writes are fast.
3. **UNIQUE violation on idempotency_key:** Caught by try/catch, logged as warning. Non-fatal.

**Verdict:** Low risk. The 10s window is generous for single-threaded cron sends.

### 3e. Log Quality — Recent Data

**Total rows:** 107

**Post-migration (since 2026-04-16) breakdown by template:**

| template_code | Total | Sent | Failed | Issue |
|---------------|-------|------|--------|-------|
| `coach_session_reminder` | 26 | 0 | 26 | OLD campaign name — "Campaign is Not Live" |
| `C9_session_reminder` | 11 | 11 | 0 | Correct path (via sendWhatsAppMessage with meta) |
| `P_session_scheduled` | 9 | 0 | 9 | Campaign doesn't exist in AiSensy |
| `direct:admin_daily_health_v3` | 8 | 8 | 0 | Pre-migration direct sends (no DB lookup) |
| `parent_tuition_low_balance_v3` | 6 | 0 | 6 | Invalid phone format `91+91...` |
| `direct:parent_tuition_low_balance_v3` | 6 | 0 | 6 | Double-log of same failures |
| `direct:parent_tuition_onboarding_v3` | 3 | 0 | 3 | Param count mismatch |
| `practice_nudge` | 2 | 0 | 2 | Campaign doesn't exist |
| `P_session_cancelled` | 1 | 0 | 1 | Campaign doesn't exist |

### 3f. Missing idempotency_key

| Metric | Value |
|--------|-------|
| Missing idempotency (wa_sent=true) | **22 rows** |
| Oldest | 2026-03-20 |
| Newest | **2026-04-19 04:30** |

**Issue:** Even the newest successful send (Apr 19) has no idempotency_key. This means the notify.ts UPDATE annotation is NOT firing — likely because the code was deployed but the migration column `idempotency_key` doesn't exist yet, OR the sends are still going through `sendWhatsAppMessage()` directly (not through `sendNotification()`).

**Root cause:** The commit `cd1c85ff` was pushed to main on Apr 19 but Vercel deployment may not have completed, OR the `coach-reminders-1h` cron at 04:30 UTC ran before the deployment finished. The `C9_session_reminder` sends at 04:30 still show `template_code: C9_session_reminder` (the meta templateCode from the OLD sendWhatsAppMessage path), not `coach_session_reminder_1h_v3` (which would be the DB-resolved template_code from sendNotification). This confirms the sends used the OLD code path.

### 3g. Missing cost_per_send (post-migration)

| Metric | Value |
|--------|-------|
| Missing cost (wa_sent=true, since Apr 16) | **19 rows** |
| Oldest | 2026-04-16 |
| Newest | **2026-04-19 04:30** |

All successful sends lack cost_per_send — same root cause as 3f: UPDATE annotation not firing.

### 3h. Duplicate sends

| Template | Phone | Date (IST) | Count |
|----------|-------|------------|-------|
| `C9_session_reminder` | 919099145083 | 2026-04-18 | 4 |
| `C9_session_reminder` | 919099145083 | 2026-04-17 | 4 |
| `direct:admin_daily_health_v3` | 919099145083 | 2026-04-16-19 | 2/day |
| `C9_session_reminder` | 919099145083 | 2026-04-16 | 2 |

**C9 duplicates (4/day):** Multiple sessions for the same coach on the same day, each triggering a separate reminder. This is correct behavior — different sessions, not true duplicates. The idempotency key would be different per session (different `firstParam`).

**admin_daily_health (2/day):** Health check + smoke test both send the same template to admin. Intentional — two different crons.

**Verdict:** No true duplicates detected. The idempotency system (when deployed) will deduplicate same-template, same-phone, same-day, same-firstParam sends.

### 3i. Error Breakdown (since Apr 1)

| Error | Count | Last Seen | Severity |
|-------|-------|-----------|----------|
| "Campaign is Not Live" | 28 | Apr 19 | **P0** — `coach_session_reminder` (old name) and `parent_session_scheduled_v3` not live in AiSensy |
| "Campaign does not exist." | 11 | Apr 18 | **P0** — `parent_session_scheduled_v3`, `parent_session_cancelled_v5`, `parent_practice_nudge_v3` don't exist in AiSensy |
| "Invalid phone number" | 9 | Apr 18 | **P1** — phones stored as `+919...` getting double-prefixed to `91+91...` |
| "Template params does not match" | 4 | Apr 18 | **P1** — `parent_tuition_onboarding_v3` param count mismatch |
| "Invalid phone number: 91+91..." | 5 | Apr 18 | Same as above, detailed variant |

### 3j. Daily Volume + Cost (last 14 days)

| Date (IST) | Sent | Failed | Cost (Rs) | Unique Recipients |
|------------|------|--------|-----------|-------------------|
| 2026-04-19 | 3 | 8 | NULL | 1 |
| 2026-04-18 | 6 | 19 | NULL | 1 |
| 2026-04-17 | 6 | 9 | NULL | 1 |
| 2026-04-16 | 4 | 17 | NULL | 1 |
| 2026-04-15 | 1 | 2 | NULL | 1 |
| 2026-04-11 | 0 | 1 | NULL | 0 |
| 2026-04-09 | 0 | 2 | NULL | 0 |

**Cost is NULL everywhere** — the UPDATE annotation that writes `cost_per_send` hasn't fired yet (migration not deployed or deployment timing).

**Only 1 unique recipient across all days** — all sends going to 919099145083 (Amit's phone). Very low volume, staging-level traffic.

### 3k. Double-Logging Files

Files that call BOTH `sendNotification()` AND manually insert into `communication_logs`:

| File | sendNotification line | Manual insert line | Risk |
|------|----------------------|-------------------|------|
| `app/api/cron/tuition-onboarding-nudge/route.ts` | 128 | 138 | **DOUBLE-LOG** — notify.ts already logs, manual insert creates 2nd row |
| `app/api/cron/group-class-notifications/route.ts` | 167 | 174, 211 | **DOUBLE-LOG** — email log insert at 211 is OK, but WA log at 174 duplicates |
| `app/api/cron/group-class-reminders/route.ts` | 217 | 251, 361 | **DOUBLE-LOG** — manual inserts after sendNotification |
| `app/api/cron/group-class-feedback-request/route.ts` | 117 | 124 | **DOUBLE-LOG** — same pattern |
| `app/api/leads/hot-alert/route.ts` | 658 | 199 | **OK** — insert at 199 is for a different purpose (lead tracking), not the same send |

**Non-migrated files with manual inserts (not double-logging, separate paths):**
- `app/api/webhooks/whatsapp-cloud/route.ts` — Cloud API path, not AiSensy
- `app/api/certificate/send/route.ts` — email send log
- `app/api/cron/daily-lead-digest/route.ts` — email send log
- `app/api/coach/sessions/[id]/parent-update/route.ts` — email send log

### 3l. Unlogged Bypasses

Files still calling `sendWhatsAppMessage()` directly (4 architectural defers):

| File | Has logCommunication? | Has manual insert? | Logged? |
|------|----------------------|-------------------|---------|
| `app/api/backops/command/route.ts` | NO | NO | **UNLOGGED** — but aisensy.ts logs internally, so covered |
| `app/api/coach/tier-change/route.ts` | NO | NO | **UNLOGGED** — but aisensy.ts logs internally, so covered |
| `app/api/cron/coach-engagement/route.ts` | NO | NO | **UNLOGGED** — but aisensy.ts logs internally, so covered |
| `app/api/auth/send-otp/route.ts` | YES (line 56) | NO | **LOGGED** — manual logCommunication call |

**Verdict:** All 4 bypasses are logged. The 3 without explicit log calls are covered by `sendWhatsAppMessage()` in aisensy.ts which always calls `logCommunication()` internally. The `direct:` prefix on template_code distinguishes these from DB-lookup sends.

---

## Section 4: Issues Ranked by Severity

### P0 — Breaks sends in production right now

1. **`parent_session_scheduled_v3` campaign does not exist in AiSensy** — 9 failures. DB row `P_session_scheduled` references this campaign name, but AiSensy rejects it. Every session scheduling notification to parents is silently failing.

2. **`parent_session_cancelled_v5` campaign does not exist in AiSensy** — 1 failure. DB row `P_session_cancelled` references this campaign name. Session cancellation notifications to parents fail.

3. **`parent_practice_nudge_v3` campaign does not exist in AiSensy** — 2 failures. DB row `practice_nudge` references this campaign. Practice task nudges to parents fail.

4. **`coach_session_reminder` (old campaign name) not live in AiSensy** — 26 failures. A caller is sending with the OLD campaign name `coach_session_reminder` instead of `coach_session_reminder_1h_v3`. Source: the `sendCommunication()` path still uses a stale `wa_template_name` or a stale template_code lookup.

### P1 — Silent failures, data integrity risk

5. **Phone format double-prefix bug** — Phones stored as `+919...` are being prefixed to `91+919...` by callers that manually prepend `91`. 9 failures for `parent_tuition_low_balance_v3`. The `formatForWhatsApp()` function should strip the `+` but the callers are pre-formatting.

6. **`parent_tuition_onboarding_v3` param count mismatch** — 4 failures. AiSensy campaign expects a different number of template params than code sends. Likely a v3→v4 template update on AiSensy side not reflected in DB `wa_variables`.

7. **idempotency_key never populated** — All 22 successful sends (including post-Apr-16) lack `idempotency_key`. The UPDATE annotation in notify.ts is not executing. Root cause: either the migration column doesn't exist yet, OR sends are still going through the old path.

### P2 — Logging gaps, cost tracking gaps

8. **cost_per_send NULL on all sends** — 19 post-migration successful sends have no cost. Same root cause as #7 — UPDATE annotation not firing.

9. **4 double-logging files** — `tuition-onboarding-nudge`, `group-class-notifications`, `group-class-reminders`, `group-class-feedback-request` call sendNotification() (which logs via aisensy.ts) AND manually insert into `communication_logs`. Creates duplicate rows.

10. **`direct:` prefix split** — Pre-migration sends log as `direct:template_name` (from aisensy.ts) while post-migration sends should log as `template_code` (from notify.ts). Analytics queries need to account for both patterns.

### P3 — Tech debt, cleanup

11. **`coach_session_reminder` stale template_code** — No DB row for this template_code. The caller (`sendCommunication()` path) is using a stale template_code that doesn't match any `communication_templates` row. Needs investigation of which `sendCommunication()` caller passes this code.

12. **47 templates with no send attempts** — Cannot verify AiSensy campaign existence without test sends or a list API. Low risk if these templates haven't been triggered yet, but unknown state.

13. **Only 1 unique recipient in 14 days** — All WA traffic goes to 919099145083 (admin). Either no real parent/coach sends are happening, or they go through a different path not captured in these logs.

---

## Section 5: Recommended Fixes

### P0 Fixes

| # | Issue | Fix |
|---|-------|-----|
| 1 | `parent_session_scheduled_v3` not in AiSensy | Create campaign in AiSensy with exact name `parent_session_scheduled_v3`, 5 params matching DB `wa_variables` |
| 2 | `parent_session_cancelled_v5` not in AiSensy | Create campaign in AiSensy with exact name `parent_session_cancelled_v5`, 4 params |
| 3 | `parent_practice_nudge_v3` not in AiSensy | Create campaign in AiSensy with exact name `parent_practice_nudge_v3`, 4 params |
| 4 | `coach_session_reminder` stale caller | Find the `sendCommunication()` caller using template_code `coach_session_reminder` and update to `C9_session_reminder` |

### P1 Fixes

| # | Issue | Fix |
|---|-------|-----|
| 5 | Phone double-prefix `91+91...` | In `lib/tuition/balance-tracker.ts`, pass parent phone to `sendNotification()` without `91` prefix — notify.ts's `resolveRecipientPhone()` handles normalization |
| 6 | `parent_tuition_onboarding_v3` param mismatch | Verify AiSensy campaign param count matches DB `wa_variables` (6 params). If AiSensy template was updated, update DB to match |
| 7 | idempotency_key never populated | Verify migration `20260416120000_wa_engine_unified.sql` was applied. Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'communication_logs' AND column_name = 'idempotency_key'` |

### P2 Fixes

| # | Issue | Fix |
|---|-------|-----|
| 8 | cost_per_send NULL | Same root cause as #7 — fix migration deployment |
| 9 | Double-logging in 4 files | Remove manual `communication_logs` inserts from: `tuition-onboarding-nudge:138`, `group-class-notifications:174`, `group-class-reminders:251,361`, `group-class-feedback-request:124` |
