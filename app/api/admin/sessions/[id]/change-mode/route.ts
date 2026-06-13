// ============================================================
// FILE: app/api/admin/sessions/[id]/change-mode/route.ts
// PURPOSE: Admin changes session_mode on a scheduled session.
//          Scope today: offline → online only (offline direction → 501).
//          The mode write, link guarantee, calendar, and parent+coach WA are
//          ALL owned by setSessionMode() (lib/scheduling/session-mode-service).
//          This route only does auth, the past-session guard, and audit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { setSessionMode } from '@/lib/scheduling/session-mode-service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface RequestBody {
  new_mode: 'online' | 'offline';
  admin_id?: string;
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
      .select('id, session_mode, scheduled_date, scheduled_time')
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

    // SOLE write path — mode + link guarantee + parent/coach WA all live here.
    const result = await setSessionMode(sessionId, toMode, {
      actor: 'admin',
      reason: 'admin_change_mode',
      requestId,
      supabase,
    });

    if (!result.ok) {
      const status =
        result.error === 'link_unavailable' ? 409 :
        result.error === 'session_not_found' ? 404 : 500;
      return NextResponse.json(
        { error: result.error || 'change_failed', from: fromMode, to: toMode },
        { status }
      );
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
          changed_by: body.admin_id ?? auth.userId ?? auth.email ?? 'admin',
          request_id: requestId,
          link_source: result.linkSource ?? null,
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

    console.log(JSON.stringify({
      requestId,
      event: 'session_mode_changed',
      sessionId,
      from: fromMode,
      to: toMode,
      linkSource: result.linkSource ?? null,
      parentNotify: result.notified.parent,
      coachNotify: result.notified.coach,
    }));

    return NextResponse.json({
      success: true,
      from: fromMode,
      to: toMode,
      google_meet_link: result.link,
      notifications: result.notified,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'change_mode_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
