#!/usr/bin/env node
/**
 * scripts/check-calendar-ssot.mjs
 *
 * Calendar-SSOT guard (grep layer). FAILS (exit 1) if `*.events.insert(` — a raw
 * Google Calendar event CREATE — appears outside the canonical reconciling writer
 * (lib/scheduling/session-calendar-writer.ts) + an explicit allowlist.
 *
 * WHY: Phase 2A makes reconcileSessionCalendarEvent the SOLE creator/updater of a
 * scheduled_session's calendar event (reads scheduled_sessions SSOT, idempotent,
 * offline-aware, shared-event DETACH). A new inline events.insert for a session
 * re-opens the wrong-time / stale-meet / orphan-proliferation holes — so it must
 * fail loudly at build/review.
 *
 * ALLOWLIST (permitted inserts):
 *   - the writer itself + its low-level primitive (scheduleCalendarEvent).
 *   - non-session domains: discovery calls, group classes, coach-assessment.
 *   - 1:1 coaching legacy creators — TRACKED DEBT (Q1): zero live enrollments;
 *     TODO(calendar-ssot): migrate to reconcileSessionCalendarEvent.
 *
 * Zero dependencies (plain Node) so it runs in Vercel prebuild.
 *
 * Usage: node scripts/check-calendar-ssot.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['app', 'lib'];

// Files permitted to call events.insert directly.
const ALLOWLIST = new Set([
  // canonical writer + its primitive
  'lib/scheduling/session-calendar-writer.ts',
  'lib/calendar/events.ts',            // scheduleCalendarEvent (writer primitive) + bookDiscoveryCall (discovery)
  // out-of-scope domains (NOT scheduled_sessions)
  'app/api/admin/group-classes/route.ts',
  'app/api/coach-assessment/schedule-interview/route.ts',
  // TRACKED DEBT (Q1) — 1:1 coaching, zero live enrollments.
  // TODO(calendar-ssot): migrate coaching to reconcileSessionCalendarEvent.
  'lib/calendar/operations.ts',
  'app/api/sessions/confirm/route.ts',
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

// .events.insert(  — a raw Calendar event create
const INSERT = /\.events\.insert\s*\(/g;

const allowedHits = [];
const offenders = [];

const files = [];
for (const r of ROOTS) if (fs.existsSync(r)) walk(r, files);

for (const file of files) {
  const rel = norm(path.relative('.', file));
  const content = fs.readFileSync(file, 'utf8');
  const hitIdx = [];
  let m;
  INSERT.lastIndex = 0;
  while ((m = INSERT.exec(content))) hitIdx.push(m.index);
  if (hitIdx.length === 0) continue;

  const isAllowed = ALLOWLIST.has(rel);
  for (const idx of hitIdx) {
    const tag = `${rel}:${lineOf(content, idx)}`;
    (isAllowed ? allowedHits : offenders).push(tag);
  }
}

console.log('[check-calendar-ssot] *.events.insert( scan (grep layer)\n');
console.log(`ALLOWLISTED inserts (${allowedHits.length}):`);
for (const a of allowedHits.sort()) console.log(`  OK   ${a}`);
console.log('');

if (offenders.length) {
  console.error(
    `CALENDAR-SSOT VIOLATION — ${offenders.length} events.insert call(s) outside the canonical writer (reconcileSessionCalendarEvent) + allowlist:`,
  );
  for (const o of offenders.sort()) console.error(`  FAIL ${o}`);
  console.error(
    '\nFix: route the session calendar event through reconcileSessionCalendarEvent() ' +
      '(lib/scheduling/session-calendar-writer.ts).',
  );
  console.error(
    'If it is a deliberate non-session / debt exception, add the file to ALLOWLIST in ' +
      'scripts/check-calendar-ssot.mjs with a TODO.',
  );
  process.exit(1);
}

console.log('OK — no non-allowlisted events.insert calls found.');
process.exit(0);
