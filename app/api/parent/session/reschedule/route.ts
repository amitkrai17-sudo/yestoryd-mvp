// ============================================================
// POST /api/parent/session/reschedule — Unified reschedule flow
// Parent requests → coach approves. 24h minimum notice enforced.
// Works for both coaching and tuition sessions.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

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
    .select('id, name')
    .eq('email', auth.email ?? '')
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const { data: children } = await supabase
    .from('children')
    .select('id, child_name')
    .eq('parent_id', parent.id);

  const childIds = (children || []).map((c) => c.id);

  // Verify session ownership and status
  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, status, scheduled_date, scheduled_time, enrollment_id, session_number')
    .eq('id', sessionId)
    .single();

  if (!session || !session.child_id || !childIds.includes(session.child_id)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({ error: 'Only scheduled sessions can be rescheduled' }, { status: 400 });
  }

  // 24-hour minimum notice enforcement
  const sessionDateTime = new Date(`${session.scheduled_date}T${session.scheduled_time}+05:30`);
  const now = new Date();
  const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSession < 24) {
    return NextResponse.json({
      error: 'Reschedule requests must be made at least 24 hours before the session. Please contact your coach directly.',
    }, { status: 400 });
  }

  // New date must be in the future
  const newDateTime = new Date(`${newDate}T${newTime}:00+05:30`);
  if (newDateTime <= now) {
    return NextResponse.json({ error: 'New time must be in the future' }, { status: 400 });
  }

  // Check reschedule limits
  const enrollmentId = session.enrollment_id;
  if (!enrollmentId) {
    return NextResponse.json({ error: 'Session has no enrollment' }, { status: 400 });
  }

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

  // Check for existing pending request
  const { data: existingRequest } = await supabase
    .from('session_change_requests')
    .select('id')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingRequest) {
    return NextResponse.json({ error: 'A pending reschedule request already exists for this session' }, { status: 409 });
  }

  // Create pending change request (coach must approve)
  const { data: changeRequest, error: insertError } = await supabase
    .from('session_change_requests')
    .insert({
      session_id: sessionId,
      enrollment_id: enrollmentId,
      initiated_by: parent.id,
      change_type: 'reschedule',
      status: 'pending',
      reason,
      original_datetime: `${session.scheduled_date}T${session.scheduled_time}`,
      requested_new_datetime: `${newDate}T${newTime}`,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[parent-reschedule] Insert error:', insertError);
    return NextResponse.json({ error: 'Failed to create reschedule request' }, { status: 500 });
  }

  // Notify coach via WhatsApp
  try {
    const childName = children?.find(c => c.id === session.child_id)?.child_name || 'Student';
    const { sendCommunication } = await import('@/lib/communication');
    const { data: coach } = await supabase
      .from('coaches')
      .select('id, name, email, phone')
      .eq('id', session.coach_id!)
      .single();

    if (coach?.phone) {
      const oldDateStr = new Date(`${session.scheduled_date}T00:00:00+05:30`)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const newDateStr = new Date(`${newDate}T00:00:00+05:30`)
        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      await sendCommunication({
        templateCode: 'C10_reschedule_request',
        recipientType: 'coach',
        recipientId: coach.id,
        recipientPhone: coach.phone,
        recipientEmail: coach.email,
        recipientName: coach.name,
        variables: {
          coach_name: coach.name?.split(' ')[0] || 'Coach',
          parent_name: parent.name?.split(' ')[0] || 'Parent',
          child_name: childName,
          old_date: oldDateStr,
          new_date: newDateStr,
          reason,
        },
        relatedEntityType: 'session',
        relatedEntityId: sessionId,
      });
    }
  } catch (notifyErr) {
    // Non-fatal — request was already created
    console.error('[parent-reschedule] Coach notification failed:', notifyErr);
  }

  return NextResponse.json({
    success: true,
    requestId: changeRequest?.id,
    message: 'Reschedule request submitted. Your coach will review it shortly.',
    status: 'pending',
  });
}
