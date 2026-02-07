// ============================================================
// FILE: app/api/jobs/update-calendar-attendee/route.ts
// ============================================================
// HARDENED VERSION - Update Google Calendar Event Attendees
// Used when reassigning coaches to discovery calls or sessions
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - QStash signature verification (using SDK for consistency)
// - Internal API key fallback for admin testing
// - Zod validation
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

// --- VALIDATION SCHEMA ---
const CalendarUpdateSchema = z.object({
  eventId: z.string().min(1, 'Event ID required'),
  newCoachEmail: z.string().email('Invalid new coach email'),
  oldCoachEmail: z.string().email().optional(),
  requestId: z.string(),
  timestamp: z.string().optional(),
});

// --- VERIFICATION (Using SDK for consistency with other jobs) ---
async function verifyAuth(request: NextRequest, body: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check internal API key (for admin testing)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 2. Check QStash signature using SDK (consistent with enrollment-complete)
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = getReceiver();
      const isValid = await receiver.verify({ signature, body });
      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash SDK verification failed:', e);
    }
  }

  // 3. Development bypass (ONLY in dev)
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️ Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const jobRequestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Get raw body for signature verification
    const body = await request.text();

    // 2. Verify authorization (using SDK)
    const auth = await verifyAuth(request, body);
    if (!auth.isValid) {
      console.error(JSON.stringify({
        jobRequestId,
        event: 'auth_failed',
        error: 'Unauthorized calendar update request',
      }));
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 3. Parse and validate payload
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = CalendarUpdateSchema.safeParse(parsedBody);
    if (!validation.success) {
      console.error(JSON.stringify({
        jobRequestId,
        event: 'validation_failed',
        errors: validation.error.format(),
      }));
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { eventId, newCoachEmail, oldCoachEmail, requestId } = validation.data;

    console.log(JSON.stringify({
      jobRequestId,
      originalRequestId: requestId,
      event: 'calendar_update_started',
      source: auth.source,
      eventId,
      newCoachEmail,
      oldCoachEmail,
    }));

    // 4. Import Google Calendar utility
    const { updateEventAttendees } = await import('@/lib/googleCalendar');

    // 5. Update the calendar event
    const result = await updateEventAttendees(eventId, {
      addAttendees: [newCoachEmail],
      removeAttendees: oldCoachEmail ? [oldCoachEmail] : [],
    });

    if (!result.success) {
      console.error(JSON.stringify({
        jobRequestId,
        event: 'calendar_update_failed',
        error: result.error,
      }));

      // Return 200 to prevent QStash retry if event doesn't exist
      if (result.error?.includes('not found') || result.error?.includes('404')) {
        return NextResponse.json({
          success: false,
          message: 'Calendar event not found - may have been deleted',
          eventId,
        });
      }

      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // 6. Success
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      jobRequestId,
      event: 'calendar_update_complete',
      eventId,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      jobRequestId,
      eventId,
      message: 'Calendar attendees updated',
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      jobRequestId,
      event: 'calendar_update_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Calendar update failed', message: error.message },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Calendar Attendee Update Job',
    timestamp: new Date().toISOString(),
  });
}