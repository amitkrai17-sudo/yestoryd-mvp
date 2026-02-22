// ============================================================
// FILE: app/api/coach/sessions/[id]/request-offline/route.ts
// PURPOSE: Coach requests to convert a session to offline mode
//          Auto-approves for qualified coaches, pending for new ones
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { getSetting } from '@/lib/settings/getSettings';
import { updateCalendarEventForOffline } from '@/lib/googleCalendar';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface RequestBody {
  reason: 'travel' | 'parent_preference' | 'connectivity' | 'other';
  detail?: string;
  location?: string;
  location_type?: 'home_visit' | 'school' | 'center' | 'other';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body: RequestBody = await request.json();

    if (!body.reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const coachId = auth.coachId;

    if (!coachId) {
      return NextResponse.json({ error: 'Coach identity required' }, { status: 403 });
    }

    // 2. Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, enrollment_id, session_mode, offline_request_status, status, session_type, google_event_id, recall_bot_id, scheduled_date, scheduled_time')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(JSON.stringify({ requestId, event: 'session_not_found', sessionId }));
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 3. Validations
    if (session.coach_id !== coachId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Session does not belong to this coach' }, { status: 403 });
    }

    if (session.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled sessions can be converted to offline' }, { status: 400 });
    }

    if (session.session_mode === 'offline') {
      return NextResponse.json({ error: 'Session is already offline' }, { status: 400 });
    }

    if (session.offline_request_status) {
      return NextResponse.json(
        { error: `Offline request already exists with status: ${session.offline_request_status}` },
        { status: 400 }
      );
    }

    // 4. Fetch settings
    const [
      adherenceThresholdStr,
      onlineThresholdStr,
      offlineMaxPercentStr,
      reportDeadlineHoursStr,
    ] = await Promise.all([
      getSetting('offline_new_coach_adherence_threshold'),
      getSetting('offline_new_coach_online_threshold'),
      getSetting('offline_max_percent'),
      getSetting('offline_report_deadline_hours'),
    ]);

    const adherenceThreshold = parseInt(adherenceThresholdStr ?? '70', 10);
    const onlineThreshold = parseInt(onlineThresholdStr ?? '3', 10);
    const offlineMaxPercent = parseInt(offlineMaxPercentStr ?? '25', 10);
    const reportDeadlineHours = parseInt(reportDeadlineHoursStr ?? '4', 10);

    // 5. Offline cap check (live query)
    const enrollmentId = session.enrollment_id;
    if (!enrollmentId) {
      return NextResponse.json({ error: 'Session has no enrollment' }, { status: 400 });
    }

    const { count: offlineCount, error: offlineCountError } = await supabase
      .from('scheduled_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('session_mode', 'offline');

    if (offlineCountError) {
      console.error(JSON.stringify({ requestId, event: 'offline_count_error', error: offlineCountError.message }));
      return NextResponse.json({ error: 'Failed to check offline count' }, { status: 500 });
    }

    // Fetch enrollment total_sessions for cap calculation
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('total_sessions')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      console.error(JSON.stringify({ requestId, event: 'enrollment_not_found', enrollmentId }));
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const totalSessions = enrollment.total_sessions ?? 24;
    const maxOffline = Math.floor(totalSessions * offlineMaxPercent / 100);

    if ((offlineCount ?? 0) >= maxOffline) {
      console.log(JSON.stringify({
        requestId,
        event: 'offline_cap_reached',
        enrollmentId,
        offlineCount,
        maxOffline,
      }));
      return NextResponse.json(
        { error: `Offline session limit reached (${offlineCount}/${maxOffline}). Maximum ${offlineMaxPercent}% of sessions can be offline.` },
        { status: 403 }
      );
    }

    // 6. Coach qualification check (live query)
    const { count: qualifiedCount, error: qualCountError } = await supabase
      .from('scheduled_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('session_mode', 'online')
      .eq('status', 'completed')
      .gte('adherence_score', adherenceThreshold);

    if (qualCountError) {
      console.error(JSON.stringify({ requestId, event: 'qualification_check_error', error: qualCountError.message }));
      return NextResponse.json({ error: 'Failed to check coach qualification' }, { status: 500 });
    }

    const isQualified = (qualifiedCount ?? 0) >= onlineThreshold;

    // 7. Calculate report deadline from session scheduled datetime
    const sessionDatetime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    const reportDeadline = new Date(sessionDatetime.getTime() + reportDeadlineHours * 60 * 60 * 1000);

    if (isQualified) {
      // AUTO-APPROVE
      const { error: updateError } = await supabase
        .from('scheduled_sessions')
        .update({
          session_mode: 'offline',
          offline_request_status: 'auto_approved',
          offline_request_reason: body.reason,
          offline_reason_detail: body.detail ?? null,
          offline_location: body.location ?? null,
          offline_location_type: body.location_type ?? null,
          offline_approved_by: 'auto',
          offline_approved_at: new Date().toISOString(),
          report_deadline: reportDeadline.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error(JSON.stringify({ requestId, event: 'auto_approve_update_error', error: updateError.message }));
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      // Update Google Calendar (remove Meet link, add location)
      if (session.google_event_id) {
        const { data: coach } = await supabase
          .from('coaches')
          .select('email')
          .eq('id', coachId)
          .single();

        if (coach?.email) {
          const calResult = await updateCalendarEventForOffline(
            session.google_event_id,
            coach.email,
            body.location
          );
          if (!calResult.success) {
            console.error(JSON.stringify({ requestId, event: 'calendar_update_failed', error: calResult.error }));
          }
        }
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
            .select('child_name, parent_phone, parent_name')
            .eq('id', childIdForNotify)
            .single();

          if (child?.parent_phone) {
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

            await sendWhatsAppMessage({
              to: child.parent_phone,
              templateName: 'offline_parent_notification',
              variables: [parentFirst, childFirst, sessionDate],
            });

            console.log(JSON.stringify({ requestId, event: 'parent_offline_notified', sessionId, parentPhone: child.parent_phone }));
          }
        } catch (err) {
          console.error(JSON.stringify({ requestId, event: 'parent_offline_notify_error', error: err instanceof Error ? err.message : 'Unknown' }));
        }
      })();
      }

      console.log(JSON.stringify({
        requestId,
        event: 'offline_auto_approved',
        sessionId,
        coachId,
        qualifiedCount,
        onlineThreshold,
      }));

      return NextResponse.json({
        status: 'auto_approved',
        session_mode: 'offline',
        message: 'Session converted to offline mode. Please submit your session report within the deadline.',
        report_deadline: reportDeadline.toISOString(),
      });
    } else {
      // PENDING APPROVAL — coach is new / doesn't meet threshold
      const { error: updateError } = await supabase
        .from('scheduled_sessions')
        .update({
          offline_request_status: 'pending',
          offline_request_reason: body.reason,
          offline_reason_detail: body.detail ?? null,
          offline_location: body.location ?? null,
          offline_location_type: body.location_type ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error(JSON.stringify({ requestId, event: 'pending_update_error', error: updateError.message }));
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      console.log(JSON.stringify({
        requestId,
        event: 'offline_request_pending',
        sessionId,
        coachId,
        qualifiedCount,
        onlineThreshold,
      }));

      return NextResponse.json({
        status: 'pending',
        session_mode: 'online',
        message: `Your offline request needs admin approval. You have ${qualifiedCount ?? 0}/${onlineThreshold} qualifying online sessions completed.`,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'request_offline_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
