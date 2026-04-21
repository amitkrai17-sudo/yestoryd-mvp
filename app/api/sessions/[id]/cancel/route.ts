// ============================================================
// POST /api/sessions/[id]/cancel
// Cancel a session — coach auth
// Updates status, notifies parent if enrolled
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { randomUUID } from 'crypto';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const coachId = auth.coachId;
    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID not found' }, { status: 400 });
    }

    const { id: sessionId } = await params;

    let body: { reason?: string; cancelledBy?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { reason, cancelledBy = 'coach' } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Validate session exists and coach owns it
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, enrollment_id, session_number, status, scheduled_date, scheduled_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.coach_id !== coachId) {
      return NextResponse.json({ error: 'Not authorized to cancel this session' }, { status: 403 });
    }

    if (session.status !== 'scheduled' && session.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot cancel session with status: ${session.status}` },
        { status: 400 }
      );
    }

    // Create change request for audit trail (if enrolled)
    if (session.enrollment_id) {
      const originalDatetime = `${session.scheduled_date}T${session.scheduled_time}`;
      await supabase
        .from('session_change_requests')
        .insert({
          session_id: sessionId,
          enrollment_id: session.enrollment_id,
          initiated_by: cancelledBy,
          change_type: 'cancel',
          reason,
          reason_category: reason,
          original_datetime: originalDatetime,
          status: 'approved', // Coach-initiated cancels are auto-approved
          resolved_at: new Date().toISOString(),
        });
    }

    // Dispatch to orchestrator for consistent cancel handling
    // (updates status, handles calendar cleanup, notifications)
    let orchestratorResult: any = { success: false };
    try {
      orchestratorResult = await dispatch('session.cancel', {
        sessionId,
        reason,
        cancelledBy,
        requestId: randomUUID(),
      });
    } catch (orchError) {
      console.error('[sessions-cancel] Orchestrator error:', orchError);
    }

    // Fallback: if orchestrator didn't update status, do it directly
    if (!orchestratorResult.success) {
      const { error: updateError } = await supabase
        .from('scheduled_sessions')
        .update({
          status: 'cancelled',
          coach_notes: `Cancelled by ${cancelledBy}: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('[sessions-cancel] Direct update failed:', updateError.message);
        return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 });
      }
    }

    // Notify parent if enrolled
    if (session.enrollment_id && session.child_id) {
      try {
        const { data: child } = await supabase
          .from('children')
          .select('child_name, parent_phone, name')
          .eq('id', session.child_id)
          .single();

        if (child?.parent_phone) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/communication/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateCode: 'parent_session_cancelled_v5',
              recipientType: 'parent',
              recipientPhone: child.parent_phone,
              variables: {
                child_name: child.child_name || child.name || 'your child',
                reason,
                reschedule_link: `${process.env.NEXT_PUBLIC_APP_URL}/parent/reschedule`,
              },
            }),
          });
        }
      } catch (notifyError) {
        console.error('[sessions-cancel] Notify parent error:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Session cancelled',
      sessionId,
      orchestratorResult: orchestratorResult.success,
    });
  } catch (error) {
    console.error('[sessions-cancel] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
