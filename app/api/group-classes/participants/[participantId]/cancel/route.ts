// ============================================================
// FILE: app/api/group-classes/participants/[participantId]/cancel/route.ts
// ============================================================
// Cancel a group class participant registration.
// Decrements session count + triggers waitlist auto-promotion.
// Called by: admin UI or parent self-cancel.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { promoteNextWaitlisted } from '@/lib/group-classes/waitlist-promotion';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> },
) {
  try {
    const { participantId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = (body as Record<string, unknown>).reason as string || 'Cancelled';

    const supabase = getSupabase();

    // Fetch participant with session info
    const { data: participant } = await supabase
      .from('group_session_participants')
      .select(`
        id, group_session_id, child_id, parent_id, payment_status,
        cancelled_at, amount_paid,
        group_sessions!inner (
          id, title, scheduled_date, scheduled_time,
          current_participants,
          group_class_types ( name )
        )
      `)
      .eq('id', participantId)
      .single();

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (participant.cancelled_at) {
      return NextResponse.json({ error: 'Already cancelled' }, { status: 400 });
    }

    const gs = Array.isArray(participant.group_sessions)
      ? participant.group_sessions[0]
      : participant.group_sessions;

    // Mark cancelled
    const { error: cancelErr } = await supabase
      .from('group_session_participants')
      .update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        attendance_status: 'cancelled',
      })
      .eq('id', participantId);

    if (cancelErr) {
      return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
    }

    // Decrement session participant count (only if payment was completed or free)
    if (gs && (participant.payment_status === 'paid' || participant.payment_status === 'free')) {
      const newCount = Math.max((gs.current_participants ?? 1) - 1, 0);
      await supabase
        .from('group_sessions')
        .update({ current_participants: newCount })
        .eq('id', gs.id);
    }

    // ── Auto-promote waitlist ──
    const classType = gs ? (Array.isArray(gs.group_class_types) ? gs.group_class_types[0] : gs.group_class_types) : null;
    const className = classType?.name || gs?.title || 'Workshop';

    let promotion = null;
    if (gs) {
      promotion = await promoteNextWaitlisted(
        gs.id,
        className,
        gs.scheduled_date || '',
        gs.scheduled_time || '',
      );
    }

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'group_class_participant_cancelled',
        metadata: {
          participant_id: participantId,
          session_id: gs?.id,
          child_id: participant.child_id,
          parent_id: participant.parent_id,
          reason,
          payment_status: participant.payment_status,
          waitlist_promoted: promotion?.promoted || false,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      participant_id: participantId,
      waitlist_promotion: promotion,
    });
  } catch (error) {
    console.error('[participant-cancel] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
