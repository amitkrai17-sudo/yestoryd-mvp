import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAllSessions, DAY_NAMES, formatTime } from '@/lib/googleCalendar';
import { createBotsForEnrollment } from '@/lib/recall-auto-bot';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      enrollmentId,
      childId,
      preferredDay,
      preferredTime,
      confirmedBy, // 'coach' or 'admin' or 'system'
    } = body;

    // Validate required fields
    if (!enrollmentId || !childId || preferredDay === undefined || !preferredTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get enrollment details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Get child details
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('*, parents(*)')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      );
    }

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', enrollment.coach_id)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Create all 9 sessions on Google Calendar
    const result = await createAllSessions({
      childId: child.id,
      childName: child.name,
      parentEmail: child.parents?.email || child.parent_email,
      parentName: child.parents?.name || child.parent_name,
      coachEmail: coach.email,
      coachName: coach.name,
      preferredDay: parseInt(preferredDay),
      preferredTime,
      startDate: new Date(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create sessions' },
        { status: 500 }
      );
    }

    // Save sessions to Supabase
    const sessionsToInsert = result.sessions!.map((session) => ({
      enrollment_id: enrollmentId,
      child_id: childId,
      coach_id: enrollment.coach_id,
      session_number: session.sessionNumber,
      session_type: session.type,
      duration_minutes: session.type === 'coaching' ? 45 : 15, // 45 min coaching, 15 min parent check-in
      title: session.title,
      scheduled_date: session.scheduledDate,
      scheduled_time: session.scheduledTime,
      google_event_id: session.googleEventId,
      google_meet_link: session.meetLink,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToInsert);

    if (insertError) {
      console.error('Failed to save sessions to database:', insertError);
      // Don't fail - calendar events are created, we can fix DB later
    }

    // Update enrollment status
    await supabase
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        schedule_confirmed_by: confirmedBy || 'system',
        schedule_confirmed_at: new Date().toISOString(),
        preferred_day: preferredDay,
        preferred_time: preferredTime,
      })
      .eq('id', enrollmentId);

    // Update child's program dates
    const firstSession = result.sessions![0];
    const lastSession = result.sessions![result.sessions!.length - 1];

    await supabase
      .from('children')
      .update({
        program_start_date: firstSession.scheduledDate,
        program_end_date: lastSession.scheduledDate,
      })
      .eq('id', childId);

    // ============================================================
    // RECALL.AI - Schedule bots for all sessions
    // ============================================================
    let recallBotsCreated = 0;
    try {
      console.log('📹 Scheduling Recall.ai bots...');
      const botResult = await createBotsForEnrollment(enrollmentId);
      recallBotsCreated = botResult.created;
      console.log(`✅ Recall bots: ${botResult.created} created, ${botResult.failed} failed`);
      if (botResult.errors.length > 0) {
        console.error('Bot scheduling errors:', botResult.errors);
      }
    } catch (recallError) {
      console.error('⚠️ Recall.ai bot scheduling error:', recallError);
      // Don't fail - calendar events are already created
    }
    // ============================================================

    return NextResponse.json({
      success: true,
      message: `9 sessions scheduled for ${DAY_NAMES[preferredDay]}s at ${formatTime(preferredTime)}`,
      sessions: result.sessions,
      recallBotsCreated,
      firstSession: {
        date: firstSession.scheduledDate,
        time: preferredTime,
        meetLink: firstSession.meetLink,
      },
    });
  } catch (error: any) {
    console.error('Session confirmation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}