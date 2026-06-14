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
import { sendNotification } from '@/lib/communication/notify';
import { transitionSessionStatus } from '@/lib/scheduling/transition-session-status';

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

    // WA-WIRE-NOSHOW: dropped notifyParent flag entirely — coach marking a
    // session missed is itself the opt-in to notify the parent. The Meta-approved
    // parent_session_noshow_v3 template fires unconditionally below.
    // missedBy is dead in this route (read nowhere) — BACKLOG cleanup, out of scope here.
    let body: { reason?: string; missedBy?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { reason } = body;

    const supabase = createAdminClient();

    // Validate session exists and coach owns it.
    // WA-WIRE-NOSHOW: fold coaches(name) + children(child_name, parent_phone)
    // into this SELECT so the no-show parent send below can build the
    // Pattern-B canonical {child_name, coach_name} without a second round-trip.
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, session_number, status, coach_id, enrollment_id, scheduled_date,
        coaches (name),
        children (child_name, name, parent_phone)
      `)
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

    const coachNotes = reason ? `Missed - Reason: ${reason}` : 'Marked as missed by coach';

    // Status + disposition + (tuition) balance/payout via the SOLE status writer (POLICY E).
    // Tuition 'missed' = parent_no_show → deduct 1 + pay coach (service-owned). Coaching is
    // byte-identical to before: status='missed', no deduct/pay/disposition. The no-show
    // counter cascade (dispatch) + notify below are UNCHANGED and fire exactly once for both.
    const result = await transitionSessionStatus({
      sessionId,
      to: 'missed',
      actor: 'coach',
      reason,
      requestId: randomUUID(),
      opts: {
        supabase,
        extraSessionFields: { coach_notes: coachNotes },
        sessionsDelivered: 1,
        actorLabel: auth.email,
      },
    });
    // Idempotency: re-POST is gated above by VALID_PREVIOUS_STATUSES; if one ever reaches
    // here, the 2B.1 ledger guard (session_id unique) makes the deduct an idempotent no-op.
    if (!result.ok && !result.noop) {
      console.error('[sessions-missed] Status write failed:', result.error);
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

    // WA-WIRE-NOSHOW: send parent_session_noshow_v3 via Lead Bot (sendNotification
    // spine). Canonical {child_name, coach_name} — DB derivations expand to the
    // 2-slot [child_first_name, coach_first_name] body shape. Non-blocking try/catch:
    // if WhatsApp fails, the session-missed status update has already succeeded.
    try {
      const child = Array.isArray(session.children) ? session.children[0] : session.children;
      const coach = Array.isArray(session.coaches) ? session.coaches[0] : session.coaches;

      if (child?.parent_phone) {
        const childName = child.child_name || child.name || 'your child';
        const coachName = coach?.name || 'your coach';

        await sendNotification(
          'parent_session_noshow_v3',
          child.parent_phone,
          {
            child_name: childName,
            coach_name: coachName,
          },
          {
            triggeredBy: 'coach',
            triggeredByUserId: coachId,
            contextType: 'scheduled_session',
            contextId: sessionId,
          },
        );
      }
    } catch (notifyError) {
      console.error('[sessions-missed] Notify parent error:', notifyError);
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
