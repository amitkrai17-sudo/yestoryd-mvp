// app/api/coach/sessions/[id]/switch-to-online/route.ts
// Converts an offline/in-person session back to online mode.
// Creates Google Calendar event with Meet link and schedules Recall.ai bot.

import { NextRequest, NextResponse } from 'next/server';
import { scheduleCalendarEvent } from '@/lib/calendar/events';
import { createRecallBot } from '@/lib/recall-auto-bot';
import { withParamsHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const POST = withParamsHandler<{ id: string }>(async (request, { id: sessionId }, { auth, supabase, requestId }) => {
  const coachId = auth.coachId;
  if (!coachId) {
    return NextResponse.json({ error: 'Coach identity required' }, { status: 403 });
  }

  // 1. Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, enrollment_id, batch_id, session_mode, status, session_type, session_number, scheduled_date, scheduled_time, duration_minutes, google_event_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // 2. Validations
  if (session.coach_id !== coachId && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Session does not belong to this coach' }, { status: 403 });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({ error: 'Only scheduled sessions can be switched' }, { status: 400 });
  }

  if (session.session_mode !== 'offline') {
    return NextResponse.json({ error: 'Session is already online' }, { status: 400 });
  }

  // 3. Check for existing batch Meet link (avoid duplicate calendar events)
  let batchMeetLink: string | null = null;
  let batchCalendarEventId: string | null = null;

  if (session.batch_id) {
    const { data: batchOnboarding } = await supabase
      .from('tuition_onboarding')
      .select('meet_link, calendar_event_id')
      .eq('batch_id', session.batch_id)
      .not('meet_link', 'is', null)
      .limit(1)
      .single();

    if (batchOnboarding?.meet_link) {
      batchMeetLink = batchOnboarding.meet_link;
      batchCalendarEventId = batchOnboarding.calendar_event_id || null;
      console.log(JSON.stringify({ requestId, event: 'using_batch_meet_link', batchId: session.batch_id, meetLink: batchMeetLink }));
    }
  }

  // 4. Get child + coach details for calendar event
  const [{ data: child }, { data: coach }] = await Promise.all([
    supabase.from('children').select('child_name, parent_email').eq('id', session.child_id!).single(),
    supabase.from('coaches').select('name, email').eq('id', coachId).single(),
  ]);

  const childName = child?.child_name || 'Student';
  const coachEmail = coach?.email || '';
  const parentEmail = child?.parent_email || '';
  const duration = session.duration_minutes || 45;

  const startTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + duration);

  // 5. Create Google Calendar event with Meet link (skip if batch already has one)
  let meetLink: string | null = batchMeetLink;
  let calendarEventId: string | null = batchCalendarEventId;

  if (!batchMeetLink) {
    const attendees: string[] = [];
    if (parentEmail) attendees.push(parentEmail);
    if (coachEmail) attendees.push(coachEmail);

    try {
      const calResult = await scheduleCalendarEvent({
        title: `Yestoryd ${session.session_type || 'coaching'} - ${childName} (Session ${session.session_number || ''})`,
        description: `Reading session for ${childName} — switched to online`,
        startTime,
        endTime,
        attendees,
        sessionType: 'coaching',
      }, coachEmail || undefined);

      calendarEventId = calResult.eventId;
      meetLink = calResult.meetLink;
    } catch (calError: any) {
      console.error(JSON.stringify({ requestId, event: 'calendar_create_failed', error: calError.message }));
      // Continue without calendar — still switch mode
    }
  }

  // 6. Update session to online
  const updatePayload: Record<string, any> = {
    session_mode: 'online',
    offline_request_status: null,
    offline_request_reason: null,
    offline_reason_detail: null,
    offline_location: null,
    offline_location_type: null,
    offline_approved_by: null,
    offline_approved_at: null,
    report_deadline: null,
    updated_at: new Date().toISOString(),
  };

  if (calendarEventId) updatePayload.google_event_id = calendarEventId;
  if (meetLink) updatePayload.google_meet_link = meetLink;

  const { error: updateError } = await supabase
    .from('scheduled_sessions')
    .update(updatePayload)
    .eq('id', sessionId);

  if (updateError) {
    console.error(JSON.stringify({ requestId, event: 'switch_online_update_error', error: updateError.message }));
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }

  // 7. Batch mode switch — switch all siblings for same date to online
  let siblingCount = 0;

  if (session.batch_id && meetLink) {
    try {
      const { data: siblings } = await supabase
        .from('scheduled_sessions')
        .select('id, child_id')
        .eq('batch_id' as any, session.batch_id)
        .eq('scheduled_date', session.scheduled_date!)
        .eq('scheduled_time', session.scheduled_time!)
        .eq('session_mode', 'offline')
        .neq('id', sessionId);

      if (siblings && siblings.length > 0) {
        const siblingIds = siblings.map(s => s.id);
        const { error: siblingErr } = await supabase
          .from('scheduled_sessions')
          .update({
            session_mode: 'online',
            google_meet_link: meetLink,
            ...(calendarEventId ? { google_event_id: calendarEventId } : {}),
            offline_request_status: null,
            offline_request_reason: null,
            offline_reason_detail: null,
            offline_location: null,
            offline_location_type: null,
            offline_approved_by: null,
            offline_approved_at: null,
            report_deadline: null,
            updated_at: new Date().toISOString(),
          })
          .in('id', siblingIds);

        if (!siblingErr) {
          siblingCount = siblings.length;
          console.log(JSON.stringify({ requestId, event: 'batch_siblings_switched', batchId: session.batch_id, count: siblingCount }));
        } else {
          console.error(JSON.stringify({ requestId, event: 'batch_sibling_switch_error', error: siblingErr.message }));
        }
      }
    } catch (batchErr: any) {
      console.error(JSON.stringify({ requestId, event: 'batch_switch_error', error: batchErr.message }));
    }
  }

  // 8. Schedule Recall.ai bot
  if (meetLink) {
    try {
      if (session.batch_id) {
        // Batch: check if a bot already exists for this date
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
          // No bot for this batch+date — schedule one
          const result = await createRecallBot({
            sessionId,
            childId: session.child_id!,
            coachId,
            childName,
            meetingUrl: meetLink,
            scheduledTime: startTime,
            sessionType: 'coaching',
          });

          if (result.success && result.botId) {
            // Set recall_bot_id on ALL sessions for this batch+date
            const allSessionIds = [sessionId];
            if (session.batch_id) {
              const { data: batchSessions } = await supabase
                .from('scheduled_sessions')
                .select('id')
                .eq('batch_id' as any, session.batch_id)
                .eq('scheduled_date', session.scheduled_date!)
                .eq('scheduled_time', session.scheduled_time!);
              if (batchSessions) allSessionIds.push(...batchSessions.map(s => s.id));
            }
            await supabase
              .from('scheduled_sessions')
              .update({ recall_bot_id: result.botId, recall_status: 'scheduled' })
              .in('id', Array.from(new Set(allSessionIds)));
          }
          console.log(JSON.stringify({ requestId, event: 'recall_bot_scheduled_batch', success: result.success, botId: result.botId }));
        } else {
          console.log(JSON.stringify({ requestId, event: 'recall_bot_already_exists', batchId: session.batch_id }));
        }
      } else {
        // Non-batch: schedule bot for this individual session
        createRecallBot({
          sessionId,
          childId: session.child_id!,
          coachId,
          childName,
          meetingUrl: meetLink,
          scheduledTime: startTime,
          sessionType: 'coaching',
        }).then(result => {
          if (result.success && result.botId) {
            supabase.from('scheduled_sessions')
              .update({ recall_bot_id: result.botId, recall_status: 'scheduled' })
              .eq('id', sessionId)
              .then(() => {});
          }
          console.log(JSON.stringify({ requestId, event: 'recall_bot_scheduled', success: result.success, botId: result.botId }));
        }).catch(err => {
          console.error(JSON.stringify({ requestId, event: 'recall_bot_error', error: err.message }));
        });
      }
    } catch (recallErr: any) {
      console.error(JSON.stringify({ requestId, event: 'recall_bot_error', error: recallErr.message }));
      // Non-blocking — mode switch already succeeded
    }
  }

  console.log(JSON.stringify({ requestId, event: 'switched_to_online', sessionId, coachId, meetLink: !!meetLink, siblingCount }));

  return NextResponse.json({
    success: true,
    session_mode: 'online',
    google_meet_link: meetLink,
    sibling_count: siblingCount,
    message: meetLink
      ? siblingCount > 0
        ? `Session switched to online. ${siblingCount} other student${siblingCount > 1 ? 's' : ''} in this batch also updated.`
        : 'Session switched to online. Google Meet link created.'
      : 'Session switched to online. Calendar event could not be created — you may need to share a Meet link manually.',
  });
}, { auth: 'adminOrCoach' });
