// app/api/test-calendar/route.ts
// Test endpoint to verify Google Calendar setup - DELETE AFTER TESTING

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check 1: Environment variables
  results.checks.envVars = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_CALENDAR_DELEGATED_USER: !!process.env.GOOGLE_CALENDAR_DELEGATED_USER,
  };

  const allEnvSet = Object.values(results.checks.envVars).every(v => v);
  
  if (!allEnvSet) {
    results.success = false;
    results.error = 'Missing environment variables';
    return NextResponse.json(results, { status: 500 });
  }

  // Check 2: Auth initialization
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      subject: process.env.GOOGLE_CALENDAR_DELEGATED_USER,
    });

    await auth.authorize();
    results.checks.auth = { success: true, message: 'Auth successful' };
  } catch (error: any) {
    results.checks.auth = { success: false, error: error.message };
    results.success = false;
    results.error = 'Auth failed: ' + error.message;
    return NextResponse.json(results, { status: 500 });
  }

  // Check 3: Calendar API access
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      subject: process.env.GOOGLE_CALENDAR_DELEGATED_USER,
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    const calendarList = await calendar.calendarList.list({ maxResults: 5 });
    
    results.checks.calendarAccess = {
      success: true,
      calendarsFound: calendarList.data.items?.length || 0,
      primaryCalendar: calendarList.data.items?.find(c => c.primary)?.summary,
    };
  } catch (error: any) {
    results.checks.calendarAccess = { success: false, error: error.message };
    results.success = false;
    results.error = 'Calendar access failed: ' + error.message;
    return NextResponse.json(results, { status: 500 });
  }

  // Check 4: Create test event (only if ?createTest=true)
  const { searchParams } = new URL(request.url);
  if (searchParams.get('createTest') === 'true') {
    try {
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        subject: process.env.GOOGLE_CALENDAR_DELEGATED_USER,
      });

      const calendar = google.calendar({ version: 'v3', auth });

      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 1);
      startTime.setHours(10, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      const event = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: {
          summary: '🧪 Yestoryd Test Event - DELETE ME',
          description: 'Test event to verify Google Calendar integration.',
          start: {
            dateTime: startTime.toISOString(),
            timeZone: 'Asia/Kolkata',
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Kolkata',
          },
          conferenceData: {
            createRequest: {
              requestId: `test-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      results.checks.testEvent = {
        success: true,
        eventId: event.data.id,
        meetLink: event.data.conferenceData?.entryPoints?.[0]?.uri,
        htmlLink: event.data.htmlLink,
        message: 'Test event created! Check engage@yestoryd.com calendar.',
      };
    } catch (error: any) {
      results.checks.testEvent = { success: false, error: error.message };
    }
  }

  results.success = true;
  results.message = 'All checks passed! Google Calendar is ready.';
  
  return NextResponse.json(results);
}