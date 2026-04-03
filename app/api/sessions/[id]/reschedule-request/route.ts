import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized || !auth.email) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const { reason, preferredDate, preferredTime } = await request.json();

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Verify parent owns this session
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

    const childIds = (children || []).map(c => c.id);

    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.child_id || !childIds.includes(session.child_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled sessions can be rescheduled' }, { status: 400 });
    }

    const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}+05:30`);
    const now = new Date();
    if (sessionDate <= now) {
      return NextResponse.json({ error: 'Cannot reschedule past sessions' }, { status: 400 });
    }

    // 24-hour minimum notice enforcement
    const hoursUntilSession = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilSession < 24) {
      return NextResponse.json({
        error: 'Reschedule requests must be made at least 24 hours before the session. Please contact your coach directly.',
      }, { status: 400 });
    }

    // Check reschedule limits via enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, max_reschedules, reschedules_used')
      .eq('child_id', session.child_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollment) {
      const remaining = (enrollment.max_reschedules || 3) - (enrollment.reschedules_used || 0);
      if (remaining <= 0) {
        return NextResponse.json({
          error: 'Reschedule limit reached. Please contact support for assistance.',
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
      return NextResponse.json({ error: 'A pending request already exists for this session' }, { status: 409 });
    }

    // Create the request
    const enrollmentId = (session as any).enrollment_id as string | null;
    const originalDatetime = `${session.scheduled_date}T${session.scheduled_time}`;
    const { data: changeRequest, error: insertError } = enrollmentId
      ? await supabase
          .from('session_change_requests')
          .insert({
            session_id: sessionId,
            enrollment_id: enrollmentId,
            initiated_by: 'parent',
            change_type: 'reschedule',
            reason,
            reason_category: reason,
            original_datetime: originalDatetime,
            requested_new_datetime: preferredDate && preferredTime ? `${preferredDate}T${preferredTime}` : null,
          })
          .select('id')
          .single()
      : { data: null, error: null };

    if (insertError) {
      console.error('Error creating reschedule request:', insertError);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // All reschedule requests go through coach approval — no auto-dispatch
    return NextResponse.json({
      success: true,
      requestId: changeRequest?.id,
      message: 'Reschedule request submitted. Your coach will review it shortly.',
      status: 'pending',
    });
  } catch (error) {
    console.error('Reschedule request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
