# BSP Cutover Playbook

**Owner:** Amit Kumar
**First cutover:** May 3, 2026 (parent_otp_v3, Block 2.6b/c)
**Last updated:** May 3, 2026
**Status:** Living document. Update after every cutover.

This playbook governs every WhatsApp template migration from AiSensy
(8976287997) to Meta Cloud direct on Lead Bot WABA (8591287997). It
exists because the May 3 OTP cutover surfaced a logging-hygiene leak
(Block 2.6c) that would have been caught earlier with explicit
pre-flight verification. It also exists because Batch 1+ templates
(non-auth, content-bearing) carry silent-failure risk that the
OTP-only kill-switch pattern does not protect against.

---

## Two cutover profiles

Pick the profile based on the template's category and risk shape.

### Profile A — OTP-class cutover

Use ONLY for: authentication-category templates (currently just
parent_otp_v3; future auth templates if added).

Characteristics: binary success/failure (OTP arrives or doesn't),
self-evident to the user (login fails fast and they retry), low
volume, high-velocity feedback loop.

This is the profile actually used May 3 for parent_otp_v3.

### Profile B — Content-class cutover

Use for: everything else. All Batch 1, 2, 3, 4 templates fall here.

Characteristics: silent-failure risk (malformed copy delivered with
no error), variable-substitution dependent (child names, dates,
program labels), volume varies, feedback loop measured in hours or
days.

Profile B adds two pre-flight steps that Profile A skips: dry-run
smoke + real test send to Amit's phone.

**OTP-class shared-phone gotcha:** the test phone +919687606177 is
shared by two parent rows (Amit and Rucha). The OTP path's
.or().limit(1) query routes by user_id recency, currently winning
for Rucha. Brief Rucha before any OTP-class cutover test — her
phone receives the test OTP first, not Amit's. For non-OTP
Batch 1 templates, recipient routes by child_id/coach_id, not
phone, so this gotcha is OTP-specific.

---

## Pre-flight (both profiles)

Run these BEFORE any DB flip. Do not skip.

| # | Item | How to verify |
|---|------|---------------|
| 1 | Template approved by Meta on Lead Bot WABA | Meta Business Manager → WhatsApp Manager → Message Templates → status='APPROVED' for the exact `wa_template_name` |
| 2 | Code deployed to production | Vercel deployment for the relevant block(s) is READY on production target |
| 3 | DB row for template exists with correct shape | `SELECT id, code, channel, wa_template_name, wa_template_category, language_code FROM communication_templates WHERE code='<template_code>'` — `wa_template_name` matches Meta's approved name exactly (case-sensitive) |
| 4 | `wa_template_category` matches Meta's approved category | If Meta approved as MARKETING but DB says UTILITY, the `templateCategory` envelope param will mislead `leadbot.ts`. Fix the DB column before cutover. |
| 5 | `leadbot_live_sends` value confirmed | `SELECT value FROM site_settings WHERE key='leadbot_live_sends'` — note current state (true/false). May already be `true` from prior cutovers. |
| 6 | Kill-switch readiness drill | Confirm you (or Rucha) can run `UPDATE site_settings SET value='false' WHERE key='leadbot_live_sends'` via Supabase MCP within 60 seconds. Practice it once per session before any cutover. |
| 7 | Pre-cutover monitoring baseline | Run the baseline SQL query (see "Monitoring queries" section below) and record the count. This is the denominator for spike detection during P-A6/P-B6. |
| 8 | activity_log baseline | `SELECT COUNT(*) FROM activity_log WHERE created_at > NOW() - INTERVAL '1 hour'` — record number, used as denominator for spike detection later |
| 9 | OTP-class only: brief Rucha | Test OTP sends route to Rucha's phone (shared phone gotcha above). Confirm she's available and expecting test sends within the cutover window. |

If any pre-flight item fails: STOP. Do not proceed. Resolve the gap
before any DB flip.

---

## Profile A — OTP-class cutover sequence

Followed verbatim May 3 for parent_otp_v3. Documented here for
repeatability.
P-A1. Pre-flight items 1-9 above.
P-A2. Apply DB migration via Supabase MCP. For parent_otp_v3 this was
done via committed migration file
supabase/migrations/20260503_parent_otp_v3_authentication_category.sql
applied via MCP before push (see commit 6f5e7545 body).
For future templates, write a migration file OR run direct UPDATE:
UPDATE communication_templates
SET wa_template_category = 'authentication',
channel = 'leadbot'
WHERE code = '<template_code>';
Verify rows_affected = 1.
P-A3. Flip kill-switch via Supabase MCP (if not already true):
UPDATE site_settings
SET value = 'true'::jsonb
WHERE key = 'leadbot_live_sends';
Verify SELECT returns 'true'.
P-A4. Wait 5 minutes (in-process cache TTL on getSiteSettingBool).
Exception: if the kill-switch flip happens at deploy boundary
(cold-start container resets cache), no wait needed. May 3
cutover did not require explicit wait — confirm with Amit on
next cutover whether wait was needed.
P-A5. Trigger a real production send by a real action.
(For OTP: parent login attempt → triggers sendWhatsAppOTP path.)
P-A6. First-hour watch via Supabase communication_logs SQL queries
(see "Monitoring queries" section). Spine sends are NOT in
Sentry today — Supabase is the source of truth.
P-A7. If error rate exceeds baseline +2x, ROLLBACK (see below).
P-A8. After 1 hour clean: cutover succeeded. Continue passive watch
for 24h.

**OTP-cutover hidden gotcha (lesson from Block 2.6c):** the cutover
itself can succeed at delivery while still having a critical bug.
Block 2.6c was the OTP-in-logs leak — message arrived fine, but
`communication_logs.context_data.variables` contained the raw OTP
in plaintext. Always inspect `communication_logs` row shape after
first send, not just the delivery status.

---

## Profile B — Content-class cutover sequence

Adds two pre-flight verification steps that Profile A skips.
P-B1. Pre-flight items 1-9.
P-B2. Dry-run smoke test (no Meta send).
Call sendNotification() with the template code and a synthetic
payload. Use isDryRun=true OR temporarily ensure
leadbot_live_sends=false (your call which mechanism).
  Verify in communication_logs:
  - row was written
  - channel='leadbot'
  - status reflects dry-run (provider_message_id LIKE 'DRY_RUN_%',
    error_message='dry_run')
  - context_data.named_params shape matches expected variables
  - context_data.variables array reflects redaction if applicable
  - wa_template_name matches Meta-approved name exactly

  If any field is wrong, STOP. Fix the bug before any real send.
P-B3. Real test send to Amit's phone (+91 9687606177).
Apply DB flip: UPDATE communication_templates SET channel='leadbot'
WHERE code='<template_code>'.
Set leadbot_live_sends='true' if not already.
Trigger the template path that produces a send to recipient_id =
<amit_test_parent_id> = c9c1bfe1-af1c-4a59-9215-3d7b46920255.
  Verify on Amit's phone:
  - message arrives within 60 seconds
  - copy renders without {{var}} placeholders left raw
  - all dynamic variables substituted correctly (child name, date,
    program label, etc.)
  - message arrives FROM Lead Bot WABA (8591287997), not AiSensy
    (8976287997)
  - no truncation, no encoding errors, no missing emoji-equivalents

  If anything looks wrong, ROLLBACK (see below) before any
  production-facing send fires.
P-B4. Production cutover.
Once P-B3 is clean, the channel='leadbot' flip is already done.
Real production sends to other recipients now flow via Meta
direct.
P-B5. First-5-sends manual watch.
Watch communication_logs for the next 5 real sends to
production recipients (not Amit's test phone). Spot-check
that:
- status='sent' for each
- provider_message_id has Meta shape (not DRY_RUN_)
- context_data row has expected payload + correct redaction
P-B6. Hour-1 watch via Supabase queries (same as Profile A P-A6).
P-B7. Cutover #1 only: 1-week observation window before any other
Batch 1 template cutover. After cutover #1 ships clean, the
window for cutovers #2+ collapses to 48h.
P-B8. After observation window: cutover succeeded. Update this
playbook's "Cutover Log" section with the SHA + date + any
surprises encountered.

---

## Rollback procedure

Two layers, both data-driven, neither requires a redeploy.

### Layer 1 — Global kill-switch (HIGHEST PRIORITY)

Use when: any leadbot send is producing wrong behavior at the
adapter level (auth failures, malformed payloads, rate-limit
storms, anything that affects multiple templates simultaneously).

```sql
UPDATE site_settings
   SET value = 'false'::jsonb
 WHERE key = 'leadbot_live_sends';
```

Effect: `leadbot.ts` forces dry-run on every send within 5 minutes
(in-process cache TTL on `getSiteSettingBool`). All real Meta sends
stop. AiSensy 8976 templates continue to send (different channel,
unaffected).

This is the SCRAM button. Use it first if anything looks wrong, then
diagnose.

### Layer 2 — Per-template channel flip

Use when: a specific template has a known issue (wrong variable
shape, copy issue, Meta-rejected component) but other leadbot
templates are fine.

```sql
UPDATE communication_templates
   SET channel = 'aisensy'
 WHERE code = '<template_code>';
```

Effect: that one template routes back through AiSensy on next
send. Other leadbot templates unaffected. `leadbot_live_sends`
stays `true`. No redeploy needed.

### Layer 3 — Code rollback (LAST RESORT)

Only if Layer 1 + 2 are insufficient. Revert the offending commit,
push, wait for Vercel deploy. Should be unnecessary if the spine
architecture holds.

---

## Monitoring queries

Spine sends are NOT instrumented in Sentry today. All cutover
observability runs against communication_logs in Supabase. (Future
Sentry channel-tag instrumentation tracked as backlog item Block
CUTOVER-SENTRY.)

### Query M1 — Pre-flight baseline (run before P-A2 / P-B2)

```sql
SELECT
  channel,
  wa_sent,
  error_message,
  COUNT(*) AS n,
  MAX(created_at) AS most_recent
FROM communication_logs
WHERE template_code = '<template_code>'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY channel, wa_sent, error_message
ORDER BY most_recent DESC;
```

Expected pre-cutover: all rows have channel='aisensy', wa_sent=true
(or empty result if no recent sends). Record this as baseline.

### Query M2 — First-send verification (run after P-A5 / P-B3)

```sql
SELECT
  id,
  template_code,
  channel,
  recipient_phone,
  wa_sent,
  error_message,
  context_data->>'provider_message_id' AS provider_message_id,
  context_data->>'safeVariables' AS safe_variables,
  created_at
FROM communication_logs
WHERE template_code = '<template_code>'
  AND recipient_phone LIKE '%9687606177%'
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: channel='leadbot', wa_sent=true, provider_message_id
starts with 'wamid.', safeVariables shows ["[REDACTED]"] for any
sensitive positional vars (auth-class only), context_data
named_params shows [REDACTED] for any redactInLog-marked fields.

### Query M3 — Rolling failure watch (run during P-A6 / P-B5 / P-B6)

```sql
SELECT
  template_code,
  recipient_phone,
  error_message,
  context_data->>'http_status' AS http_status,
  created_at
FROM communication_logs
WHERE channel = 'leadbot'
  AND wa_sent = false
  AND error_message IS NOT NULL
  AND error_message NOT IN ('dry_run')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

Expected: zero rows during steady state. Any rows = rollback decision
point. If error_message references auth (401/403), see Block 2.5
auth-prefix logic in leadbot.ts; if rate limit (429), Layer 1
rollback. Other errors: investigate before rollback.

### Sentry-side queries (limited utility)

Useful only for the role-check side of auth flow, NOT for spine
send observability:
surface:parent_login AND reason:(otp_verified_no_parent OR fresh_signin_no_parent)
surface:middleware AND tier:tier_3_children_fallback

These catch post-OTP role-check failures, not send failures. Until
Block CUTOVER-SENTRY ships, do NOT rely on Sentry for cutover
go/no-go decisions.

---

## Cutover Log

| Date | Template | Profile | Commits | Window | Surprises | Verdict |
|------|----------|---------|---------|--------|-----------|---------|
| 2026-05-03 | parent_otp_v3 | A | ff127308, 6f5e7545, 808b258a | 24h passive | OTP-in-logs leak (Block 2.6c) — fixed same day, no customer impact | ✅ Clean post-2.6c |
| _next_ | _Batch 1 #1_ | B | _TBD_ | 1 week | _TBD_ | _TBD_ |

Update this table after every cutover. Be honest about surprises —
the table is more valuable as a record of what went unexpectedly
than as a victory log.

---

## Open items

### Resolved (May 3, 2026 audit)

- ~~Sentry tag schema verification~~ → Resolved: spine is Sentry-silent
  on send-side. Monitoring is Supabase-side via Query M1/M2/M3 above.
  Sentry channel-tag patch deferred to backlog as Block CUTOVER-SENTRY.

- ~~Test parent row~~ → Resolved: Amit's parent row exists since
  March 15 (id c9c1bfe1-af1c-4a59-9215-3d7b46920255, child Ira Rai
  id 2e262d56-237f-46b8-a108-44453c19bd61). Phone +919687606177 is
  shared with Rucha's parent row; OTP routing wins by user_id
  recency (currently Rucha). Brief Rucha pre-flight step #9 added.

### Still open

- **leadbot_live_sends cache TTL.** 5-minute in-process cache means
  kill-switch flip has up to 5min latency. For Profile B Layer-1
  rollback, consider whether 5min is acceptable for high-volume
  content templates, or whether a faster cache-bust path is worth
  building.

- **Drain worker dependency.** Backlog item: deferred-message drain
  worker. Until shipped, content templates that fire near
  quiet-hours boundary (21:00-08:00 IST) may be silently queued
  and never sent. Batch 1 templates that fire only in business
  hours are unaffected; templates that fire any time of day must
  wait for the drain worker before cutover.

- **Block CUTOVER-SENTRY.** Add `Sentry.captureMessage` invocations
  in `lib/communication/notify.ts` post-send annotate block to add
  `channel`, `template_code`, `success` tags for filterable spine
  observability. ~12-18 lines, single-file, single-concern. Do
  before broader Batch 2/3/4 rollouts. Optional for Batch 1.

---

## Document maintenance

- Update Cutover Log after every cutover (within 24h of completion).
- Update Open Items as they're resolved (cross out, don't delete).
- Major changes to playbook structure → commit as separate doc-only
  commit, reference the cutover or incident that motivated the
  change.
- Pair with `docs/CURRENT-STATE.md` Architecture Decisions section:
  this playbook is the operational runbook; CURRENT-STATE.md
  captures the architectural why.
