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

Phase 3 gate = `npx next build` exits 0. Quote the '✓ Compiled successfully'
line + the route manifest entries for any new/changed routes in the report.
tsc --noEmit and vitest are necessary but NOT sufficient — they do not run
the .next/types/ route-export constraint pass, so a route.ts that passes tsc
can still fail next build. No push without the next build success output
pasted.

Sequence:
1. `git add` the commit's files
2. Park 7 pre-existing untracked items via `/tmp/<block-id>-park`:
   - `.claude/scheduled_tasks.lock`
   - `.claude/skills/yestoryd-whatsapp-wiring/`
   - 5 audit-*.md files
3. `rm -rf .next node_modules/.cache .turbo`
4. `npx next build 2>&1 | tail -100`
5. Confirm `.next/BUILD_ID` exists AND new/changed routes appear in the
   route manifest output
6. Restore parked items
7. Confirm git status returns to staged + 7 untracked

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

## Route / API patterns

`route.ts` files may export ONLY App-Router names (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS
+ dynamic/runtime/maxDuration/revalidate/config). Any other named export
(flag, helper, const) is typed `never` by Next's generated guard and fails
`next build` (not tsc). Put config/flags/shared helpers in a sibling
`_config.ts` (leading underscore = non-routable in App Router) or in `lib/`,
and import into the route. Ref: ab32c8b8.

## Output formatting — required style for verification tables

Use column-aligned tables with ✓ / ✗ / ⚠ symbols for every binary check across
Phase 0 audits, Phase 2X R-check sweeps, Phase 4 diff review checklists,
Phase 6 post-push verifications, and any other discipline-pattern verification
output. One concern per row. No prose "all good" reports.

Format:

| Check                       | Expected | Actual | Status |
|-----------------------------|----------|--------|--------|
| tsc errors                  | 54       | 54     |   ✓    |
| vitest passed               | 264      | 264    |   ✓    |
| no stale `btn_renew_`       | 0        | 0      |   ✓    |
| dispatch on interactiveTitle| yes      | yes    |   ✓    |

Symbol semantics:

- `✓` — pass / met expectation
- `✗` — fail / unmet expectation (with a one-line reason next to it in the
  row, e.g. "✗ (tests 263, expected 264 — one removed by accident)")
- `⚠` — passes but worth noting: approved spec deviations, future-fragility
  flags, partial-only states, debugging aids left in place

Rules:

- One concern per row. Never bundle multiple checks ("x AND y AND z") into
  one row.
- Final summary line always present in this form: `tsc=N, tests=N, <key
  invariant>` — e.g. `tsc=54, tests=264, no stale btn_renew_ in changed files`.
- Header row must include all four columns (Check / Expected / Actual /
  Status) even when Expected and Actual are trivially equal — the visual
  alignment is what makes scan-time fast.
- Free-text findings (e.g. "what does the file look like at L275–286") don't
  belong in this table — quote them inline instead. Only checks that can be
  answered with a discrete state (number, yes/no, exists/missing,
  equals/differs) go in the table.

Reason: scanning 15+ checks at once is faster with column-aligned ✓/✗ than
with prose sentences. The eye locks on the rightmost column and only descends
into rows that aren't ✓. Established as the preferred format in
B3-INBOUND-FIX-v2 Phase 6 report (2026-05-29).
