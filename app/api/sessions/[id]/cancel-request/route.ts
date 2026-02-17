import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { dispatch } from '@/lib/scheduling/orchestrator';

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
    const { reason } = await request.json();

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

    // Validate session is scheduled and in the future
    if (session.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled sessions can be cancelled' }, { status: 400 });
    }

    const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    if (sessionDate <= new Date()) {
      return NextResponse.json({ error: 'Cannot cancel past sessions' }, { status: 400 });
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
    const originalDatetime = `${(session as any).scheduled_date}T${(session as any).scheduled_time}`;
    const { data: changeRequest, error: insertError } = enrollmentId
      ? await supabase
          .from('session_change_requests')
          .insert({
            session_id: sessionId,
            enrollment_id: enrollmentId,
            initiated_by: parent.id,
            change_type: 'cancel',
            reason,
            original_datetime: originalDatetime,
          })
          .select('id')
          .single()
      : { data: null, error: null };

    if (insertError) {
      console.error('Error creating cancel request:', insertError);
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // Dispatch to orchestrator for consistent cancel handling
    const orchestratorResult = await dispatch('session.cancel', {
      sessionId,
      reason,
      cancelledBy: 'parent',
      requestId: randomUUID(),
    });

    if (!orchestratorResult.success) {
      console.error('Orchestrator cancel failed:', orchestratorResult.error);
      // Change request was created, but orchestrator failed — still return success
      // The request can be retried by admin
    }

    return NextResponse.json({
      success: true,
      requestId: changeRequest?.id,
      orchestratorResult: orchestratorResult.success,
    });
  } catch (error) {
    console.error('Cancel request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
