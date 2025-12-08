import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Google Calendar ID
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'c_0de0e4a8ab7314f718ce8b5e44d9f802c2dff22d52843a3899df556022784c2c@group.calendar.google.com';

// Get Google Auth Client
function getAuthClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google credentials not configured');
  }

  let formattedKey = privateKey.replace(/\\n/g, '\n');
  
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: formattedKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
}

// Convert time string to 24-hour format
function convertTo24Hour(timeStr: string): string {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      parentName,
      parentEmail,
      parentPhone,
      childName,
      selectedDate,
      selectedTime,
      notes,
      coachId,
      coachName,
      coachEmail,
      assessmentId,
    } = body;

    // Validate required fields
    if (!parentName || !parentEmail || !childName || !selectedDate || !selectedTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert time to 24-hour format
    const time24 = convertTo24Hour(selectedTime);
    
    // Create start and end times
    const startDateTime = new Date(`${selectedDate}T${time24}:00`);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 30); // 30 min session

    // Generate booking ID
    const bookingId = `book_${Date.now()}`;

    let meetLink = '';
    let eventId = '';

    // Try to create Google Calendar event
    try {
      const auth = getAuthClient();
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary: `Yestoryd: Reading Consultation - ${childName}`,
        description: `
Free 30-minute consultation session

Parent: ${parentName}
Email: ${parentEmail}
Phone: ${parentPhone}
Child: ${childName}

${notes ? `Notes: ${notes}` : ''}

Booking ID: ${bookingId}
${assessmentId ? `Assessment ID: ${assessmentId}` : ''}

---
Booked via Yestoryd Platform
        `.trim(),
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        attendees: [
          { email: parentEmail, displayName: parentName },
          { email: coachEmail || 'rucha@yestoryd.com', displayName: coachName || 'Rucha Rai' },
        ],
        conferenceData: {
          createRequest: {
            requestId: bookingId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all', // Send email invites to attendees
      });

      eventId = response.data.id || '';
      meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri || '';
      
      console.log('Calendar event created:', { eventId, meetLink });

    } catch (calendarError: any) {
      console.error('Calendar error:', calendarError.message);
      // Continue without calendar - booking still works
    }

    // Save to Google Sheets
    try {
      const auth = getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      const sheetId = process.env.GOOGLE_SHEET_ID;

      if (sheetId) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Bookings!A:L',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              bookingId,
              parentName,
              parentEmail,
              parentPhone,
              childName,
              selectedDate,
              selectedTime,
              coachId || 'coach_rucha',
              coachName || 'Rucha Rai',
              eventId,
              meetLink,
              notes || '',
              new Date().toISOString(),
              'confirmed',
            ]],
          },
        });
        console.log('Booking saved to sheets');
      }
    } catch (sheetsError: any) {
      console.error('Sheets error:', sheetsError.message);
      // Continue - calendar event was created
    }

    return NextResponse.json({
      success: true,
      bookingId,
      eventId,
      meetLink,
      message: 'Booking created successfully',
    });

  } catch (error: any) {
    console.error('Booking error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
