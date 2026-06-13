// app/api/coach/sessions/[id]/switch-to-online/route.ts
// Converts an offline/in-person session to online. Mode write, link resolution
// (calendar Meet generation), and parent+coach WA are owned by setSessionMode()
// (the sole mode/link write path). This route keeps its guards, fans the same
// link out to batch siblings via setSessionMode(explicitLink), and schedules the
// Recall.ai recording bot (which writes recall_bot_id only — not mode/link).

import { NextResponse } from 'next/server';
import { createRecallBot } from '@/lib/recall-auto-bot';
import { withParamsHandler } from '@/lib/api/with-api-handler';
import { setSessionMode } from '@/lib/scheduling/session-mode-service';

export const dynamic = 'force-dynamic';

export const POST = withParamsHandler<{ id: string }>(async (request, { id: sessionId }, { auth, supabase, requestId }) => {
  const coachId = auth.coachId;
  if (!coachId) {
    return NextResponse.json({ error: 'Coach identity required' }, { status: 403 });
  }

  // 1. Fetch session (guards + Recall context)
  const { data: session, error: sessionError } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, batch_id, session_mode, status, scheduled_date, scheduled_time')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // 2. Validations (gates unchanged)
  if (session.coach_id !== coachId && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Session does not belong to this coach' }, { status: 403 });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({ error: 'Only scheduled sessions can be switched' }, { status: 400 });
  }

  if (session.session_mode !== 'offline') {
    return NextResponse.json({ error: 'Session is already online' }, { status: 400 });
  }

  // 3. Mode + link + WA via the sole service.
  const result = await setSessionMode(sessionId, 'online', { actor: 'coach', requestId, supabase });
  if (!result.ok) {
    const status =
      result.error === 'link_unavailable' ? 409 :
      result.error === 'session_not_found' ? 404 : 500;
    return NextResponse.json({ error: result.error || 'Failed to switch session to online' }, { status });
  }
  const meetLink = result.link;

  // 4. Batch mode switch — siblings (same batch+date+time, still offline) reuse the
  //    SAME link via setSessionMode(explicitLink), keeping the sole write path.
  let siblingCount = 0;
  if (session.batch_id && meetLink) {
    const { data: siblings } = await supabase
      .from('scheduled_sessions')
      .select('id')
      .eq('batch_id' as any, session.batch_id)
      .eq('scheduled_date', session.scheduled_date!)
      .eq('scheduled_time', session.scheduled_time!)
      .eq('session_mode', 'offline')
      .neq('id', sessionId);

    for (const sib of siblings || []) {
      // Siblings reuse the same link AND suppress the coach notify — the (single)
      // coach already got one message from the primary call above.
      const sibResult = await setSessionMode(sib.id, 'online', { actor: 'coach', requestId, explicitLink: meetLink, suppressCoachNotify: true, supabase });
      if (sibResult.ok) siblingCount++;
    }
    if (siblingCount > 0) {
      console.log(JSON.stringify({ requestId, event: 'batch_siblings_switched', batchId: session.batch_id, count: siblingCount }));
    }
  }

  // 5. Schedule Recall.ai bot (recording infra — writes recall_bot_id / recall_status only).
  if (meetLink) {
    const { data: child } = session.child_id
      ? await supabase.from('children').select('child_name').eq('id', session.child_id).single()
      : { data: null };
    const childName = child?.child_name || 'Student';
    const startTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);

    try {
      if (session.batch_id) {
        const { data: existingBot } = await supabase
          .from('recall_bot_sessions')
          .select('id')
          .eq('meeting_url', meetLink)
          .gte('scheduled_join_time', `${session.scheduled_date}T00:00:00`)
          .lte('scheduled_join_time', `${session.scheduled_date}T23:59:59`)
          .neq('status', 'cancelled')
          .limit(1)
          .maybeSingle();

        if (!existingBot) {
          const botResult = await createRecallBot({
            sessionId,
            childId: session.child_id!,
            coachId,
            childName,
            meetingUrl: meetLink,
            scheduledTime: startTime,
            sessionType: 'coaching',
          });

          if (botResult.success && botResult.botId) {
            const allSessionIds = [sessionId];
            const { data: batchSessions } = await supabase
              .from('scheduled_sessions')
              .select('id')
              .eq('batch_id' as any, session.batch_id)
              .eq('scheduled_date', session.scheduled_date!)
              .eq('scheduled_time', session.scheduled_time!);
            if (batchSessions) allSessionIds.push(...batchSessions.map(s => s.id));

            await supabase
              .from('scheduled_sessions')
              .update({ recall_bot_id: botResult.botId, recall_status: 'scheduled' })
              .in('id', Array.from(new Set(allSessionIds)));
          }
          console.log(JSON.stringify({ requestId, event: 'recall_bot_scheduled_batch', success: botResult.success, botId: botResult.botId }));
        } else {
          console.log(JSON.stringify({ requestId, event: 'recall_bot_already_exists', batchId: session.batch_id }));
        }
      } else {
        createRecallBot({
          sessionId,
          childId: session.child_id!,
          coachId,
          childName,
          meetingUrl: meetLink,
          scheduledTime: startTime,
          sessionType: 'coaching',
        }).then(botResult => {
          if (botResult.success && botResult.botId) {
            supabase.from('scheduled_sessions')
              .update({ recall_bot_id: botResult.botId, recall_status: 'scheduled' })
              .eq('id', sessionId)
              .then(() => {});
          }
          console.log(JSON.stringify({ requestId, event: 'recall_bot_scheduled', success: botResult.success, botId: botResult.botId }));
        }).catch(err => {
          console.error(JSON.stringify({ requestId, event: 'recall_bot_error', error: err.message }));
        });
      }
    } catch (recallErr: any) {
      console.error(JSON.stringify({ requestId, event: 'recall_bot_error', error: recallErr.message }));
      // Non-blocking — mode switch already succeeded.
    }
  }

  console.log(JSON.stringify({ requestId, event: 'switched_to_online', sessionId, coachId, meetLink: !!meetLink, linkSource: result.linkSource, siblingCount }));

  return NextResponse.json({
    success: true,
    session_mode: 'online',
    google_meet_link: meetLink,
    sibling_count: siblingCount,
    message: meetLink
      ? siblingCount > 0
        ? `Session switched to online. ${siblingCount} other student${siblingCount > 1 ? 's' : ''} in this batch also updated.`
        : 'Session switched to online. Google Meet link ready.'
      : 'Session switched to online.',
  });
}, { auth: 'adminOrCoach' });
