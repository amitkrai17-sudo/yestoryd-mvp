// GET /api/tuition/batches/conflict-check
// Live (on-change) coach batch-time conflict surfacing for the onboarding forms (2G-2.5-live).
// A thin, READ-ONLY wrapper around the canonical checkBatchConflict helper — it reimplements
// NONE of the overlap math. The submit-side guard in createTuitionOnboarding (→ route 409)
// stays the hard backstop; this endpoint only lets the UI block/warn as the coach types.
//
// Params: coachId (admin passes it; coach is server-forced to their own), days (repeatable),
// time ("HH:MM", one representative time applied to every day — mirrors the 2G-1b match effect's
// convention), durationMinutes, excludeBatchId? (skip a batch, e.g. when editing).
//
// Multi-day aggregate: block if ANY day overlaps; else warn if ANY day is same-day non-overlap;
// else clear. Ownership: a coach may only check their OWN coachId (server-forced) — 403 surface
// is unreachable because the coachId is never taken from the client for a coach.

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { checkBatchConflict, type BatchConflict } from '@/lib/scheduling/batch-conflict';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (req: NextRequest, { auth, supabase }) => {
  const params = req.nextUrl.searchParams;
  const paramCoachId = params.get('coachId');
  const days = params.getAll('days');
  const time = params.get('time');
  const durationMinutes = Number(params.get('durationMinutes') || 0);
  const excludeBatchId = params.get('excludeBatchId') || undefined;

  // Coaches may check ONLY their own batches (server-forced); admins pass an explicit coachId.
  const coachId = auth.role === 'coach' ? auth.coachId : paramCoachId;
  if (!coachId || days.length === 0 || !time || !durationMinutes) {
    return NextResponse.json({ level: 'clear', conflicts: [] });
  }

  // Run the SHARED helper once per scheduled day (it is per-day). Aggregate the levels.
  let anyBlock = false;
  let anyWarn = false;
  const conflicts: BatchConflict[] = [];
  for (const day of days) {
    const res = await checkBatchConflict({
      supabase,
      coachId,
      day,
      startTime: time,
      durationMinutes,
      excludeBatchId,
    });
    if (res.level === 'block') { anyBlock = true; conflicts.push(...res.conflicts); }
    else if (res.level === 'warn') { anyWarn = true; conflicts.push(...res.conflicts); }
  }

  const level = anyBlock ? 'block' : anyWarn ? 'warn' : 'clear';
  return NextResponse.json({ level, conflicts: level === 'block' || level === 'warn' ? conflicts : [] });
}, { auth: 'adminOrCoach' });
