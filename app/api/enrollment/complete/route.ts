// app/api/enrollment/complete/route.ts
// Handles payment webhook and auto-schedules full 3-month program via Google Calendar

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleAllSessions } from '@/lib/googleCalendar';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      childName,
      childAge,
      parentName,
      parentEmail,
      parentPhone,
      paymentId,
    } = body;

    console.log(`📝 Processing enrollment for ${childName}`);

    // 1. Find available coach (least loaded, active)
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('is_active', true)
      .lt('current_students', 15)
      .order('current_students', { ascending: true })
      .limit(1)
      .single();

    if (coachError || !coach) {
      console.error('No available coach:', coachError);
      return NextResponse.json(
        { error: 'No coaches available. Please contact support.' },
        { status: 400 }
      );
    }

    console.log(`👩‍🏫 Assigned coach: ${coach.name}`);

    // 2. Create or get parent record
    let parent;
    const { data: existingParent } = await supabase
      .from('parents')
      .select('*')
      .eq('email', parentEmail)
      .single();

    if (existingParent) {
      parent = existingParent;
    } else {
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          name: parentName,
          email: parentEmail,
          phone: parentPhone,
        })
        .select()
        .single();

      if (parentError) {
        console.error('Failed to create parent:', parentError);
        return NextResponse.json({ error: 'Failed to create parent record' }, { status: 500 });
      }
      parent = newParent;
    }

    // 3. Create child record
    const { data: child, error: childError } = await supabase
      .from('children')
      .insert({
        name: childName,
        age: childAge,
        parent_id: parent.id,
        coach_id: coach.id,
        enrollment_status: 'enrolled',
      })
      .select()
      .single();

    if (childError) {
      console.error('Failed to create child:', childError);
      return NextResponse.json({ error: 'Failed to create child record' }, { status: 500 });
    }

    console.log(`👶 Child created: ${child.id}`);

    // 4. Calculate program dates
    const programStart = new Date();
    const programEnd = new Date();
    programEnd.setMonth(programEnd.getMonth() + 3);

    // 5. Schedule all 9 sessions via Google Calendar
    const scheduleResult = await scheduleAllSessions({
      childId: child.id,
      childName: childName,
      parentEmail: parentEmail,
      parentName: parentName,
      coachEmail: coach.email,
      coachName: coach.name,
      startDate: programStart,
      preferredDay: 1, // Monday (can be customized)
      preferredHour: 10, // 10 AM (can be customized)
    });

    if (!scheduleResult.success) {
      console.error('Failed to schedule sessions:', scheduleResult.error);
      // Don't fail completely - enrollment is created
    }

    console.log(`📅 Scheduled ${scheduleResult.sessions.length} sessions`);

    // 6. Save sessions to database
    const sessionRecords = scheduleResult.sessions.map(session => ({
      child_id: child.id,
      coach_id: coach.id,
      session_type: session.type,
      session_title: session.type === 'coaching' 
        ? `1:1 Coaching Session ${session.number}` 
        : `Parent Check-in ${session.number}`,
      week_number: session.week,
      scheduled_date: new Date(session.scheduledAt).toISOString().split('T')[0],
      scheduled_time: new Date(session.scheduledAt).toTimeString().slice(0, 8),
      duration_minutes: session.type === 'coaching' ? 45 : 15,
      google_event_id: session.eventId,
      google_meet_link: session.meetLink,
      status: 'scheduled',
    }));

    const { error: sessionsError } = await supabase
      .from('scheduled_sessions')
      .insert(sessionRecords);

    if (sessionsError) {
      console.error('Failed to save sessions to DB:', sessionsError);
    }

    // 7. Create enrollment record
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: child.id,
        parent_id: parent.id,
        coach_id: coach.id,
        payment_id: paymentId,
        amount: 5999,
        status: 'active',
        program_start: programStart.toISOString(),
        program_end: programEnd.toISOString(),
      })
      .select()
      .single();

    if (enrollmentError) {
      console.error('Failed to create enrollment:', enrollmentError);
    }

    // 8. Update coach student count
    await supabase
      .from('coaches')
      .update({ current_students: coach.current_students + 1 })
      .eq('id', coach.id);

    // 9. Send confirmation email
    await sendConfirmationEmail({
      parentEmail,
      parentName,
      childName,
      coachName: coach.name,
      sessions: scheduleResult.sessions,
    });

    console.log(`✅ Enrollment complete for ${childName}`);

    return NextResponse.json({
      success: true,
      childId: child.id,
      enrollmentId: enrollment?.id,
      coachName: coach.name,
      coachEmail: coach.email,
      programStart: programStart.toISOString().split('T')[0],
      programEnd: programEnd.toISOString().split('T')[0],
      sessionsScheduled: scheduleResult.sessions.length,
      sessions: scheduleResult.sessions.map(s => ({
        type: s.type,
        week: s.week,
        date: s.scheduledAt,
        meetLink: s.meetLink,
      })),
    });

  } catch (error: any) {
    console.error('Enrollment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Send confirmation email via SendGrid
async function sendConfirmationEmail({
  parentEmail,
  parentName,
  childName,
  coachName,
  sessions,
}: {
  parentEmail: string;
  parentName: string;
  childName: string;
  coachName: string;
  sessions: Array<{ type: string; week: number; scheduledAt: string; meetLink: string }>;
}) {
  try {
    const scheduleHtml = sessions
      .map(s => {
        const date = new Date(s.scheduledAt);
        return `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.type === 'coaching' ? '📚 Coaching' : '👨‍👩‍👧 Check-in'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">Week ${s.week}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>`;
      })
      .join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Welcome to Yestoryd!</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Dear ${parentName},</p>
          
          <p>Thank you for enrolling <strong>${childName}</strong> in our 3-month Reading Coaching Program!</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>👩‍🏫 Coach:</strong> ${coachName}</p>
            <p><strong>📅 Sessions:</strong> 6 coaching + 3 parent check-ins</p>
          </div>
          
          <h3>Your Schedule</h3>
          <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead>
              <tr style="background: #667eea; color: white;">
                <th style="padding: 10px; text-align: left;">Type</th>
                <th style="padding: 10px; text-align: left;">Week</th>
                <th style="padding: 10px; text-align: left;">Date</th>
                <th style="padding: 10px; text-align: left;">Time</th>
              </tr>
            </thead>
            <tbody>${scheduleHtml}</tbody>
          </table>
          
          <p style="margin-top: 20px;">All sessions have been added to your Google Calendar with Meet links.</p>
          
          <p>Best regards,<br><strong>Team Yestoryd</strong></p>
        </div>
      </body>
      </html>
    `;

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: parentEmail }] }],
        from: { email: 'hello@yestoryd.com', name: 'Yestoryd' },
        subject: `🎉 ${childName}'s Reading Journey Begins!`,
        content: [{ type: 'text/html', value: emailHtml }],
      }),
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Enrollment API ready (Google Calendar)' });
}
