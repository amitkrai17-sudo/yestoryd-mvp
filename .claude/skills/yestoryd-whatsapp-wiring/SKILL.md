---
name: yestoryd-whatsapp-wiring
description: "When wiring or modifying caller code for Yestoryd WhatsApp templates — adding new templates, editing sendNotification call sites, investigating template drift across DB↔AiSensy↔code, fixing payload shape mismatches, or auditing the 3-way consistency triangle. Triggers on: 'caller code', 'sendNotification', 'sendCommunication', 'wa_variables', 'wa_variable_derivations', 'required_variables', 'template drift', 'AiSensy campaign', 'communication_templates table', 'add new template', 'wire template', 'template params does not match', 'campaign does not exist', or any payload-shape / slot-mismatch concern. Enforces Pattern B (canonical *_name keys + DB-declared derivations) and the AiSensy 2-step deploy gotcha. For template body copy / Meta approval / 3-block structure / number routing use the yestoryd-whatsapp-templates skill instead."
---

# Yestoryd WhatsApp Wiring (Pattern B)

You are a WhatsApp **engineering** specialist for Yestoryd. The companion skill `yestoryd-whatsapp-templates` covers Meta-facing copy/body design. This skill covers the **caller code, DB schema, and 3-way consistency** between database rows, AiSensy campaigns, and Next.js caller code.

## The Consistency Triangle

Every WhatsApp send requires three layers to agree:

```
       [DB row]
     communication_templates
            │
            ▼
   wa_template_name (must match)
            │
            ├──────────────┐
            ▼              ▼
   [AiSensy Campaign]   [Caller Code]
   campaignName=         sendNotification({
   wa_template_name        template_code: '...',
   status=Live             variables: {...}
                         })
```

If any one of these is wrong, sends fail. Common drift modes:
- **DB has new wa_variables but caller still passes old keys** → "Template params does not match" or silent slot swap
- **Code references template but AiSensy Campaign not Live** → "Campaign does not exist"
- **DB row has is_active=false but caller still tries to fire** → no log entry, no send
- **Phone format mismatch** → duplicate logs (one normalized success, one raw failure)

## Pattern B (CANONICAL — use for ALL new templates)

Adopted Apr 25 2026. Replaces ad-hoc inline `.split(' ')[0]` calls. The DB declares display vars + required canonical vars + derivation rules. The caller passes only canonical names. `notify.ts:resolveDerivations()` computes display vars server-side.

### DB schema

`communication_templates` table fields that matter for Pattern B:

| Column | Purpose | Example |
|---|---|---|
| `template_code` | Internal identifier | `parent_payment_failed_v1` |
| `wa_template_name` | Must equal AiSensy campaignName exactly | `parent_payment_failed_v1` |
| `wa_variables` | Display vars in slot order ({{1}}, {{2}}, ...) | `[parent_first_name, child_first_name, retry_link]` |
| `required_variables` | Canonical vars callers MUST pass | `[parent_name, child_name, retry_link]` |
| `wa_variable_derivations` | Rules to compute display vars from canonical | `{parent_first_name: {from: 'parent_name', op: 'first_word'}, ...}` |
| `is_active` | Whether template fires at all | `true` |
| `channel` | Routes to AiSensy / LeadBot / OpenClaw | `aisensy` |
| `use_whatsapp` | Feature flag | `true` |
| `recipient_type` | parent / coach / admin | `parent` |

### Caller code (the only correct shape)

```typescript
import { sendNotification } from '@/lib/communication/notify';

await sendNotification({
  template_code: 'parent_payment_failed_v1',
  recipient_phone: parentPhone,           // any format — server normalizes
  recipient_type: 'parent',
  contextId: razorpayPaymentId,            // for idempotency hash
  contextType: 'failed_payment',
  variables: {
    parent_name: 'Amit Rai',               // canonical — server derives parent_first_name
    child_name: 'Shloka Vavia',            // canonical — server derives child_first_name
    retry_link: `${APP_URL}/retry/${id}`,
  }
});
```

**DO NOT** pass `parent_first_name` or `child_first_name` directly. Pass the canonical full name. The DB declares the derivation; `notify.ts` runs it.

### Anti-pattern (Pattern A — legacy, do not introduce in new code)

```typescript
// ❌ Don't do this in NEW templates
variables: {
  parent_first_name: parentName.split(' ')[0],  // ad-hoc inline derivation
  child_first_name: childName.split(' ')[0],
  retry_link: ...,
}
```

This works (the legacy templates aligned over Apr 24-25 weekend use this), but creates 5 problems:
1. Caller has to remember `.split(' ')[0]` everywhere
2. Single names ("Madonna") break unexpectedly
3. Logic drifts across call sites (some use `.split(' ')[0]`, some `.trim().split(' ')[0]`)
4. No declarative source of truth for what the template actually expects
5. Hard to retrofit globally if rule changes (e.g. handle multi-word names)

## Adding a New Template — End-to-End Workflow

### Step 1: Design body (consult `yestoryd-whatsapp-templates` skill)

Body must follow: child_name line 1, no emoji, 3-block, "Yestoryd" sign-off.

### Step 2: Submit to Meta via AiSensy

- Submit template with sample values (Indian names, realistic dates)
- Wait for approval (1-24h typically)
- **Approval is step 1 of 2 — template approved ≠ ready to send**

### Step 3: Create AiSensy Campaign (CRITICAL — most-missed step)

After Meta approves, you MUST in AiSensy panel:
1. Create a new Campaign
2. Set campaignName **EXACTLY** equal to `wa_template_name` (case-sensitive)
3. Status = Live
4. Without this, sends fail with `Campaign does not exist` and admin sees no error (Resend route returns 200)

### Step 4: Insert DB row (Pattern B shape)

```sql
INSERT INTO communication_templates (
  template_code,
  wa_template_name,
  channel,
  use_whatsapp,
  recipient_type,
  is_active,
  wa_variables,
  required_variables,
  wa_variable_derivations,
  category,             -- 'utility' | 'marketing' | 'authentication'
  -- ... other cols
)
VALUES (
  'parent_<action>_v1',
  'parent_<action>_v1',                        -- MUST match AiSensy campaignName
  'aisensy',
  true,
  'parent',
  true,
  ARRAY['child_first_name', 'next_var'],       -- display order
  ARRAY['child_name', 'next_var'],             -- canonical inputs
  '{
    "child_first_name": {"from": "child_name", "op": "first_word"}
  }'::jsonb,
  'utility',
  ...
);
```

If a slot has no derivation (e.g. `retry_link`), it just appears in both `wa_variables` and `required_variables` and is passed through.

### Step 5: Wire caller code

Single entry point: `lib/communication/notify.ts → sendNotification()`. Never raw `fetch('/api/communication/send')` from server-side code (cookies don't propagate; auth fails). Never call AiSensy API directly.

```typescript
import { sendNotification } from '@/lib/communication/notify';

try {
  await sendNotification({
    template_code: '...',
    recipient_phone: phone,
    recipient_type: 'parent' | 'coach' | 'admin',
    contextId,                  // for sha256 idempotency
    contextType,
    variables: { /* canonical names only */ }
  });
} catch (err) {
  // log but don't rethrow — comms failures shouldn't break the parent flow
  console.error('[template_code] send failed', err);
}
```

### Step 6: Verify the triangle

Before declaring done, run all three checks:

```sql
-- 1. DB row correct
SELECT template_code, wa_template_name, is_active, channel,
       wa_variables, required_variables, wa_variable_derivations
FROM communication_templates
WHERE template_code = '<your_template>';
```

```bash
# 2. Caller code uses canonical names + sendNotification
grep -rn "<your_template>" --include="*.ts" --include="*.tsx" .
```

```
3. AiSensy panel: Campaign exists with same name + status=Live
   (No automated check — manual verification only.
    Pillar 2B Rule 2 [campaignIsLive] is currently a stub returning ok:true.)
```

## Modifying Existing Template Slots

When you change `wa_variables` (add/drop/rename slots), **production goes through a divergence window** between migration apply and code deploy. Mitigate:

1. Apply migration (DB now expects new shape)
2. **IMMEDIATELY** push aligned caller code (don't batch with other work)
3. If callers can't be updated atomically, **deactivate** template first (`is_active=false`), apply migration, update callers, then reactivate

### Lessons from Apr 25-26 alignment work

- 2 consecutive Vercel deploys ERRORED on TS2345 nullable type guards (Supabase types mark FK columns as `string | null` even for tightly-coupled relationships)
- DB had been migrated; production code stayed on stale deploy for ~60 min
- Zero parents affected by luck (Saturday low traffic)
- **Rule:** local `npm run build` is mandatory before push for any commit that:
  - Adds new Supabase queries with `.eq() / .single() / .maybeSingle()` chains
  - Adds new SELECT columns or JOINs
  - Touches `>5` files in one commit
  - Switches between try blocks (variable scope traps)

### TS2345 guard pattern

```typescript
// ❌ Will fail Vercel build (string | null not assignable to string)
const { data: coach } = await supabase
  .from('coaches')
  .select('name')
  .eq('id', enrollment.coach_id)   // coach_id might be null
  .single();

// ✅ Guarded
let coachFirstName = 'Coach';      // safe fallback
if (enrollment.coach_id) {
  const { data: coach } = await supabase
    .from('coaches')
    .select('name')
    .eq('id', enrollment.coach_id)
    .single();
  coachFirstName = coach?.name?.split(' ')[0] || 'Coach';
}
```

## Drift Detection Queries

Run these periodically to catch silent drift:

### What templates have fired in last 24h?
```sql
SELECT template_code,
       COUNT(*) AS attempts,
       COUNT(*) FILTER (WHERE wa_sent = true) AS success,
       COUNT(*) FILTER (WHERE wa_sent = false) AS fail,
       MAX(error_message) FILTER (WHERE wa_sent = false) AS sample_error
FROM communication_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY template_code
ORDER BY attempts DESC;
```

### Errors that indicate triangle drift
| `error_message` | Likely cause |
|---|---|
| `Campaign does not exist` | AiSensy Campaign not created or not Live (step 3 missed) |
| `Template params does not match the campaign` | DB `wa_variables` order/count doesn't match AiSensy body slots |
| `deferred_quiet_hours` | Working as designed — recipient outside their quiet window |
| `missing_or_empty_params: [...]` | Caller didn't pass a `required_variables` value |
| `404 Not Found` (on /api/communication/send fetch) | Server-to-server fetch with no auth — refactor to direct sendNotification |

### Find templates that exist in DB but no caller wires them
```bash
# Run for each suspect template
TEMPLATE='parent_coach_intro_v3'
grep -rn "$TEMPLATE" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next .
# 0 hits = dormant template (DB row but no caller code)
```

### Phantom dual-log detection (phone format duplication)

Symptom: same template, same parent, two log rows within seconds — one with phone format `91XXX...` (success) and one with `+91XXX...` (fail). Real delivery rate = 100%; logs make it look like 50%. Watch for this before declaring an "intermittent" failure.

```sql
SELECT recipient_phone, wa_sent, COUNT(*), MIN(created_at), MAX(created_at)
FROM communication_logs
WHERE template_code = '<suspect>'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY recipient_phone, wa_sent
ORDER BY MIN(created_at);
```

## WhatsApp Number Routing (engineering side)

| Number | Where it appears in code |
|---|---|
| `918976287997` | AiSensy outbound only (env: `AISENSY_API_KEY`). Never in user-facing code. |
| `918591287997` | `site_settings.whatsapp_number`. Lead Bot via Meta Cloud API. All `wa.me/...` URL constants. |
| `919321287997` | OpenClaw droplet — internal only. |

Validation: `site_settings.whatsapp_number` MUST equal `918591287997` in production. Add a startup-check or daily-health validator if missing.

## Single Entry Point Rule

`lib/communication/notify.ts → sendNotification()` is the **only** correct way to fire a WhatsApp from server-side code. Reasons:

- Wraps the Pillar 2B validator (8 rules)
- Handles phone normalization
- Computes idempotency hash (sha256 of template+phone+day+firstParam+contextId)
- Resolves derivations (Pattern B)
- Routes by `channel` (AiSensy / LeadBot / OpenClaw)
- Logs to `communication_logs` per attempt

Files that currently bypass it (tech debt — migrate when touched):
- `cron/agent-nurture`, `cron/coach-engagement`, `cron/daily-lead-digest`
- `coach/tier-change`, `backops/command`, `auth/send-otp`

Inline `fetch('/api/communication/send')` patterns are doubly broken: cookies don't propagate server-to-server, AND they bypass the validator.

## QStash Scheduling for Delayed Sends

Pattern from `parent_payment_retry_nudge_v1` (Apr 25):

```typescript
import { qstash } from '@/lib/qstash';

if (qstash) {
  await qstash.publishJSON({
    url: `${APP_URL}/api/jobs/<your-nudge-route>`,
    body: { failedPaymentId },
    delay: 1800,           // seconds (30 min)
    retries: 3,
  });
}
```

The receiving job route MUST verify the QStash signature:

```typescript
import { verifyCronRequest } from '@/lib/qstash';

const rawBody = await request.text();
if (!verifyCronRequest(request, rawBody)) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

Without verification, the route is publicly callable.

## Pillar 2B Validator Awareness

`lib/communication/validate-notification.ts` runs 8 rules before every AiSensy send:

1. `variableArityMatches` — count of slot params == AiSensy body slot count
2. `campaignIsLive` — STUB (always returns ok:true; manual AiSensy check needed)
3. `phoneIsNormalized` — phone format matches `^91\d{10}$` (always-enforced)
4. `allRequiredParamsTruthy` — no empty/null values in required_variables
5. `recipientTypeMatches` — recipient_type matches DB row
6. `variableNamesConsistent` — declared vs actual key names align
7. `aisensyDidNotSilentFail` — AiSensy POST response inspected (always-enforced)
8. `recipientNotPaused` — `parents.status` ∈ `{active, onboarding}`

Mode is currently `warn` (logs but does not block sends). Two rules always enforce regardless of mode: 3 and 7.

When designing a new template, mentally run each rule. Common own-goals:
- Rule 1: forgetting to update `wa_variables` in DB after AiSensy submit
- Rule 4: `coach.name` is null for an admin-managed lead → `coach_first_name` derives to empty
- Rule 8: paused parent → message dropped, no obvious admin signal

## Implementation Checklist (paste into PR description for any template work)

- [ ] **Body design** follows `yestoryd-whatsapp-templates` skill (line 1 child_name, no emoji, 3-block, Yestoryd sign-off)
- [ ] AiSensy template **submitted to Meta** with realistic sample values
- [ ] AiSensy **Campaign created** with `campaignName = wa_template_name`
- [ ] AiSensy Campaign status = **Live**
- [ ] DB row inserted with **Pattern B**: `wa_variables` (display) + `required_variables` (canonical) + `wa_variable_derivations` (rules)
- [ ] DB `wa_template_name` exactly equals AiSensy campaignName (case-sensitive)
- [ ] `is_active = true`, `channel = 'aisensy'`, `use_whatsapp = true`
- [ ] Caller imports from `@/lib/communication/notify` (NOT raw fetch)
- [ ] Caller passes **canonical names only** (e.g. `child_name`, NOT `child_first_name`)
- [ ] `try/catch` wraps the `sendNotification` call (don't break parent flow on comms error)
- [ ] If delayed: QStash publish has `verifyCronRequest` on receiving route
- [ ] Local `npm run build` passes (mandatory if commit touches >5 files or new SELECT chains)
- [ ] Risk-window plan: migration applied + caller code deployed atomically
- [ ] Post-deploy verification: first natural fire watched in `communication_logs`

## Phase-Gated Workflow for Template Drift Fixes

Used successfully across the Apr 24-25 alignment campaign. When you suspect drift in an existing template:

```
PHASE 0 — AUDIT (READ-ONLY)
  - List all callers via grep
  - Paste sendNotification block (±20 lines) for each
  - Compare DB shape vs caller payload
  - Send history (last 30 days)
  - Risk window: how many fires expected in next 24h?

PHASE 1 — DESIGN
  - Confirm AiSensy body slot order with explicit panel paste
  - Decide: rename slots (clean) vs add/drop slots (caller refactor)
  - Decide: Pattern B retrofit yes/no

PHASE 2 — IMPLEMENT (no commit)
  - Write migration UP + DOWN
  - Update callers
  - Local npm run build

PHASE 3 — DEPLOY (atomic)
  - Apply migration
  - Push (single Vercel build)
  - Watch first natural fire
```

Stop-and-report gates between phases. Confirm with user before writes / SQL execution.

## Related Skills

- `yestoryd-whatsapp-templates` — body copy / Meta approval / 3-block / number routing (the design side)
- `yestoryd-code-patterns` — general Yestoryd code conventions (verification-first, mobile-first, dark/light themes)


## Drift Detection Methodology

A WhatsApp template lives in **three places simultaneously**:

```
1. AiSensy panel    â€” Meta-approved campaign, body text, slot count
2. DB row           â€” communication_templates with wa_template_name + wa_variables
3. Code caller      â€” sendNotification('template_code', phone, params)
```

For a template to deliver successfully, all three must agree. The "Consistency Triangle" can break in 4 distinct ways. **Audit quarterly** to catch drift before it causes silent failures.

### The 4 drift categories

```
A. NAME MISMATCH
   AiSensy has campaignName_X, DB has template_code_Y
   Risk: AiSensy returns "Campaign does not exist" on every send
   Detection: Compare AiSensy panel screenshots vs DB query
   Fix: Rename DB to match AiSensy (faster than Meta resubmission)

B. DB ACTIVE, AISENSY ABSENT
   DB row is_active=true, no AiSensy campaign with matching name
   Risk: Same "Campaign does not exist" if any caller fires it
   Detection: AiSensy panel inventory vs DB SELECT WHERE is_active=true
   Fix options:
     - If feature dead â†’ deactivate DB row (recommended for incomplete templates)
     - If feature alive â†’ submit body to Meta + create AiSensy campaign
     - If DB row has NULL wa_template_name â†’ it was never finished, deactivate

C. AISENSY APPROVED, DB ABSENT
   AiSensy campaign Live, no DB row
   Risk: Wasted Meta approval + AiSensy slot, no functional impact
   Detection: AiSensy panel template names vs DB SELECT
   Fix options:
     - Build the feature (insert DB row + caller code)
     - Pause/delete AiSensy campaign if feature is abandoned

D. ZOMBIE â€” DB INACTIVE, AISENSY ACTIVE
   DB row is_active=false (intentional), AiSensy campaign still Live
   Risk: None functional, but cluttered AiSensy panel
   Fix: Pause campaign in AiSensy panel
```

### Drift detection queries (run quarterly)

```sql
-- Get full state of all templates
SELECT
  template_code,
  is_active,
  channel,
  wa_template_name,
  array_length(wa_variables, 1) AS slot_count,
  wa_variables,
  recipient_type
FROM communication_templates
WHERE channel = 'aisensy'
ORDER BY recipient_type, template_code;

-- Cross-reference vs AiSensy panel screenshot:
-- 1. List every template_code in active DB rows
-- 2. List every campaignName in AiSensy panel screenshots
-- 3. For each diff, classify into A/B/C/D categories above
```

### Empirical wiring state via communication_logs

```sql
-- Identifies wired+firing vs wired+failing vs never-fired
WITH fire_activity AS (
  SELECT
    template_code,
    COUNT(*) AS attempts,
    COUNT(*) FILTER (WHERE wa_sent = true) AS success,
    MAX(created_at) AS last_fire
  FROM communication_logs
  WHERE created_at > NOW() - INTERVAL '60 days'
  GROUP BY template_code
)
SELECT
  ct.template_code,
  ct.is_active,
  COALESCE(fa.attempts, 0) AS attempts_60d,
  COALESCE(fa.success, 0) AS success_60d,
  CASE
    WHEN fa.attempts IS NULL THEN 'never_fired'
    WHEN fa.success > 0 THEN 'wired_firing'
    ELSE 'wired_failing'
  END AS status
FROM communication_templates ct
LEFT JOIN fire_activity fa ON fa.template_code = ct.template_code
WHERE ct.channel = 'aisensy' AND ct.is_active = true
ORDER BY status, attempts_60d DESC;
```

## The Wired-but-Dormant Pattern

A template can satisfy the Consistency Triangle (DB âœ“ AiSensy âœ“) yet **never fire** because no caller invokes `sendNotification()` for it. This is the most common state in mature systems.

### Why it happens

```
1. Template was built ahead of feature (defensive infrastructure)
2. Feature shipped without the caller hookup (wiring forgotten)
3. Feature was descoped after template approval
4. Trigger condition has never naturally occurred (low-frequency event)
```

### How to differentiate

```
Zero fires + zero callers in code     â†’ defensively built, no feature
Zero fires + caller exists in code    â†’ feature exists but trigger hasn't happened
Zero fires + caller in cron only      â†’ cron timing/condition gates send
```

### Action triage

```
HIGH IMPACT (wire NOW):
  - Templates expected to fire on every X (enrollment, payment, session)
  - Audit: is observed fire count << expected? Then caller is missing/broken
  - Example: coach_child_assigned_v4 should fire ~once per enrollment;
             zero fires for 12 active enrollments = missing caller

LOW IMPACT (defer):
  - Edge-case templates (mode change, offline session, final assessment)
  - Workshop templates when workshops aren't running
  - Discovery templates when 1:1 Coaching is dormant
  
DEFENSIVE (leave until feature ships):
  - Templates designed for product lines not yet active
  - Don't pre-emptively wire â€” caller code without a triggering feature is dead code
```

## Audit Cadence

Run a full 3-way drift audit **quarterly** OR after any of these triggers:

```
- Major template push (â‰¥5 templates submitted/migrated in one batch)
- Production WhatsApp delivery failures spike
- Any AiSensy campaign rename or deletion
- Major feature shipping that touches comms (e.g., new product launch)
- Memory entry contradicts observed system behavior
```

### Audit checklist

```
â–¡ Screenshot full AiSensy template panel (all pages, count exact total)
â–¡ Run drift detection queries above
â–¡ Cross-reference AiSensy â†” DB â†” communication_logs
â–¡ Classify all drift into A/B/C/D categories
â–¡ For each drift item, decide fix action + log as tech debt
â–¡ Update memory entry with audit-date + headline numbers
â–¡ Update this skill if new patterns surface
```

## Last Audit Snapshot â€” Apr 26 2026

This section reflects state at audit time. Update on next audit.

```
Total AiSensy templates:  59
DB active templates:      50
DB inactive (zombies):    12

Wired + firing (success): 6 templates
  parent_practice_tasks_v3       (35x) tuition kids post-session
  coach_session_reminder_1h_v3   (29x) Rucha 1h before
  admin_daily_health_v3          (14x) cron health
  parent_practice_nudge_v3       (6x)  practice reminder
  parent_tuition_onboarding_v4   (3x)  new enrollments
  parent_otp_v3                  (2x)  login auth

Wired + currently failing: 6 templates (most are pre-fix residue, expected to clear)
  coach_report_deadline_v3       (deferred quiet hours = working as designed)
  parent_session_scheduled_v3    (1 fail Apr 24, fixed since)
  parent_tuition_low_balance_v3  (phone double-prefix, fixed)
  parent_tuition_paused_v3       (slot mismatch, fixed)
  parent_tuition_renewal_v3      (slot mismatch, fixed)
  parent_feedback_request_v3     (deactivated Apr 25, residue)

Active but never fired: 33 templates (wired-but-dormant)
Recently activated (Apr 26, awaiting first natural fire): 3 templates
  parent_payment_failed_v1
  parent_payment_retry_nudge_v1
  parent_session_mode_changed_v1

DRIFT CATEGORY A (name mismatch): 0 (resolved Apr 26)
DRIFT CATEGORY B (DB has, AiSensy doesn't): 1
  parent_group_feedback_v3 â€” workshops not running, low urgency
DRIFT CATEGORY C (AiSensy has, DB doesn't): 6 wasted approvals
  parent_discovery_followup_v3   in spec, ready in AiSensy
  parent_enrollment_update_v3    in spec, ready in AiSensy
  referral_reminder              referral feature not built
  referral_reward_sent           same
  referral_code_generated_1      same
  referral_conversion_notify     same
DRIFT CATEGORY D (zombie inactive): 3 AiSensy campaigns to pause
  admin_payment_failed_v4
  parent_tuition_onboarding_v3
  parent_feedback_request_v3
```

### High-priority dormant wiring candidates (next batch)

Ranked by impact (frequency Ã— user-facing Ã— empirical gap):

```
P0 â€” coach_child_assigned_v4
     Expected: 1 fire per enrollment
     Actual: 0 fires for 12 active enrollments
     Gap: caller missing on every new enrollment
     Effort: ~30 min single-caller wire

P1 â€” Onboarding flow gap (3 templates)
     parent_coach_intro_v3       â€” fires after coach assigned
     parent_goals_capture_v3     â€” fires when capture form pushed
     parent_goals_reminder_v3    â€” fires 48h after capture if skipped
     Effort: ~1 hour batch (related callers in onboarding flow)

P2 â€” Session lifecycle (rare but high-trust)
     parent_session_reminder_1h_v3
     parent_session_reminder_24h_v3
     Effort: ~30 min â€” likely needs new cron or add to existing
```

## Lessons from Apr 25â€“26 weekend

```
1. AUDIT-FIRST RULE
   Before any template work, run the drift detection queries above.
   Current state of DB â†” AiSensy is rarely what intent documents claim.
   The 'Pillar 2B LIVE Apr 25' memory entry was wrong because it was based
   on working-tree files, not deployed code.

2. PHASE 0 MUST GREP IMPORTS
   When a file is modified in working tree, grep for imports of any new
   exports BEFORE excluding from a commit bundle. The webhook silently
   imported startOfTodayIST from date-format.ts; excluding it as 'unrelated'
   broke the Vercel build.

3. PRE-PUSH BUILD PROTOCOL
   Local 'npm run build' alone is insufficient â€” caches and working-tree
   helpers can mask issues. Use:
     git stash --include-untracked --keep-index
     rm -rf .next node_modules/.cache .turbo
     npm run build
     git stash pop
   This builds against EXACTLY what Vercel sees (committed + staged only).

4. SCHEMA REALITY > SCHEMA INTENT
   Validator Rule 8 was authored against parents.status which never existed.
   Always verify columns via information_schema BEFORE writing SELECT.
   Defense-in-depth: when multiple columns track same concept (status text
   + is_paused boolean), check both â€” they can be out of sync.

5. CONSISTENCY TRIANGLE IS NEVER COMPLETE
   Even after a clean audit, drift can re-emerge in days:
   - New AiSensy campaign approval â†’ no DB row yet
   - New DB row â†’ no caller yet
   - New caller â†’ wrong template_code reference
   Audit cadence is mandatory, not optional.

6. WIRED-BUT-DORMANT IS THE DEFAULT STATE
   Don't assume DB row + AiSensy approval = working comms.
   Empirical proof = communication_logs shows successful sends.
   Anything else is hope, not fact.
```

## Quick-reply template buttons: payload vs title

When a template is created via Meta Business Manager UI (the "Custom" button
type), Meta auto-derives the button payload from the button text. The
send-time `parameters: [{ type: 'payload', payload: '...' }]` override is
SILENTLY IGNORED by Meta unless the template was registered via Meta Graph
API with explicit `quick_reply_button` objects.

Observed in production B3 smoke test (`parent_renewal_intent_v1`, 2026-05-29):

- **Direct send via `leadbot.ts`** → Meta returns developer payload
  (`btn_renew_pause`) in inbound `.button.payload`.
- **Drainer-replayed send (via `communication_queue` → `notify.ts`)** → Meta
  returns the button title (`'Pause for now'`) in inbound `.button.payload`.
  Root cause: drainer doesn't preserve `templateButtons` across queue
  serialisation, so the `parameters` override is lost on the replay path.

Practical dispatch rule for inbound handlers
(`app/api/whatsapp/process/route.ts`, `lib/whatsapp/handlers/*`):

- For UI-created templates: match on `interactiveTitle` (the button text).
  Both `extract.ts` and `wa_lead_messages` populate `interactiveTitle` AND
  `interactiveId` in both delivery shapes — but only `interactiveTitle` is
  reliable across direct + drained paths.
- Avoid building dispatch on `interactiveId.startsWith('btn_<x>_')` patterns
  for any UI-registered template; that pattern only works for the direct
  send path and breaks silently on drainer replays.

For developer-payload-only dispatch (e.g. when the template text is
localised and a Hindi-tap should hit the same handler as an English-tap),
register the template via Meta Graph API:

```
POST /<WABA_ID>/message_templates
{
  ...,
  "components": [
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "QUICK_REPLY", "text": "Pause for now" },
        ...
      ]
    }
  ],
  "example": {
    "button_text": [{ "payload": "btn_renew_pause" }, ...]
  }
}
```

This is BACKLOG: **B5-meta-graph-api-template-registration**.

Related BACKLOG surfaced during the same smoke validation:
- **B6:** `insertLearningEvent` silently swallows CHECK-constraint rejections.
  The 2026-05-29 incident lost a `parent_renewal_decision` learning_events row
  because the event_type CHECK constraint didn't list the new value and the
  helper returned successfully with no Sentry surfacing. Need to make
  constraint violations a thrown error or a Sentry capture.
- **B7:** `communication_queue` drainer doesn't preserve `templateButtons`
  through queue serialisation. Investigate the serialise/deserialise path
  in `notify.ts` and either preserve the field or drop it deterministically
  with a Sentry warning.
