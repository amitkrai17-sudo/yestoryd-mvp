// app/api/enrollment/complete/route.js
// Handles payment and auto-schedules full 3-month program

import { createClient } from '@supabase/supabase-js';
import { createSessionBooking, findNextAvailableSlot } from '@/lib/calcom';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 9 sessions: 6 coaching + 3 parent check-ins
const CURRICULUM = [
  { week: 2, type: 'coaching', title: '1:1 Coaching', duration: 45, timeSlot: 'morning' },
  { week: 4, type: 'coaching', title: '1:1 Coaching', duration: 45, timeSlot: 'morning' },
  { week: 4, type: 'parent_checkin', title: 'Parent Check-in', duration: 15, timeSlot: 'evening' },
  { week: 6, type: 'coaching', title: '1:1 Coaching', duration: 45, timeSlot: 'morning' },
  { week: 8, type: 'coaching', title: '1:1 Coaching', duration: 45, timeSlot: 'morning' },
  { week: 8, type: 'parent_checkin', title: 'Parent Check-in', duration: 15, timeSlot: 'evening' },
  { week: 10, type: 'coaching', title: '1:1 Coaching', duration: 45, timeSlot: 'morning' },
  { week: 12, type: 'coaching', title: 'Final Coaching', duration: 45, timeSlot: 'morning' },
  { week: 12, type: 'parent_checkin', title: 'Final Parent Meeting', duration: 15, timeSlot: 'evening' },
];

// Event type IDs from Cal.com
const EVENT_TYPES = {
  coaching: 4118450,
  parent_checkin: 4118474,
};

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      childName,
      childAge,
      parentName,
      parentEmail,
      parentPhone,
      paymentId, // From Razorpay
    } = body;

    // 1. Find available coach
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('is_active', true)
      .lt('current_students', 15)
      .order('current_students', { ascending: true })
      .limit(1)
      .single();

    if (coachError || !coach) {
      return Response.json({ error: 'No available coaches' }, { status: 400 });
    }

    // 2. Calculate program dates
    const programStart = new Date();
    programStart.setDate(programStart.getDate() + 2); // Start in 2 days
    const programEnd = new Date(programStart);
    programEnd.setDate(programEnd.getDate() + 84); // 12 weeks

    // 3. Create child record
    const { data: child, error: childError } = await supabase
      .from('children')
      .insert({
        name: childName,
        age: childAge,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        assigned_coach_id: coach.id,
        program_start_date: programStart.toISOString().split('T')[0],
        program_end_date: programEnd.toISOString().split('T')[0],
        subscription_status: 'active',
      })
      .select()
      .single();

    if (childError) {
      console.error('Child creation error:', childError);
      return Response.json({ error: 'Failed to create enrollment' }, { status: 500 });
    }

    // 4. Schedule all 9 sessions
    const scheduledSessions = [];
    const errors = [];

    for (const session of CURRICULUM) {
      try {
        // Calculate week start date
        const weekStart = new Date(programStart);
        weekStart.setDate(weekStart.getDate() + (session.week - 1) * 7);

        // Find available slot
        const eventTypeId = EVENT_TYPES[session.type] || EVENT_TYPES.coaching;
        const slot = await findNextAvailableSlot(eventTypeId, weekStart, session.timeSlot);

        if (!slot) {
          errors.push({ session: session.title, week: session.week, error: 'No slots available' });
          continue;
        }

        // Create Cal.com booking
        const booking = await createSessionBooking({
          eventTypeId,
          startDateTime: slot.time,
          durationMinutes: session.duration,
          childName,
          parentName,
          parentEmail,
          coachEmail: coach.email,
          sessionType: session.type,
          weekNumber: session.week,
        });

        // Save to database
        const { error: sessionError } = await supabase
          .from('scheduled_sessions')
          .insert({
            child_id: child.id,
            coach_id: coach.id,
            session_type: session.type,
            session_title: session.title,
            week_number: session.week,
            scheduled_date: slot.time.split('T')[0],
            scheduled_time: new Date(slot.time).toTimeString().slice(0, 8),
            duration_minutes: session.duration,
            cal_booking_id: booking.id?.toString(),
            google_meet_link: booking.metadata?.hangoutLink || null,
            status: 'scheduled',
          });

        if (!sessionError) {
          scheduledSessions.push({
            week: session.week,
            type: session.type,
            title: session.title,
            date: slot.time,
          });
        }
      } catch (err) {
        console.error(`Error scheduling ${session.title}:`, err);
        errors.push({ session: session.title, week: session.week, error: err.message });
      }
    }

    // 5. Update coach student count
    await supabase
      .from('coaches')
      .update({ current_students: coach.current_students + 1 })
      .eq('id', coach.id);

    return Response.json({
      success: true,
      childId: child.id,
      coachName: coach.name,
      coachEmail: coach.email,
      programStart: programStart.toISOString().split('T')[0],
      programEnd: programEnd.toISOString().split('T')[0],
      sessionsScheduled: scheduledSessions.length,
      sessions: scheduledSessions,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Enrollment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: 'Enrollment API ready' });
}
