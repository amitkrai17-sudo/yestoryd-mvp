import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { format } from 'date-fns';

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
      .eq('email', auth.email)
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

    if (!childIds.includes(session.child_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled sessions can be rescheduled' }, { status: 400 });
    }

    const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    if (sessionDate <= new Date()) {
      return NextResponse.json({ error: 'Cannot reschedule past sessions' }, { status: 400 });
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
    const { data: changeRequest, error: insertError } = await supabase
      .from('session_change_requests')
      .insert({
        session_id: sessionId,
        parent_id: parent.id,
        request_type: 'reschedule',
        reason,
        requested_date: preferredDate || null,
        requested_time: preferredTime || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating reschedule request:', insertError);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // If preferred date/time provided, dispatch reschedule through orchestrator
    if (preferredDate && preferredTime) {
      const newDateTime = new Date(`${preferredDate}T${preferredTime}`);
      const orchestratorResult = await dispatch('session.reschedule', {
        sessionId,
        newDate: format(newDateTime, 'yyyy-MM-dd'),
        newTime: format(newDateTime, 'HH:mm'),
        reason,
        requestId: randomUUID(),
      });

      if (!orchestratorResult.success) {
        console.error('Orchestrator reschedule failed:', orchestratorResult.error);
      }

      return NextResponse.json({
        success: true,
        requestId: changeRequest.id,
        orchestratorResult: orchestratorResult.success,
      });
    }

    return NextResponse.json({ success: true, requestId: changeRequest.id });
  } catch (error) {
    console.error('Reschedule request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
