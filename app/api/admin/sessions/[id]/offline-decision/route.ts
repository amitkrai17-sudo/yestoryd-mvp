// ============================================================
// FILE: app/api/admin/sessions/[id]/offline-decision/route.ts
// PURPOSE: Admin approves or rejects a pending offline session request
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { getSetting } from '@/lib/settings/getSettings';
import { setSessionMode } from '@/lib/scheduling/session-mode-service';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import { sendNotification } from '@/lib/communication/notify';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface RequestBody {
  decision: 'approve' | 'reject';
  admin_note?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Auth check — admin only
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body: RequestBody = await request.json();

    if (!body.decision || !['approve', 'reject'].includes(body.decision)) {
      return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 2. Fetch session with pending offline request
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, enrollment_id, offline_request_status, offline_location, session_mode, google_event_id, recall_bot_id, scheduled_date, scheduled_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 3. Validate pending status
    if (session.offline_request_status !== 'pending') {
      return NextResponse.json(
        { error: `Session offline request is not pending (current: ${session.offline_request_status ?? 'none'})` },
        { status: 400 }
      );
    }

    if (body.decision === 'approve') {
      // 4a. Approve — convert to offline
      const reportDeadlineHoursStr = await getSetting('offline_report_deadline_hours');
      const reportDeadlineHours = parseInt(reportDeadlineHoursStr ?? '4', 10);

      const sessionDatetime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
      const reportDeadline = new Date(sessionDatetime.getTime() + reportDeadlineHours * 60 * 60 * 1000);

      // session_mode + offline-approval metadata + Google event strip via the SOLE mode
      // owner (setSessionMode). suppressOfflineNotify: this route sends its own richer
      // parent notification below. Recall-bot cancel stays inline (per-route side-effect).
      const modeResult = await setSessionMode(sessionId, 'offline', {
        actor: 'admin',
        supabase,
        requestId,
        suppressOfflineNotify: true,
        offlineLocation: session.offline_location ?? undefined,
        approval: {
          requestStatus: 'approved',
          approvedBy: auth.email ?? 'admin',
          approvedAt: new Date().toISOString(),
          reportDeadline: reportDeadline.toISOString(),
        },
      });

      if (!modeResult.ok) {
        console.error(JSON.stringify({ requestId, event: 'approve_update_error', error: modeResult.error }));
        return NextResponse.json({ error: 'Failed to approve offline request' }, { status: 500 });
      }

      // Cancel Recall.ai bot if exists
      if (session.recall_bot_id) {
        const cancelled = await cancelRecallBot(session.recall_bot_id);
        console.log(JSON.stringify({ requestId, event: 'recall_bot_cancel', botId: session.recall_bot_id, success: cancelled }));
      }

      // Notify parent about in-person session (fire-and-forget)
      const childIdForNotify = session.child_id;
      if (childIdForNotify) {
        (async () => {
          try {
            const { data: child } = await supabase
              .from('children')
              .select('child_name, parent_name')
              .eq('id', childIdForNotify)
              .single();

            if (child) {
              const parentFirst = (child.parent_name || 'Parent').split(' ')[0];
              const childFirst = (child.child_name || 'Student').split(' ')[0];
              const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`)
                .toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

              await sendNotification(
                'parent_offline_notification_v3',
                childIdForNotify,
                { parent_first_name: parentFirst, child_name: childFirst, session_date: sessionDate },
                {
                  triggeredBy: 'admin',
                  triggeredByUserId: auth.userId ?? null,
                  contextType: 'session',
                  contextId: sessionId,
                },
              );

              console.log(JSON.stringify({ requestId, event: 'parent_offline_notified', sessionId }));
            }
          } catch (err) {
            console.error(JSON.stringify({ requestId, event: 'parent_offline_notify_error', error: err instanceof Error ? err.message : 'Unknown' }));
          }
        })();
      }

      console.log(JSON.stringify({
        requestId,
        event: 'offline_request_approved',
        sessionId,
        approvedBy: auth.email,
      }));

      return NextResponse.json({
        status: 'approved',
        session_mode: 'offline',
        message: 'Offline request approved. Calendar updated and recording bot cancelled.',
        report_deadline: reportDeadline.toISOString(),
      });
    } else {
      // 4b. Reject — keep online
      const { error: updateError } = await supabase
        .from('scheduled_sessions')
        .update({
          offline_request_status: 'rejected',
          offline_approved_by: auth.email ?? 'admin',
          offline_approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error(JSON.stringify({ requestId, event: 'reject_update_error', error: updateError.message }));
        return NextResponse.json({ error: 'Failed to reject offline request' }, { status: 500 });
      }

      console.log(JSON.stringify({
        requestId,
        event: 'offline_request_rejected',
        sessionId,
        rejectedBy: auth.email,
        adminNote: body.admin_note,
      }));

      return NextResponse.json({
        status: 'rejected',
        session_mode: 'online',
        message: 'Offline request rejected. Session remains online.',
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'offline_decision_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
