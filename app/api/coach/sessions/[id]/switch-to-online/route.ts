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
    .select('id, child_id, coach_id, enrollment_id, session_mode, status, session_type, session_number, scheduled_date, scheduled_time, duration_minutes, google_event_id')
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

  // 3. Get child + coach details for calendar event
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

  const attendees: string[] = [];
  if (parentEmail) attendees.push(parentEmail);
  if (coachEmail) attendees.push(coachEmail);

  // 4. Create Google Calendar event with Meet link
  let meetLink: string | null = null;
  let calendarEventId: string | null = null;

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

  // 5. Update session to online
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

  // 6. Schedule Recall.ai bot (fire-and-forget)
  if (meetLink) {
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
          .update({ recall_bot_id: result.botId })
          .eq('id', sessionId)
          .then(() => {});
      }
      console.log(JSON.stringify({ requestId, event: 'recall_bot_scheduled', success: result.success, botId: result.botId }));
    }).catch(err => {
      console.error(JSON.stringify({ requestId, event: 'recall_bot_error', error: err.message }));
    });
  }

  console.log(JSON.stringify({ requestId, event: 'switched_to_online', sessionId, coachId, meetLink: !!meetLink }));

  return NextResponse.json({
    success: true,
    session_mode: 'online',
    google_meet_link: meetLink,
    message: meetLink
      ? 'Session switched to online. Google Meet link created.'
      : 'Session switched to online. Calendar event could not be created — you may need to share a Meet link manually.',
  });
}, { auth: 'adminOrCoach' });
