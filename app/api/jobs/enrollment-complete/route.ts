// app/api/jobs/enrollment-complete/route.ts
// Background worker that processes enrollment after payment
// Called by QStash (not directly by users)
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { scheduleBotsForEnrollment } from '@/lib/recall-auto-bot';

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize QStash Receiver for signature verification
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// Session configuration - 9 sessions over 3 months
// 6 coaching sessions (45 min) + 3 parent check-ins (20 min)
const SESSION_CONFIG = {
  totalSessions: 9,
  coachingSessions: 6,
  parentSessions: 3,
  coachingDurationMinutes: 45,
  parentDurationMinutes: 20,
  defaultHour: 10, // 10 AM IST
  // Schedule pattern: Sessions spread across ~6 weeks
  schedule: [
    { day: 0, type: 'coaching', number: 1, week: 1 },  // Week 1: First coaching
    { day: 5, type: 'coaching', number: 2, week: 1 },  // Week 1
    { day: 10, type: 'parent', number: 1, week: 2 },  // Week 2: Parent check-in
    { day: 15, type: 'coaching', number: 3, week: 3 },  // Week 3
    { day: 20, type: 'coaching', number: 4, week: 3 },  // Week 3
    { day: 25, type: 'parent', number: 2, week: 4 },  // Week 4: Parent check-in
    { day: 30, type: 'coaching', number: 5, week: 5 },  // Week 5
    { day: 35, type: 'coaching', number: 6, week: 5 },  // Week 5
    { day: 40, type: 'parent', number: 3, week: 6 },  // Week 6: Final parent review
  ],
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Get request body
    const body = await request.text();
    const signature = request.headers.get('upstash-signature');

    // 2. Verify QStash signature (security)
    // Skip verification for direct calls or in development
    const isDirectCall = request.headers.get('x-direct-call') === 'true';
    if (process.env.NODE_ENV === 'production' && !isDirectCall) {
      try {
        const isValid = await receiver.verify({
          signature: signature || '',
          body: body,
        });

        if (!isValid) {
          console.error('❌ Invalid QStash signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch (verifyError: any) {
        console.error('❌ Signature verification failed:', verifyError.message);
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    }

    // 3. Parse job data
    const data = JSON.parse(body);
    console.log('📥 Processing enrollment-complete job:', {
      enrollmentId: data.enrollmentId,
      childName: data.childName,
      coachName: data.coachName,
    });

    // 4. Schedule Google Calendar sessions
    console.log('📅 Starting calendar scheduling...');
    const calendarResult = await scheduleCalendarSessions(data);
    console.log(`📅 Calendar result: ${calendarResult.sessionsCreated}/${SESSION_CONFIG.totalSessions} sessions`);

    // 4.5 Schedule Recall.ai bots for session recording
    console.log('🤖 Scheduling Recall.ai bots for session recording...');
    let botsScheduled = 0;
    try {
      const botResult = await scheduleBotsForEnrollment(data.enrollmentId);
      botsScheduled = botResult.botsCreated;
      console.log(`🤖 Recall bots: ${botResult.botsCreated} created, ${botResult.errors.length} errors`);

      if (botResult.errors.length > 0) {
        console.warn('⚠️ Some bot scheduling errors:', botResult.errors);
      }
    } catch (botError: any) {
      console.error('⚠️ Recall bot scheduling failed (non-fatal):', botError.message);
    }

    // 5. Send confirmation email
    console.log('📧 Sending confirmation email...');
    await sendConfirmationEmail(data, calendarResult.sessions);

    // 6. Update enrollment status in database
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        schedule_confirmed: true,
        schedule_confirmed_at: new Date().toISOString(),
        sessions_scheduled: calendarResult.sessionsCreated,
      })
      .eq('id', data.enrollmentId);

    if (updateError) {
      console.error('⚠️ Failed to update enrollment:', updateError);
    }

    // 7. Log completion
    const duration = Date.now() - startTime;
    console.log(`✅ Enrollment complete processed in ${duration}ms`, {
      enrollmentId: data.enrollmentId,
      sessionsScheduled: calendarResult.sessionsCreated,
      errors: calendarResult.errors.length,
    });

    return NextResponse.json({
      success: true,
      enrollmentId: data.enrollmentId,
      sessionsScheduled: calendarResult.sessionsCreated,
      errors: calendarResult.errors,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    console.error('❌ Enrollment complete job failed:', error);

    // Return 500 so QStash will retry (up to 3 times)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Schedule all 9 sessions in Google Calendar
 * Creates events with Google Meet links and sends invites
 */
async function scheduleCalendarSessions(data: {
  enrollmentId: string;
  childId: string;
  childName: string;
  parentEmail: string;
  parentName: string;
  coachId: string;
  coachEmail: string;
  coachName: string;
}) {
  const sessionsCreated: any[] = [];
  const errors: any[] = [];

  // Initialize Google Calendar API with service account
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/calendar']
  );

  const calendar = google.calendar({ version: 'v3', auth });

  // Start from tomorrow to give time for notifications
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(SESSION_CONFIG.defaultHour, 0, 0, 0);

  for (const session of SESSION_CONFIG.schedule) {
    try {
      // Calculate session date
      const sessionDate = new Date(startDate);
      sessionDate.setDate(sessionDate.getDate() + session.day);

      const duration = session.type === 'coaching'
        ? SESSION_CONFIG.coachingDurationMinutes
        : SESSION_CONFIG.parentDurationMinutes;

      const endDate = new Date(sessionDate);
      endDate.setMinutes(endDate.getMinutes() + duration);

      // Build event title and description
      const isCoaching = session.type === 'coaching';
      const eventTitle = isCoaching
        ? `📚 Yestoryd: ${data.childName} - Coaching Session ${session.number}`
        : `👨‍👩‍👧 Yestoryd: ${data.childName} - Parent Check-in ${session.number}`;

      const eventDescription = isCoaching
        ? `1:1 Reading Coaching Session with ${data.childName}

Coach: ${data.coachName}
Parent: ${data.parentName}
Duration: ${duration} minutes

📋 Session Focus:
- Reading practice and assessment
- Skill development exercises
- Progress tracking

💡 Tips for parents:
- Ensure a quiet environment
- Have the current reading material ready
- Note any concerns to discuss

Questions? WhatsApp: +91 89762 87997`
        : `Parent Progress Check-in for ${data.childName}

Coach: ${data.coachName}
Parent: ${data.parentName}
Duration: ${duration} minutes

📋 We'll Discuss:
- ${data.childName}'s progress over the past sessions
- Areas of improvement
- Goals for upcoming sessions
- Your questions and feedback

Questions? WhatsApp: +91 89762 87997`;

      // Create Google Calendar event with Meet link
      const event = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com', // Use delegated calendar
        conferenceDataVersion: 1,    // Enable Meet link creation
        sendUpdates: 'all',          // Send email invites to all attendees
        requestBody: {
          summary: eventTitle,
          description: eventDescription,
          start: {
            dateTime: sessionDate.toISOString(),
            timeZone: 'Asia/Kolkata',
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: 'Asia/Kolkata',
          },
          attendees: [
            { email: data.parentEmail, displayName: data.parentName },
            { email: data.coachEmail, displayName: data.coachName },
            { email: 'engage@yestoryd.com', displayName: 'Yestoryd (Recording)' }, // For tl;dv
          ],
          conferenceData: {
            createRequest: {
              requestId: `yestoryd-${data.enrollmentId}-session-${session.day}-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 }, // 24 hours before
              { method: 'email', minutes: 60 },      // 1 hour before
              { method: 'popup', minutes: 30 },      // 30 mins before
            ],
          },
          colorId: isCoaching ? '9' : '5', // Blue for coaching, Yellow for parent
        },
      });

      // Extract Meet link from response
      const meetLink = event.data.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === 'video'
      )?.uri || '';

      // Save session to database
      const { data: savedSession, error: dbError } = await supabase
        .from('scheduled_sessions')
        .insert({
          child_id: data.childId,
          coach_id: data.coachId,
          enrollment_id: data.enrollmentId,
          session_type: session.type,
          session_number: session.number,
          week_number: session.week,
          scheduled_date: sessionDate.toISOString().split('T')[0],
          scheduled_time: sessionDate.toTimeString().slice(0, 8),
          duration_minutes: duration,
          google_event_id: event.data.id,
          google_meet_link: meetLink,
          status: 'scheduled',
        })
        .select()
        .single();

      if (dbError) {
        console.error(`⚠️ DB error for session ${session.number}:`, dbError);
      }

      sessionsCreated.push({
        sessionNumber: session.number,
        type: session.type,
        week: session.week,
        date: sessionDate.toISOString(),
        meetLink,
        eventId: event.data.id,
        dbId: savedSession?.id,
      });

      console.log(`✅ Session ${session.type} #${session.number} scheduled: ${sessionDate.toLocaleDateString('en-IN')}`);

      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (calError: any) {
      console.error(`❌ Calendar error for session ${session.number}:`, calError.message);
      errors.push({
        session: session.number,
        type: session.type,
        error: calError.message,
      });

      // Continue with other sessions even if one fails
    }
  }

  return {
    sessionsCreated: sessionsCreated.length,
    sessions: sessionsCreated,
    errors,
  };
}

/**
 * Send enrollment confirmation email via SendGrid
 */
async function sendConfirmationEmail(
  data: {
    parentEmail: string;
    parentName: string;
    childName: string;
    coachName: string;
    enrollmentId: string;
  },
  sessions: any[]
) {
  try {
    // Format session list for email
    const sessionList = sessions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((s, i) => {
        const date = new Date(s.date);
        const dateStr = date.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        const icon = s.type === 'coaching' ? '📚' : '👨‍👩‍👧';
        return `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${icon} ${s.type === 'coaching' ? 'Coaching' : 'Parent Check-in'} #${s.sessionNumber}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${dateStr}</td>
        </tr>`;
      })
      .join('');

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: data.parentEmail, name: data.parentName }],
        }],
        from: {
          email: 'engage@yestoryd.com',
          name: 'Yestoryd',
        },
        reply_to: {
          email: 'support@yestoryd.com',
          name: 'Yestoryd Support',
        },
        subject: `🎉 Welcome to Yestoryd! ${data.childName}'s Reading Journey Begins`,
        content: [{
          type: 'text/html',
          value: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #FF0099; margin: 0; font-size: 28px;">Welcome to Yestoryd! 🎉</h1>
      <p style="color: #666; margin-top: 8px;">Your child's reading transformation begins now</p>
    </div>
    
    <!-- Greeting -->
    <p style="font-size: 16px; color: #333;">Hi ${data.parentName},</p>
    
    <p style="font-size: 16px; color: #333;">
      Great news! <strong style="color: #FF0099;">${data.childName}</strong> is officially enrolled in the 
      <strong>Yestoryd Reading Program</strong>.
    </p>
    
    <!-- Quick Summary Box -->
    <div style="background: linear-gradient(135deg, #FF0099 0%, #7B008B 100%); color: white; padding: 24px; border-radius: 12px; margin: 24px 0;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px;">📋 Enrollment Summary</h2>
      <table style="width: 100%; color: white;">
        <tr><td>👧 Child:</td><td><strong>${data.childName}</strong></td></tr>
        <tr><td>👩‍🏫 Coach:</td><td><strong>${data.coachName}</strong></td></tr>
        <tr><td>📅 Sessions:</td><td><strong>9 sessions over 6 weeks</strong></td></tr>
        <tr><td>⏱️ Duration:</td><td><strong>3-month program</strong></td></tr>
      </table>
    </div>
    
    <!-- Session Schedule -->
    <h2 style="color: #00ABFF; font-size: 18px; margin-top: 32px;">📅 Your Session Schedule</h2>
    <p style="color: #666; font-size: 14px;">Calendar invites have been sent to your email. Check your Google Calendar!</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Session</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Date & Time</th>
        </tr>
      </thead>
      <tbody>
        ${sessionList || '<tr><td colspan="2" style="padding: 12px; color: #666;">Sessions are being scheduled...</td></tr>'}
      </tbody>
    </table>
    
    <!-- What's Included -->
    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; color: #333;">🎁 Your Program Includes:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #555;">
        <li>📚 6 one-on-one coaching sessions (45 min each)</li>
        <li>👨‍👩‍👧 3 parent check-in calls (20 min each)</li>
        <li>📊 Real-time progress tracking in your dashboard</li>
        <li>🤖 AI-powered reading assessments</li>
        <li>🎓 Certificate upon completion</li>
      </ul>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://yestoryd.com/parent/dashboard" 
         style="background: #FF0099; color: white; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block; font-size: 16px;">
        View Your Dashboard →
      </a>
    </div>
    
    <!-- Contact Info -->
    <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 24px;">
      <p style="color: #666; font-size: 14px; margin: 0;">
        <strong>Questions?</strong> We're here to help!<br>
        📧 Email: support@yestoryd.com<br>
        💬 WhatsApp: <a href="https://wa.me/918976287997" style="color: #25D366;">+91 89762 87997</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #999; font-size: 12px;">
      <p>Let's make reading fun! 📖✨</p>
      <p>— Team Yestoryd</p>
      <p style="margin-top: 16px;">
        <a href="https://yestoryd.com" style="color: #FF0099;">yestoryd.com</a>
      </p>
    </div>
    
  </div>
</body>
</html>
          `,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid error: ${response.status} - ${errorText}`);
    }

    console.log('✅ Confirmation email sent to:', data.parentEmail);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Email send failed:', error.message);
    // Don't throw - email failure shouldn't fail the whole job
    // Sessions are already scheduled, email can be resent manually
    return { success: false, error: error.message };
  }
}


