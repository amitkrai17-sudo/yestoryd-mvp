// ============================================================
// FILE: app/api/parent-call/schedule/route.ts
// PURPOSE: Schedule a parent call — set time, create calendar event + Recall bot
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { scheduleCalendarEvent } from '@/lib/googleCalendar';

export const dynamic = 'force-dynamic';

const CALENDAR_EMAIL = process.env.GOOGLE_CALENDAR_EMAIL || 'engage@yestoryd.com';

export async function POST(request: NextRequest) {
  try {
    const { call_id, scheduled_at } = await request.json();

    if (!call_id || !scheduled_at) {
      return NextResponse.json({ error: 'call_id and scheduled_at are required' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled_at date' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch the call with enrollment details
    const { data: call, error: callError } = await supabase
      .from('parent_calls')
      .select('id, enrollment_id, child_id, coach_id, status')
      .eq('id', call_id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Parent call not found' }, { status: 404 });
    }

    if (call.status !== 'requested') {
      return NextResponse.json({ error: `Call is already ${call.status}` }, { status: 400 });
    }

    // Fetch child + coach details for calendar event
    const [{ data: child }, { data: coach }] = await Promise.all([
      supabase.from('children').select('child_name, parent_email, parent_phone').eq('id', call.child_id!).single(),
      supabase.from('coaches').select('name, email, phone').eq('id', call.coach_id!).single(),
    ]);

    if (!child || !coach) {
      return NextResponse.json({ error: 'Missing child or coach data' }, { status: 404 });
    }

    // Get duration from site_settings
    const { data: durationSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'parent_call_duration_minutes')
      .single();

    const durationMinutes = parseInt(String(durationSetting?.value ?? '15'), 10);
    const childName = child.child_name || 'Student';

    // Create Google Calendar event
    const startTime = scheduledDate;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    let calendarResult: { eventId: string; meetLink: string };
    try {
      calendarResult = await scheduleCalendarEvent(
        {
          title: `Parent Call - ${childName} - Yestoryd`,
          description: `Parent Call for ${childName}\n\nDuration: ${durationMinutes} minutes\nCoach: ${coach.name}\n\nDiscuss your child's reading progress and any questions.`,
          startTime,
          endTime,
          attendees: [child.parent_email, coach.email, CALENDAR_EMAIL].filter((e): e is string => !!e),
          sessionType: 'coaching', // Calendar event type
        },
        coach.email // Coach as organizer
      );
    } catch (calError: any) {
      console.error('[ParentCall] Calendar creation failed:', calError);
      return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
    }

    // Update parent_calls record
    const { data: updated, error: updateError } = await supabase
      .from('parent_calls')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString(),
        duration_minutes: durationMinutes,
        google_event_id: calendarResult.eventId,
        google_meet_link: calendarResult.meetLink,
      })
      .eq('id', call_id)
      .select()
      .single();

    if (updateError) {
      console.error('[ParentCall] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
    }

    // Schedule Recall.ai bot (non-blocking)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://yestoryd.com';
      const recallRes = await fetch(`${appUrl}/api/recall/bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: call_id,
          meetingUrl: calendarResult.meetLink,
          scheduledTime: startTime.toISOString(),
          childId: call.child_id,
          coachId: call.coach_id,
          childName,
          sessionType: 'parent_call',
        }),
      });
      const recallData = await recallRes.json();
      if (recallData.botId) {
        await supabase
          .from('parent_calls')
          .update({ recall_bot_id: recallData.botId })
          .eq('id', call_id);
      }
    } catch (recallError) {
      console.error('[ParentCall] Recall bot error (non-blocking):', recallError);
    }

    // Send confirmation to parent (non-blocking)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://yestoryd.com';
      await fetch(`${appUrl}/api/communication/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'parent_call_confirmed',
          channel: 'whatsapp',
          recipient: { phone: child.parent_phone, email: child.parent_email },
          variables: {
            childName,
            coachName: coach.name,
            sessionDate: startTime.toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            }),
            sessionTime: startTime.toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', hour12: true,
            }),
            meetLink: calendarResult.meetLink,
          },
        }),
      });
    } catch (commError) {
      console.error('[ParentCall] Communication error (non-blocking):', commError);
    }

    return NextResponse.json({
      success: true,
      call: updated,
      meetLink: calendarResult.meetLink,
      message: 'Parent call scheduled. Calendar invite sent.',
    });
  } catch (error: any) {
    console.error('[ParentCall] Schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
