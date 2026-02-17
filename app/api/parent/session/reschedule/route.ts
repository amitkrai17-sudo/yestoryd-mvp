// ============================================================
// POST /api/parent/session/reschedule — Self-service reschedule
// Validates limits, updates session directly (no approval needed)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const RescheduleSchema = z.object({
  sessionId: z.string().uuid(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized || !auth.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = RescheduleSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { sessionId, newDate, newTime, reason } = body;
  const supabase = getServiceSupabase();

  // Verify parent
  const { data: parent } = await supabase
    .from('parents')
    .select('id')
    .eq('email', auth.email ?? '')
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const { data: children } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', parent.id);

  const childIds = (children || []).map((c) => c.id);

  // Verify session ownership and status
  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, status, scheduled_date, scheduled_time, enrollment_id')
    .eq('id', sessionId)
    .single();

  if (!session || !session.child_id || !childIds.includes(session.child_id)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({ error: 'Only scheduled sessions can be rescheduled' }, { status: 400 });
  }

  const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
  if (sessionDate <= new Date()) {
    return NextResponse.json({ error: 'Cannot reschedule past sessions' }, { status: 400 });
  }

  // New date must be in the future
  const newDateTime = new Date(`${newDate}T${newTime}`);
  if (newDateTime <= new Date()) {
    return NextResponse.json({ error: 'New time must be in the future' }, { status: 400 });
  }

  // Check reschedule limits
  const enrollmentId = session.enrollment_id;
  if (enrollmentId) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, max_reschedules, reschedules_used')
      .eq('id', enrollmentId)
      .single();

    if (enrollment) {
      const remaining = (enrollment.max_reschedules || 3) - (enrollment.reschedules_used || 0);
      if (remaining <= 0) {
        return NextResponse.json({
          error: 'Reschedule limit reached. Please contact support.',
          maxReschedules: enrollment.max_reschedules,
          rescheduleUsed: enrollment.reschedules_used,
        }, { status: 422 });
      }
    }
  }

  // Create change request record
  const { data: changeRequest } = enrollmentId ? await supabase
    .from('session_change_requests')
    .insert({
      session_id: sessionId,
      enrollment_id: enrollmentId,
      initiated_by: parent.id,
      change_type: 'reschedule',
      status: 'approved',
      reason,
      original_datetime: `${session.scheduled_date}T${session.scheduled_time}`,
      requested_new_datetime: `${newDate}T${newTime}`,
      processed_by: parent.id,
      processed_at: new Date().toISOString(),
    })
    .select('id')
    .single() : { data: null };

  // Dispatch reschedule through orchestrator (updates Google Calendar etc.)
  const requestId = randomUUID();
  const orchestratorResult = await dispatch('session.reschedule', {
    sessionId,
    newDate: format(newDateTime, 'yyyy-MM-dd'),
    newTime: format(newDateTime, 'HH:mm'),
    reason,
    requestId,
  });

  if (!orchestratorResult.success) {
    // Fallback: update session directly
    await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: newDate,
        scheduled_time: newTime,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // Increment reschedules_used
  if (enrollmentId) {
    const { data: e } = await supabase
      .from('enrollments')
      .select('reschedules_used')
      .eq('id', enrollmentId)
      .single();

    if (e) {
      await supabase
        .from('enrollments')
        .update({ reschedules_used: (e.reschedules_used || 0) + 1 })
        .eq('id', enrollmentId);
    }
  }

  return NextResponse.json({
    success: true,
    requestId: changeRequest?.id,
    newDate,
    newTime,
    orchestratorSuccess: orchestratorResult.success,
  });
}
