// ============================================================
// POST /api/sessions/[id]/missed
// Mark a session as missed (no-show) — coach auth
// Moved from /api/sessions/missed to dynamic route pattern
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { randomUUID } from 'crypto';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertLearningEvent } from '@/lib/rai/learning-events';

export const dynamic = 'force-dynamic';

const VALID_PREVIOUS_STATUSES = ['scheduled', 'pending'];

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

    let body: { reason?: string; notifyParent?: boolean; missedBy?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { reason, notifyParent = false } = body;

    const supabase = createAdminClient();

    // Validate session exists and coach owns it
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, session_number, status, coach_id, scheduled_date')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.coach_id !== coachId) {
      return NextResponse.json({ error: 'Not authorized to modify this session' }, { status: 403 });
    }

    if (!session.child_id) {
      return NextResponse.json({ error: 'Session has no child assigned' }, { status: 400 });
    }

    if (!session.status || !VALID_PREVIOUS_STATUSES.includes(session.status)) {
      return NextResponse.json(
        { error: `Cannot mark session as missed. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // Can only mark past sessions as missed
    const sessionDate = new Date(session.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (sessionDate > today) {
      return NextResponse.json(
        { error: 'Cannot mark future sessions as missed. Use reschedule or cancel instead.' },
        { status: 400 }
      );
    }

    // Update session status
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'missed',
        coach_notes: reason ? `Missed - Reason: ${reason}` : 'Marked as missed by coach',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[sessions-missed] Update failed:', updateError.message);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    // Create learning event
    await insertLearningEvent({
      childId: session.child_id,
      eventType: 'session_missed',
      eventDate: session.scheduled_date,
      eventData: {
        session_id: sessionId,
        session_number: session.session_number,
        reason: reason || 'No reason provided',
        marked_by: coachId,
      },
      contentForEmbedding: `Session ${session.session_number} missed. ${reason || ''}`,
      signalSource: 'system_generated',
      signalConfidence: 'low',
    });

    // No-show cascade via orchestrator
    let noShowResult: any = null;
    try {
      noShowResult = await dispatch('session.no_show', {
        sessionId,
        requestId: randomUUID(),
      });
    } catch (cascadeError) {
      console.error('[sessions-missed] No-show cascade error:', cascadeError);
    }

    // Optionally notify parent
    if (notifyParent) {
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
              templateCode: 'P23_session_noshow',
              recipientType: 'parent',
              recipientPhone: child.parent_phone,
              variables: {
                child_name: child.child_name || child.name || 'your child',
                reschedule_link: `${process.env.NEXT_PUBLIC_APP_URL}/parent/reschedule`,
              },
            }),
          });
        }
      } catch (notifyError) {
        console.error('[sessions-missed] Notify parent error:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Session marked as missed',
      sessionId,
      sessionNumber: session.session_number,
      noShowData: noShowResult?.data || null,
    });
  } catch (error) {
    console.error('[sessions-missed] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
