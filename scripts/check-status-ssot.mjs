#!/usr/bin/env node
/**
 * scripts/check-status-ssot.mjs
 *
 * State-2 SSOT guard (grep layer). FAILS (exit 1) if scheduled_sessions.status is
 * written via an INLINE object outside the SOLE writer (transitionSessionStatus) +
 * the explicit allowlist. Goal: a status-SSOT bypass fails loudly at build/review so
 * the funnel can't erode.
 *
 * DETECTS (precise):
 *   from('scheduled_sessions').update|insert|upsert({ ... status: ... })
 *   and raw SQL: UPDATE scheduled_sessions SET ... status ...
 *   - `status:` is matched with a leading boundary so *_status columns
 *     (recall_status / offline_request_status / attendance_status / …) do NOT match.
 *   - Only chains anchored on .from('scheduled_sessions') match — other tables'
 *     status writes (discovery_calls, recall_bot_sessions, group_sessions,
 *     coach_payouts, …) are ignored.
 *
 * KNOWN LIMITATION (by design — this is the grep layer; 4b adds the DB-trigger layer):
 *   Variable-indirection writes — .update(varObj) where the object is built earlier
 *   and assigned to a variable — are NOT caught. That covers the service CORE itself,
 *   session-engine buildInsertRow (birth), and the recall webhook updateSessionStatus.
 *   Those are the known internal writers; the airtight coverage is the DB trigger (4b).
 *
 * Zero dependencies (plain Node) so it runs anywhere, including Vercel prebuild.
 *
 * TODO (Step 6 Tier 2 — post-soak, do NOT build blindly): extend this gate beyond
 *   `status` to the other guarded scheduled_sessions columns (session_mode,
 *   google_event_id, google_meet_link, scheduled_date, scheduled_time, offline_*).
 *   Derive the allowlist from the legit-writer SHAPES observed in `ssot_violations`
 *   during the soak — a naive column-set grep has a large false-positive blast
 *   radius on births + offline-mode owners (offline-decision, change-mode,
 *   switch-to-online, request-offline). Keep the precise brace-matched anchor.
 *
 * Usage: node scripts/check-status-ssot.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['app', 'lib'];

// Files permitted to write scheduled_sessions.status directly.
const ALLOWLIST = new Set([
  // SOLE writer + birth helper (variable writes — not grep-caught; listed for record)
  'lib/scheduling/transition-session-status.ts', // the SOLE writer (CORE)
  'lib/scheduling/session-engine.ts',            // buildInsertRow — birth INSERT
  // A — reschedule owner (Policy F): the service delegates reschedule to these helpers
  'lib/scheduling/operations/reschedule-session.ts',
  // B — birth / calendar-attach: status set at session creation, not a transition
  'app/api/jobs/enrollment-complete/route.ts',
  'app/api/sessions/confirm/route.ts',
  'app/api/skill-booster/recommend/route.ts',
  // recall lifecycle updateSessionStatus (variable write — not grep-caught) — absorb in recall cluster
  'app/api/webhooks/recall/route.ts',
  // Step 6 Tier 1 (2026-06-19) — TIGHTENED: the former bulk-cluster writers
  //   app/api/enrollment/pause/route.ts, app/api/admin/enrollment/switch/route.ts,
  //   app/api/refund/initiate/route.ts, app/api/skill-booster/book/route.ts,
  //   lib/enrollment/pause-service.ts
  // were REMOVED from this allowlist after 4b funneled them through
  // transitionSessionStatus. They now write 0 inline status (confirmed 0 hits) —
  // re-adding them would be over-permissive and would mask a future bypass.
]);

const norm = (p) => p.split(path.sep).join('/');

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(fp);
  }
}

function lineOf(content, idx) {
  return content.slice(0, idx).split('\n').length;
}

// from('scheduled_sessions') .update|insert|upsert ( { ...
const ANCHOR = /from\(\s*['"]scheduled_sessions['"]\s*\)\s*\.(?:update|insert|upsert)\(\s*\{/g;
// a `status:` key (not *_status). Leading boundary = start, whitespace, comma, or brace.
const STATUS_KEY = /(^|[\s,{])status\s*:/;
// raw SQL UPDATE scheduled_sessions SET ... status
const RAW_SQL = /update\s+scheduled_sessions\s+set\s+[\s\S]{0,300}?(^|[\s,(])status\b/gi;

const allowedHits = [];
const offenders = [];

const files = [];
for (const r of ROOTS) if (fs.existsSync(r)) walk(r, files);

for (const file of files) {
  const rel = norm(path.relative('.', file));
  const content = fs.readFileSync(file, 'utf8');
  const hitIdx = [];

  // inline-object writes — extract the EXACT balanced { ... } object body via brace
  // matching (no window bleed), then check for a status: key strictly within it.
  let m;
  ANCHOR.lastIndex = 0;
  while ((m = ANCHOR.exec(content))) {
    const open = m.index + m[0].length - 1; // index of the opening {
    let depth = 0;
    let end = -1;
    for (let i = open; i < content.length && i < open + 6000; i++) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) continue; // unbalanced within window — skip
    const body = content.slice(open, end + 1);
    if (STATUS_KEY.test(body)) hitIdx.push(m.index);
  }
  // raw SQL
  RAW_SQL.lastIndex = 0;
  while ((m = RAW_SQL.exec(content))) hitIdx.push(m.index);

  if (hitIdx.length === 0) continue;

  const isAllowed = ALLOWLIST.has(rel);
  for (const idx of hitIdx) {
    const tag = `${rel}:${lineOf(content, idx)}`;
    (isAllowed ? allowedHits : offenders).push(tag);
  }
}

console.log('[check-status-ssot] scheduled_sessions.status inline-write scan (grep layer)\n');
console.log(`ALLOWLISTED writes (${allowedHits.length}):`);
for (const a of allowedHits.sort()) console.log(`  OK   ${a}`);
if (allowedHits.length === 0) console.log('  (none matched — known writers use variable indirection)');
console.log('');

if (offenders.length) {
  console.error(
    `SSOT VIOLATION — ${offenders.length} scheduled_sessions.status write(s) outside the SOLE writer (transitionSessionStatus) + allowlist:`,
  );
  for (const o of offenders.sort()) console.error(`  FAIL ${o}`);
  console.error(
    '\nFix: route the write through transitionSessionStatus() (lib/scheduling/transition-session-status.ts).',
  );
  console.error(
    'If it is a deliberate bulk/birth exception, add the file to ALLOWLIST in scripts/check-status-ssot.mjs with a TODO.',
  );
  process.exit(1);
}

console.log('OK — no non-allowlisted scheduled_sessions.status writes found.');
process.exit(0);
