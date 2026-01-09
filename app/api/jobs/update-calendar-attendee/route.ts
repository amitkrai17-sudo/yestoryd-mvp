// ============================================================
// FILE: app/api/jobs/update-calendar-attendee/route.ts
// ============================================================
// Background Job: Update Google Calendar Event Attendees
// Used when reassigning coaches to discovery calls or sessions
// Yestoryd - AI-Powered Reading Intelligence Platform
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION SCHEMA ---
const CalendarUpdateSchema = z.object({
  eventId: z.string().min(1, 'Event ID required'),
  newCoachEmail: z.string().email('Invalid new coach email'),
  oldCoachEmail: z.string().email().optional(),
  requestId: z.string(),
  timestamp: z.string().optional(),
});

// --- QSTASH SIGNATURE VERIFICATION ---
async function verifyQStashSignature(
  request: NextRequest,
  body: string
): Promise<{ isValid: boolean; error?: string }> {
  // Skip verification in development
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Skipping QStash signature verification in development');
    return { isValid: true };
  }

  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    return { isValid: false, error: 'Missing upstash-signature header' };
  }

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey) {
    console.error('QSTASH_CURRENT_SIGNING_KEY not configured');
    return { isValid: false, error: 'Server configuration error' };
  }

  const keysToTry = [currentSigningKey, nextSigningKey].filter(Boolean) as string[];

  for (const key of keysToTry) {
    try {
      const [timestamp, providedSignature] = signature.split('.');
      
      const timestampMs = parseInt(timestamp) * 1000;
      const now = Date.now();
      if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
        continue;
      }

      const toSign = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', key)
        .update(toSign)
        .digest('base64');

      if (providedSignature === expectedSignature) {
        return { isValid: true };
      }
    } catch {
      continue;
    }
  }

  return { isValid: false, error: 'Invalid signature' };
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const jobRequestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Get raw body for signature verification
    const body = await request.text();

    // 2. Verify QStash signature
    const verification = await verifyQStashSignature(request, body);
    if (!verification.isValid) {
      console.error(JSON.stringify({
        jobRequestId,
        event: 'qstash_signature_invalid',
        error: verification.error,
      }));
      return NextResponse.json(
        { error: verification.error },
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
