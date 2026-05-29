---
name: yestoryd-phased-discipline
description: "Audit-first phased workflow for Yestoryd code changes. Use for any multi-file change, new helper, refactor, or architectural shift. Mandatory phases: Phase 0 (read-only audit) → Phase 1 (design lock) → Phase 2A/B/C... (surgical implementation with stop-and-report gates) → Phase 3 (pre-push build) → Phase 4 (human diff review) → Phase 5 (commit + push + Vercel verify). NEVER skip phases. NEVER auto-progress past stop-and-report gates. Trigger on: 'Phase 0', 'Block X', any audit-first prompt, any commit prep work."
metadata:
  version: 1.0.0
---

# Yestoryd Phased Discipline

## Core principle

Every change goes through **Phase 0 audit BEFORE design**. Even when
you're confident the architecture is right, audit first. We discovered
in past sessions that:
- Architecture decisions older than 5 days may be stale
- Project knowledge docs do not always reflect current codebase
- "Replicating a pattern" requires reading the original FIRST
- Closure-captured state, useState vs const, type signatures — these
  details matter and can't be assumed

## The phases

### Phase 0 — Read-only audit

Goal: discover current state, identify blockers, lock the actual scope.

Required actions:
- Grep for existing references with `rg -n`
- Read full file contents (not just snippets)
- Quote pre-edit shapes verbatim WITH LINE NUMBERS
- Output a Q1-Q7 summary at the end:
  - Q1: Where exactly is the target?
  - Q2: What's the current shape?
  - Q3: What's the role-truth source?
  - Q4: Does the bug actually exist as described?
  - Q5: Are there draft changes already in working tree?
  - Q6: Repo state clean? HEAD on expected SHA? tsc baseline confirmed?
  - Q7: Unexpected findings? (CRITICAL — flag anything surprising)

Stop. Wait for human review. Do not proceed to Phase 1.

### Phase 1 — Design lock

Goal: convert audit findings into locked architecture decisions.

This phase happens in the human conversation, not in the file system.
The human reviews Phase 0 + asks Claude Web for design proposal.
Decisions get confirmed via "yes to all" or amendments.

After Phase 1: the human pastes a Phase 2A prompt back to you with
locked scope.

### Phase 2X — Surgical implementation

Each sub-phase touches specific lines only. Sequenced:
- 2A: smallest atomic change
- 2B, 2C, 2D... progressively larger or more complex
- 2F: final cleanup / audit

After EACH sub-phase, stop-and-report:
- R1: pre-edit shape with line numbers
- R2: post-edit shape with line numbers
- R3: hunk-only diff for THIS phase (not cumulative until Phase 4)
- R4: cumulative `git diff --stat`
- R5: `npx tsc --noEmit | tail -10` verbatim
- R6: tsc delta = post - 54. Must be 0.
- R7: discipline confirmation (other regions byte-identical)
- R8+: phase-specific assertions

If any R-check fails, STOP and report. Do not auto-fix or graft.

### Phase 3 — Pre-push build verification

Sequence:
1. `git add` the commit's files
2. Park 7 pre-existing untracked items via `/tmp/<block-id>-park`:
   - `.claude/scheduled_tasks.lock`
   - `.claude/skills/yestoryd-whatsapp-wiring/`
   - 5 audit-*.md files
3. `rm -rf .next node_modules/.cache .turbo`
4. `npm run build 2>&1 | tail -100`
5. Confirm `.next/BUILD_ID` exists
6. Restore parked items
7. Confirm git status returns to staged + 7 untracked

#### Phase 3 — Extended pre-push checklist (folded in from deploy-check, 2026-05-29)

Run these in addition to the build sequence above whenever the commit
touches the indicated surface. Not every commit hits every section.

**A. TypeScript / schema sync (only if a migration was applied)**
- `npx supabase gen types typescript --project-id agnfzrkrpuwmtjulbbpd > lib/supabase/types.ts`
  (PowerShell: write via `Set-Content -Encoding ASCII` to avoid UTF-16 BOM)
- `npx tsc --noEmit` — must return 0 errors

**B. Database consistency**
- `npx supabase db diff` — no pending unapplied migrations
- If site_settings shape changed: grep that admin save invalidation is wired
  `grep -r "invalidate.*site_settings\|revalidate.*settings" app/api/admin/ --include="*.ts" -l`

**C. Cron health (only if a cron was added or modified)**
- New cron added to `/api/cron/dispatcher` schedule array
- New cron added to daily-health-check monitoring
- Logging goes to `activity_log` (NOT `cron_logs` — deprecated)

**D. Mobile testing (only if UI was touched)**

Test breakpoints (80%+ India mobile):
- iPhone SE: 375px
- Mid-range Android: 360px
- iPad: 768px
- Desktop: 1280px+

Visual checks:
- [ ] No horizontal overflow
- [ ] Bottom nav visible and functional
- [ ] Cards not clipped
- [ ] Touch targets ≥ 44px
- [ ] Forms usable on mobile keyboard

**E. Security (only if new routes / handlers added)**
- [ ] No API keys in client-side code
- [ ] Auth checks on all protected routes (use `withApiHandler()`)
- [ ] child_id isolation verified (no cross-user data leaks)
- [ ] Webhook signatures verified (Razorpay timing-safe)
- [ ] RLS policies on new tables

**F. Feature flags / site_settings (only if a new toggle was added)**
- [ ] New features behind `site_settings` toggles where appropriate
- [ ] Fallback values defined for all new site_settings keys
- [ ] Admin portal can control new settings

**G. Monitoring (only if new pages / significant actions)**
- [ ] Sentry error boundaries on new pages
- [ ] `activity_log` writes for significant actions
- [ ] `console.error` for caught exceptions (Sentry picks these up)

**H. Communication (only if new send paths)**
- [ ] Any new AiSensy templates submitted for Meta approval
- [ ] Resend email fallback configured for critical alerts
- [ ] WhatsApp template IDs in site_settings (NEVER hardcoded)
- [ ] sendNotification call sites match `wa_variable_derivations` shape
  (see `yestoryd-whatsapp-wiring` skill for the 3-way consistency triangle)

**I. Common pre-push gotchas**
- [ ] No white text on white background (explicit `text-gray-900` on inputs)
- [ ] No hardcoded pricing (all from `pricing_plans` via `getPricingConfig()`)
- [ ] ISR cache times reasonable (assessments: 300s, not 3600s)
- [ ] No new `@ts-nocheck` added (only 1 existing allowed)
- [ ] Supabase status page checked if ECONNRESET errors appear in build

**J. Post-deploy verification (after Phase 5 push)**
1. Visit each portal (parent / coach / admin) on mobile + desktop
2. Check Sentry for new errors (wait 5 minutes after deploy)
3. Verify cron dispatcher fires on next 15-min cycle
4. Run one critical flow end-to-end (e.g. discovery booking → payment → enrollment)

Stop-and-report. Wait for human go.

### Phase 4 — Diff review (human gate)

Claude Code outputs:
- Full cumulative diff for the human to read
- Substantive grep counts with expected vs actual
- Final state checklist (yes/no items)
- Proposed commit message via spec from Claude Web

Claude Code does NOT commit until human replies "PROCEED-COMMIT".

### Phase 5 — Commit + push

Sequence:
1. Heredoc commit message to /tmp file (avoids quote escape)
2. `git commit -F /tmp/<block-id>-msg.txt`
3. `git log -1 --stat` + `git log -1 --pretty=fuller` to verify
4. `git push origin main`
5. Capture new SHA
6. Stop. Claude Web will poll Vercel via MCP.

## Stop-and-report format

End every phase with EXPLICIT line:
DO NOT commit. DO NOT push. DO NOT proceed to Phase 2X+1. Stop. Wait for review.

## Failure handling

When any check fails:
- STOP. Don't try to fix the surprise.
- Output failure context verbatim with line numbers
- Output 3 possible options for resolution (don't pick one)
- Wait for human to decide

This is how we caught the spec error in Block 2.6c (redactInLog on SendMeta)
before introducing tsc errors.

## Hand-off context

Yestoryd-specific files often referenced:
- `app/parent/login/page.tsx` — verifyParentRole reference for any
  role-check helper work
- `lib/communication/notify.ts` — single entry for all notifications
- `middleware.ts` — Tier 1/2/2.5/3 parent-detection ladder
- `lib/api-auth.ts:204` — isAdminEmail() helper

## When to skip phases

Never. The discipline IS the value. Without it:
- Block 2.6c would have shipped with the OTP-in-logs leak
- Block 1D would have hit `setErrorParam` runtime error
- Phase 1C would have been re-implemented 5 days late

## PowerShell-specific reminders

- semicolons, not `&&`
- `-LiteralPath` for bracket paths
- Heredoc for commit messages
- `Set-Content -Encoding ASCII` for type generation

## Stop-gap discipline

### Convention: STOPGAP comments

Any time code is written as a known-incomplete stop-gap pending a
follow-up implementation, mark it with a `STOPGAP:` prefix in the
comment so it's grep-able later. Example:

```typescript
// STOPGAP: logCommunication doesn't support deferred_until/channel
// yet — using raw insert. Replace with logCommunication once Drain-2B
// extends it.
```

The `STOPGAP:` prefix lets a single grep surface every known-incomplete
piece of code in the repo:

```bash
rg -n "STOPGAP:" --type ts --type tsx --type sql
```

Run this grep monthly. Resolved STOPGAPs get the prefix removed in the
same commit that lands the real fix. Unresolved STOPGAPs that remain
for > 3 months become eligible for promotion to a tracked backlog
item, regardless of perceived priority — the cost of unresolved
stop-gaps compounds silently (Drain Worker, May 2026: 69 stranded
messages over 13 days because the "yet" in a stop-gap comment was
never followed up).

### Rule: no defer without a drainer

Any code path that writes a row marked "to be processed later" — any
queue insert, scheduled-send insert, deferred-message insert — MUST be
paired with the corresponding processing/drain mechanism in the SAME
block of work. Splitting "write the queue row" and "drain the queue
row" across separate blocks is how rows accumulate forever.

If for some reason the drainer must come later, the deferring code
path MUST set up an alerting mechanism (Sentry capture, daily health
check, or admin dashboard tile) that surfaces stranded volume above a
threshold within 24 hours. "We'll get to it later" with no monitor is
the failure mode that produced Drain Worker.
