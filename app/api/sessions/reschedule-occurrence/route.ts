// /api/sessions/reschedule-occurrence
// 2G-4 whole-batch-occurrence reschedule (all kids sharing one (batch,date,time) slot).
//   GET  ?sessionId= → preview { batchId, count, childNames[], scheduledDate, scheduledTime }
//                       for the confirm copy. Ownership-scoped.
//   POST { sessionId, newDate, newTime } → moves the whole occurrence via rescheduleOccurrence
//                       (which loops the existing per-row rescheduleSession primitive).
//
// The reconciler / generation / balance are NOT touched — only session rows move dates.
// Ownership: a coach may only touch sessions in their OWN batch (403 else); admin any.
// The single-session path (PATCH /api/sessions) is UNCHANGED — this is a separate op.

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { rescheduleOccurrence } from '@/lib/scheduling/reschedule-occurrence';

export const dynamic = 'force-dynamic';

const MOVABLE_STATUSES = ['scheduled', 'pending', 'confirmed', 'rescheduled'];

export const GET = withApiHandler(async (req: NextRequest, { auth, supabase }) => {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const { data: anchor } = await supabase
    .from('scheduled_sessions')
    .select('id, batch_id, scheduled_date, scheduled_time, coach_id')
    .eq('id', sessionId)
    .single();

  if (!anchor) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Ownership — a coach may only preview a session in their own batch.
  if (auth.role === 'coach' && anchor.coach_id !== auth.coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const batchId = (anchor as any).batch_id as string | null;
  if (!batchId) {
    // Not batched — a single-session reschedule is the only option.
    return NextResponse.json({
      batchId: null, count: 1, childNames: [],
      scheduledDate: anchor.scheduled_date, scheduledTime: anchor.scheduled_time,
    });
  }

  const { data: siblings } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id')
    .eq('batch_id' as any, batchId)
    .eq('scheduled_date', anchor.scheduled_date)
    .eq('scheduled_time', anchor.scheduled_time)
    .in('status', MOVABLE_STATUSES);

  const rows = (siblings ?? []) as Array<{ id: string; child_id: string | null }>;
  const childIds = rows.map((r) => r.child_id).filter(Boolean) as string[];

  const nameById = new Map<string, string>();
  if (childIds.length > 0) {
    const { data: kids } = await supabase.from('children').select('id, child_name').in('id', childIds);
    for (const k of (kids ?? []) as Array<{ id: string; child_name: string | null }>) {
      nameById.set(k.id, k.child_name || 'Student');
    }
  }

  return NextResponse.json({
    batchId,
    count: rows.length,
    childNames: rows.map((r) => (r.child_id ? nameById.get(r.child_id) || 'Student' : 'Student')),
    scheduledDate: anchor.scheduled_date,
    scheduledTime: anchor.scheduled_time,
  });
}, { auth: 'adminOrCoach' });

export const POST = withApiHandler(async (req: NextRequest, { auth, supabase, requestId }) => {
  const body = await req.json().catch(() => ({}));
  const { sessionId, newDate, newTime } = body as { sessionId?: string; newDate?: string; newTime?: string };

  if (!sessionId || !newDate || !newTime) {
    return NextResponse.json({ error: 'sessionId, newDate, newTime required' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !/^\d{1,2}:\d{2}$/.test(newTime)) {
    return NextResponse.json({ error: 'Invalid newDate (YYYY-MM-DD) or newTime (HH:MM)' }, { status: 400 });
  }

  // Ownership — resolve the anchor's coach before delegating (the helper checks none).
  const { data: anchor } = await supabase
    .from('scheduled_sessions')
    .select('id, coach_id')
    .eq('id', sessionId)
    .single();
  if (!anchor) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (auth.role === 'coach' && anchor.coach_id !== auth.coachId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await rescheduleOccurrence({
    supabase,
    sessionId,
    newDate,
    newTime,
    reason: 'Whole-batch occurrence reschedule',
    requestId,
  });

  return NextResponse.json(result.body, { status: result.status });
}, { auth: 'adminOrCoach' });
