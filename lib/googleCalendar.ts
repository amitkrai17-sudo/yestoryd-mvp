import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Initialize auth with service account + domain-wide delegation
function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });

  const authClient = auth.fromJSON({
    type: 'service_account',
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }) as any;

  // Impersonate engage@yestoryd.com
  authClient.subject = process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com';

  return authClient;
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

// Session types for the 3-month program
type SessionType = 'coaching' | 'parent-checkin';

interface SessionConfig {
  type: SessionType;
  week: number;
  title: string;
  description: string;
}

// 9 sessions over 12 weeks: 6 coaching + 3 parent check-ins
const SESSION_SCHEDULE: SessionConfig[] = [
  { type: 'coaching', week: 1, title: 'Coaching Session 1', description: 'Initial assessment and goal setting' },
  { type: 'coaching', week: 2, title: 'Coaching Session 2', description: 'Phonics and reading fundamentals' },
  { type: 'parent-checkin', week: 3, title: 'Parent Check-in 1', description: 'Progress review and home practice tips' },
  { type: 'coaching', week: 4, title: 'Coaching Session 3', description: 'Fluency building exercises' },
  { type: 'coaching', week: 6, title: 'Coaching Session 4', description: 'Comprehension strategies' },
  { type: 'parent-checkin', week: 7, title: 'Parent Check-in 2', description: 'Mid-program review and adjustments' },
  { type: 'coaching', week: 9, title: 'Coaching Session 5', description: 'Advanced reading techniques' },
  { type: 'coaching', week: 11, title: 'Coaching Session 6', description: 'Final assessment and next steps' },
  { type: 'parent-checkin', week: 12, title: 'Parent Check-in 3', description: 'Program completion and recommendations' },
];

interface CreateSessionsInput {
  childId: string;
  childName: string;
  parentEmail: string;
  parentName: string;
  coachEmail: string;
  coachName: string;
  preferredDay: number; // 0 = Sunday, 1 = Monday, etc.
  preferredTime: string; // "16:00" format
  startDate?: Date;
}

interface CreatedSession {
  sessionNumber: number;
  type: SessionType;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  googleEventId: string;
  meetLink: string;
}

// Calculate date for a specific week and day
function getSessionDate(startDate: Date, weekNumber: number, preferredDay: number): Date {
  const date = new Date(startDate);
  
  // Find first occurrence of preferred day
  const currentDay = date.getDay();
  const daysUntilPreferred = (preferredDay - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysUntilPreferred);
  
  // Add weeks
  date.setDate(date.getDate() + (weekNumber - 1) * 7);
  
  return date;
}

// Create all 9 sessions for an enrollment
export async function createAllSessions(input: CreateSessionsInput): Promise<{
  success: boolean;
  sessions?: CreatedSession[];
  error?: string;
}> {
  const calendar = getCalendar();
  const startDate = input.startDate || new Date();
  const createdSessions: CreatedSession[] = [];

  try {
    for (let i = 0; i < SESSION_SCHEDULE.length; i++) {
      const session = SESSION_SCHEDULE[i];
      const sessionDate = getSessionDate(startDate, session.week, input.preferredDay);
      
      // Parse preferred time
      const [hours, minutes] = input.preferredTime.split(':').map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);

      // End time (60 min session)
      const endDate = new Date(sessionDate);
      endDate.setMinutes(endDate.getMinutes() + 60);

      const event = {
        summary: `${session.title} - ${input.childName}`,
        description: `
${session.description}

Child: ${input.childName}
Parent: ${input.parentName}
Coach: ${input.coachName}

Powered by Yestoryd
        `.trim(),
        start: {
          dateTime: sessionDate.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        attendees: [
          { email: input.parentEmail, displayName: input.parentName },
          { email: input.coachEmail, displayName: input.coachName },
          { email: 'engage@yestoryd.com', displayName: 'Yestoryd' },
        ],
        conferenceData: {
          createRequest: {
            requestId: `yestoryd-${input.childId}-session-${i + 1}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 60 }, // 1 hour before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all', // Send invites to all attendees
      });

      createdSessions.push({
        sessionNumber: i + 1,
        type: session.type,
        title: session.title,
        scheduledDate: sessionDate.toISOString().split('T')[0],
        scheduledTime: input.preferredTime,
        googleEventId: response.data.id || '',
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri || '',
      });
    }

    return { success: true, sessions: createdSessions };
  } catch (error: any) {
    console.error('Failed to create sessions:', error);
    return { success: false, error: error.message };
  }
}

// Check coach availability for a specific slot across 12 weeks
export async function checkSlotAvailability(
  coachEmail: string,
  preferredDay: number,
  preferredTime: string,
  startDate?: Date
): Promise<{
  available: boolean;
  conflicts: number;
  conflictWeeks: number[];
}> {
  const calendar = getCalendar();
  const start = startDate || new Date();
  const conflictWeeks: number[] = [];

  try {
    for (const session of SESSION_SCHEDULE) {
      const sessionDate = getSessionDate(start, session.week, preferredDay);
      const [hours, minutes] = preferredTime.split(':').map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(sessionDate);
      endDate.setMinutes(endDate.getMinutes() + 60);

      // Check for conflicts
      const events = await calendar.events.list({
        calendarId: coachEmail,
        timeMin: sessionDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
      });

      if (events.data.items && events.data.items.length > 0) {
        conflictWeeks.push(session.week);
      }
    }

    return {
      available: conflictWeeks.length === 0,
      conflicts: conflictWeeks.length,
      conflictWeeks,
    };
  } catch (error: any) {
    console.error('Failed to check availability:', error);
    // If we can't check, assume available
    return { available: true, conflicts: 0, conflictWeeks: [] };
  }
}

// Get coach's available time slots (from Supabase or defaults)
export interface CoachAvailability {
  days: number[]; // 0-6 (Sun-Sat)
  startHour: number; // 9 = 9 AM
  endHour: number; // 18 = 6 PM
}

export function generateTimeSlots(availability: CoachAvailability): { day: number; time: string }[] {
  const slots: { day: number; time: string }[] = [];

  for (const day of availability.days) {
    for (let hour = availability.startHour; hour < availability.endHour; hour++) {
      slots.push({
        day,
        time: `${hour.toString().padStart(2, '0')}:00`,
      });
    }
  }

  return slots;
}

// Day number to name
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format time for display
export function formatTime(time: string): string {
  const [hours] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:00 ${period}`;
}