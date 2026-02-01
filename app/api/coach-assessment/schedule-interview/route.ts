// app/api/coach-assessment/schedule-interview/route.ts
// Schedule interview with Google Calendar, Meet link, and tl;dv

import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { loadCoachConfig, loadIntegrationsConfig, loadEmailConfig } from '@/lib/config/loader';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Google Calendar setup (same as enrollment scheduling)
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const DELEGATED_USER = process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com';

async function getGoogleCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
    clientOptions: {
      subject: DELEGATED_USER,
    },
  });

  const calendar = google.calendar({ version: 'v3', auth });
  return calendar;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const [coachConfig, integrationsConfig, emailConfig] = await Promise.all([
      loadCoachConfig(), loadIntegrationsConfig(), loadEmailConfig(),
    ]);
    const settings = {
      interviewDurationMinutes: coachConfig.interviewDurationMinutes,
      ruchaEmail: coachConfig.defaultCoachEmail,
      adminEmail: emailConfig.fromEmail,
      siteBaseUrl: integrationsConfig.siteBaseUrl,
    };

    const {
      applicationId,
      scheduledDateTime, // ISO string
      duration = settings.interviewDurationMinutes,
      notes = ''
    } = await request.json();

    if (!applicationId || !scheduledDateTime) {
      return NextResponse.json(
        { error: 'Application ID and scheduled date/time required' },
        { status: 400 }
      );
    }

    // Fetch application
    const { data: application, error: fetchError } = await supabase
      .from('coach_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Create Google Calendar event
    const calendar = await getGoogleCalendarClient();
    
    const startTime = new Date(scheduledDateTime);
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const event = {
      summary: `Yestoryd Coach Interview - ${application.name}`,
      description: `
Coach Application Interview

Applicant: ${application.name}
Email: ${application.email}
Phone: ${application.phone}
City: ${application.city || 'Not provided'}

AI Score: ${application.ai_total_score || 'Pending'}/10

Notes: ${notes || 'None'}

---
This meeting is being recorded by tl;dv for review purposes.
      `.trim(),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: [
        { email: application.email, displayName: application.name }, // Applicant
        { email: settings.ruchaEmail, displayName: 'Rucha Rai' }, // Interviewer
        { email: settings.adminEmail, displayName: 'Yestoryd (Recording)' }, // tl;dv bot
      ],
      conferenceData: {
        createRequest: {
          requestId: `coach-interview-${applicationId}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 }, // 1 hour before
          { method: 'popup', minutes: 15 }, // 15 min before
        ],
      },
    };

    const calendarResponse = await calendar.events.insert({
      calendarId: DELEGATED_USER,
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Send invites to all attendees
    });

    const meetLink = calendarResponse.data.conferenceData?.entryPoints?.[0]?.uri || '';
    const eventId = calendarResponse.data.id;

    // Update application with interview details
    const { error: updateError } = await supabase
      .from('coach_applications')
      .update({
        status: 'interview_scheduled',
        interview_scheduled_at: startTime.toISOString(),
        interview_notes: notes,
        google_event_id: eventId,
        google_meet_link: meetLink,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Error updating application:', updateError);
    }

    // Send confirmation email to applicant
    try {
      await sgMail.send({
        to: application.email,
        from: { email: settings.adminEmail, name: 'Yestoryd Academy' },
        subject: '📅 Interview Scheduled - Yestoryd Academy',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://yestoryd.com/images/logo.png" alt="Yestoryd" style="height: 40px;" />
            </div>
            
            <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
              Great News, ${application.name}! 🎉
            </h1>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              We've reviewed your application and would love to speak with you! Your interview has been scheduled:
            </p>
            
            <div style="background: linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
              <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px;">Interview Date & Time</p>
              <p style="color: #1e293b; font-size: 20px; font-weight: bold; margin: 0;">
                ${startTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p style="color: #1e293b; font-size: 24px; font-weight: bold; margin: 8px 0 0 0;">
                ${startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} IST
              </p>
              <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">Duration: ${duration} minutes</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${meetLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Join Google Meet →
              </a>
            </div>
            
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 16px;">📋 Before the Interview:</h3>
              <ul style="color: #475569; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Ensure stable internet connection</li>
                <li>Find a quiet space</li>
                <li>Have your questions ready about the program</li>
                <li>Be ready to discuss your experience with children</li>
              </ul>
            </div>
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              You'll be speaking with Rucha, our founder. This is a casual conversation to understand your passion for helping children read better.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              Can't make it? Reply to this email at least 24 hours in advance to reschedule.
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 10px;">
              Looking forward to meeting you!<br/>
              <strong>Team Yestoryd</strong>
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Don't fail the request if email fails
    }

    // Send notification to interviewer
    try {
      await sgMail.send({
        to: settings.ruchaEmail,
        from: { email: settings.adminEmail, name: 'Yestoryd Academy' },
        subject: `📅 Coach Interview: ${application.name} - ${startTime.toLocaleDateString('en-IN')}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e293b;">Coach Interview Scheduled</h2>
            
            <table style="width: 100%; color: #475569; margin: 20px 0;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Applicant:</td><td>${application.name}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td>${application.email}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Phone:</td><td>${application.phone}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">City:</td><td>${application.city || '-'}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">AI Score:</td><td>${application.ai_total_score || 'Pending'}/10</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Date/Time:</td><td>${startTime.toLocaleString('en-IN')}</td></tr>
            </table>
            
            <a href="${meetLink}" style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Join Meet →
            </a>
            
            <p style="margin-top: 20px;">
              <a href="${settings.siteBaseUrl}/admin/coach-applications">View Application Details →</a>
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Interviewer email error:', emailError);
    }

    return NextResponse.json({
      success: true,
      interview: {
        eventId,
        meetLink,
        scheduledAt: startTime.toISOString(),
        duration,
        applicant: {
          name: application.name,
          email: application.email
        }
      }
    });

  } catch (error: any) {
    console.error('Schedule interview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
