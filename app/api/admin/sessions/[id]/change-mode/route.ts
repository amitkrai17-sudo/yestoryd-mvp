// ============================================================
// FILE: app/api/admin/sessions/[id]/change-mode/route.ts
// PURPOSE: Admin changes session_mode on a scheduled session.
//          Scope today: offline → online only.
//          Offline direction returns 501 (templates not yet built).
// SIDE EFFECTS: Google Calendar patch (Meet link preserved),
//               parent + coach WA notifications, activity_log audit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { updateCalendarEventForMode } from '@/lib/googleCalendar';
import { sendNotification, type NotifyResult } from '@/lib/communication/notify';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface RequestBody {
  new_mode: 'online' | 'offline';
  admin_id?: string;
}

function statusFromResult(result: PromiseSettledResult<NotifyResult>): string {
  if (result.status !== 'fulfilled') return 'failed';
  if (result.value.success) return 'sent';
  return result.value.reason ?? 'failed';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = (await request.json()) as RequestBody;

    if (body.new_mode !== 'online' && body.new_mode !== 'offline') {
      return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
    }

    if (body.new_mode === 'offline') {
      return NextResponse.json(
        { error: 'offline_direction_not_yet_supported' },
        { status: 501 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, session_mode, scheduled_date, scheduled_time, google_event_id, google_meet_link')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    }

    if (session.session_mode === body.new_mode) {
      return NextResponse.json({ no_change: true, session_mode: session.session_mode });
    }

    const sessionDatetime = new Date(`${session.scheduled_date}T${session.scheduled_time}+05:30`);
    if (sessionDatetime.getTime() < Date.now()) {
      return NextResponse.json({ error: 'past_session' }, { status: 400 });
    }

    const fromMode = session.session_mode;
    const toMode = body.new_mode;

    const [childResult, coachResult] = await Promise.all([
      session.child_id
        ? supabase
            .from('children')
            .select('child_name, parent_name, parent_phone')
            .eq('id', session.child_id)
            .single()
        : Promise.resolve({ data: null } as { data: null }),
      session.coach_id
        ? supabase
            .from('coaches')
            .select('name, phone, email')
            .eq('id', session.coach_id)
            .single()
        : Promise.resolve({ data: null } as { data: null }),
    ]);

    const child = childResult.data;
    const coach = coachResult.data;

    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        session_mode: toMode,
        offline_approved_by: null,
        offline_approved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error(JSON.stringify({ requestId, event: 'change_mode_db_error', error: updateError.message }));
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 });
    }

    let calendarUpdated = false;
    if (session.google_event_id && coach?.email) {
      const calResult = await updateCalendarEventForMode(
        session.google_event_id,
        coach.email,
        toMode,
      );
      calendarUpdated = calResult.success;
      if (!calResult.success) {
        console.warn(JSON.stringify({ requestId, event: 'calendar_update_failed', error: calResult.error }));
      }
    }

    try {
      await supabase.from('activity_log').insert({
        user_email: auth.email ?? 'admin',
        user_type: 'admin',
        action: 'session_mode_changed',
        metadata: {
          from: fromMode,
          to: toMode,
          session_id: sessionId,
          child_id: session.child_id,
          changed_by: body.admin_id ?? auth.userId ?? auth.email ?? 'admin',
          request_id: requestId,
        },
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.warn(JSON.stringify({
        requestId,
        event: 'activity_log_failed',
        error: logErr instanceof Error ? logErr.message : 'Unknown',
      }));
    }

    const formattedDate = formatDateShort(session.scheduled_date);
    const formattedTime = formatTime12(session.scheduled_time.slice(0, 5));

    const notifyMeta = {
      triggeredBy: 'admin' as const,
      triggeredByUserId: auth.userId ?? null,
      contextType: 'session',
      contextId: sessionId,
    };

    const parentNotifyPromise: Promise<NotifyResult> = child?.parent_phone
      ? sendNotification(
          'parent_session_mode_online_v1',
          child.parent_phone,
          {
            parent_first_name: (child.parent_name || 'Parent').split(' ')[0],
            child_name: child.child_name || 'your child',
            session_date: formattedDate,
            session_time: formattedTime,
            meet_link: session.google_meet_link ?? '',
          },
          notifyMeta,
        )
      : Promise.resolve({ success: false, reason: 'phone_not_found' } as NotifyResult);

    const coachNotifyPromise: Promise<NotifyResult> = coach?.phone
      ? sendNotification(
          'coach_session_mode_online_v1',
          coach.phone,
          {
            coach_first_name: (coach.name || 'Coach').split(' ')[0],
            child_name: child?.child_name || 'your student',
            session_date: formattedDate,
            session_time: formattedTime,
            meet_link: session.google_meet_link ?? '',
          },
          notifyMeta,
        )
      : Promise.resolve({ success: false, reason: 'phone_not_found' } as NotifyResult);

    const [parentSettled, coachSettled] = await Promise.allSettled([
      parentNotifyPromise,
      coachNotifyPromise,
    ]);

    const parentStatus = statusFromResult(parentSettled);
    const coachStatus = statusFromResult(coachSettled);

    console.log(JSON.stringify({
      requestId,
      event: 'session_mode_changed',
      sessionId,
      from: fromMode,
      to: toMode,
      calendarUpdated,
      parentNotify: parentStatus,
      coachNotify: coachStatus,
    }));

    return NextResponse.json({
      success: true,
      from: fromMode,
      to: toMode,
      notifications: {
        parent: parentStatus,
        coach: coachStatus,
      },
      calendar_updated: calendarUpdated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'change_mode_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
