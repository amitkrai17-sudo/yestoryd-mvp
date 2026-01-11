// ============================================================
// FILE: app/api/discovery/book/route.ts
// ============================================================
// HARDENED VERSION - Production Ready
// Native Discovery Booking with Auto-Assignment (Round-Robin)
// Security: Validation, Rate Limiting, Idempotency, Atomic Assignment
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { bookDiscoveryCall, deleteCalendarEvent } from '@/lib/googleCalendar';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- 1. VALIDATION SCHEMA ---
const BookDiscoverySchema = z.object({
  parentName: z.string()
    .min(2, 'Name too short')
    .max(100, 'Name too long')
    .transform(v => v.trim()),
  
  parentEmail: z.string()
    .email('Invalid email address')
    .transform(v => v.toLowerCase().trim()),
  
  parentPhone: z.string()
    .regex(/^(\+91|91)?[6-9]\d{9}$/, 'Invalid Indian mobile number')
    .transform(v => {
      const clean = v.replace(/\D/g, '');
      return clean.length === 10 ? `91${clean}` : clean;
    }),
  
  childName: z.string()
    .min(2, 'Child name too short')
    .max(100, 'Child name too long')
    .transform(v => v.trim()),
  
  childAge: z.union([z.string(), z.number()])
    .transform(v => parseInt(String(v)))
    .refine(v => v >= 4 && v <= 12, 'Child age must be 4-12 years'),
  
  childId: z.string().uuid().optional().nullable(),
  
  slotDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(v => {
      const date = new Date(v);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    }, 'Cannot book past dates'),
  
  slotTime: z.string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)')
    .refine(v => {
      const [hours] = v.split(':').map(Number);
      return hours >= 9 && hours <= 20; // 9 AM to 8 PM
    }, 'Booking hours: 9 AM - 8 PM'),
  
  source: z.string().max(50).default('lets-talk'),
});

// --- 2. TYPES ---
interface Coach {
  id: string;
  name: string;
  email: string;
  last_assigned_at?: string | null;
}

interface BookingResult {
  success: boolean;
  discoveryCallId?: string;
  calendarEventId?: string;
  meetLink?: string;
  assignedCoach?: string;
  error?: string;
}

// --- 3. RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 3; // 3 bookings per hour per email

function checkRateLimit(email: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// --- 4. IDEMPOTENCY CHECK ---
async function checkExistingBooking(
  email: string,
  slotDate: string,
  slotTime: string,
  requestId: string
): Promise<{ exists: boolean; existingId?: string }> {
  // Check for existing booking same email + same slot
  const { data: existing } = await supabase
    .from('discovery_calls')
    .select('id, status')
    .eq('parent_email', email)
    .eq('slot_date', slotDate)
    .eq('slot_time', slotTime)
    .in('status', ['scheduled', 'confirmed'])
    .maybeSingle();

  if (existing) {
    console.log(JSON.stringify({
      requestId,
      event: 'duplicate_booking_detected',
      existingId: existing.id,
    }));
    return { exists: true, existingId: existing.id };
  }

  // Also check if user has ANY upcoming booking (prevent spam)
  const { data: upcomingBooking } = await supabase
    .from('discovery_calls')
    .select('id, scheduled_at')
    .eq('parent_email', email)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (upcomingBooking) {
    console.log(JSON.stringify({
      requestId,
      event: 'existing_upcoming_booking',
      existingId: upcomingBooking.id,
      scheduledAt: upcomingBooking.scheduled_at,
    }));
    return { exists: true, existingId: upcomingBooking.id };
  }

  return { exists: false };
}

// --- 5. ATOMIC COACH ASSIGNMENT ---
async function assignCoachAtomically(
  scheduledDate: Date,
  requestId: string
): Promise<Coach | null> {
  try {
    // Use a database function for atomic assignment
    // Fallback: Manual lock with SELECT FOR UPDATE simulation
    
    // 1. Get eligible coaches
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, last_assigned_at')
      .eq('is_active', true)
      .eq('is_available', true)
      .is('exit_status', null) // Not exiting
      .order('last_assigned_at', { ascending: true, nullsFirst: true });

    if (coachError || !coaches || coaches.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_active_coaches' }));
      return null;
    }

    // 2. Filter out coaches on leave
    const dateStr = scheduledDate.toISOString().split('T')[0];
    
    for (const coach of coaches) {
      // Check leave status
      const { data: leaves } = await supabase
        .from('coach_availability')
        .select('id')
        .eq('coach_id', coach.id)
        .eq('is_available', false)
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .limit(1);

      if (leaves && leaves.length > 0) {
        console.log(JSON.stringify({
          requestId,
          event: 'coach_on_leave',
          coachId: coach.id,
          coachName: coach.name,
        }));
        continue;
      }

      // 3. Attempt atomic update (only succeeds if last_assigned_at unchanged)
      const { data: updated, error: updateError } = await supabase
        .from('coaches')
        .update({
          last_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', coach.id)
        .eq('last_assigned_at', coach.last_assigned_at) // Optimistic lock!
        .select('id, name, email, last_assigned_at')
        .single();

      if (updateError || !updated) {
        // Another request grabbed this coach, try next
        console.log(JSON.stringify({
          requestId,
          event: 'coach_assignment_race',
          coachId: coach.id,
          trying_next: true,
        }));
        continue;
      }

      console.log(JSON.stringify({
        requestId,
        event: 'coach_assigned',
        coachId: updated.id,
        coachName: updated.name,
      }));

      return updated;
    }

    console.log(JSON.stringify({ requestId, event: 'no_eligible_coaches_after_filtering' }));
    return null;

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'coach_assignment_error',
      error: error.message,
    }));
    return null;
  }
}

// --- 6. SEND NOTIFICATION (Direct, not HTTP) ---
async function sendBookingNotification(
  data: {
    phone: string;
    email: string;
    parentName: string;
    childName: string;
    scheduledAt: Date;
    meetLink: string;
    discoveryCallId: string;
  },
  requestId: string
): Promise<void> {
  try {
    // Insert into communication queue for async processing
    // This is better than self-HTTP calls
    await supabase.from('communication_queue').insert({
      template_code: 'P6_discovery_booked',
      recipient_type: 'parent',
      recipient_phone: data.phone,
      recipient_email: data.email,
      recipient_name: data.parentName,
      variables: {
        parent_name: data.parentName,
        child_name: data.childName,
        scheduled_date: data.scheduledAt.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        scheduled_time: data.scheduledAt.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        meet_link: data.meetLink || 'Link will be shared before the call',
      },
      related_entity_type: 'discovery_call',
      related_entity_id: data.discoveryCallId,
      status: 'pending',
      request_id: requestId,
    });

    console.log(JSON.stringify({
      requestId,
      event: 'notification_queued',
      template: 'P6_discovery_booked',
    }));

  } catch (error: any) {
    // Non-fatal - booking succeeded
    console.error(JSON.stringify({
      requestId,
      event: 'notification_queue_error',
      error: error.message,
    }));
  }
}

// --- 7. MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Track calendar event for potential rollback
  let calendarEventId: string | null = null;

  try {
    // 1. Parse JSON Safely
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 2. Validate Input
    const validation = BookDiscoverySchema.safeParse(rawBody);
    if (!validation.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors: validation.error.format(),
      }));
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const body = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_book_start',
      parentEmail: body.parentEmail,
      childName: body.childName,
      slot: `${body.slotDate} ${body.slotTime}`,
    }));

    // 3. Rate Limiting
    const rateCheck = checkRateLimit(body.parentEmail);
    if (!rateCheck.allowed) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        email: body.parentEmail,
      }));
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many booking attempts. Please try again later.',
          code: 'RATE_LIMITED'
        },
        { status: 429 }
      );
    }

    // 4. Idempotency Check
    const existingCheck = await checkExistingBooking(
      body.parentEmail,
      body.slotDate,
      body.slotTime,
      requestId
    );

    if (existingCheck.exists) {
      return NextResponse.json({
        success: true, // Not an error - booking exists
        message: 'You already have an upcoming discovery call scheduled',
        existingBookingId: existingCheck.existingId,
        code: 'ALREADY_BOOKED',
      });
    }

    // 5. Parse scheduled datetime
    const [hours, minutes] = body.slotTime.split(':').map(Number);
    const scheduledAt = new Date(body.slotDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    // Validate slot is still in future (with 15 min buffer)
    const minBookingTime = new Date(Date.now() + 15 * 60 * 1000);
    if (scheduledAt < minBookingTime) {
      return NextResponse.json(
        { success: false, error: 'This time slot is no longer available' },
        { status: 400 }
      );
    }

    // 6. Auto-assign coach (atomic)
    const assignedCoach = await assignCoachAtomically(scheduledAt, requestId);

    // 7. Create Google Calendar Event
    const calendarResult = await bookDiscoveryCall({
      parentName: body.parentName,
      parentEmail: body.parentEmail,
      parentPhone: body.parentPhone,
      childName: body.childName,
      childAge: body.childAge,
      slotDate: body.slotDate,
      slotTime: body.slotTime,
      coachEmail: assignedCoach?.email, // Include coach if assigned
      notes: `Source: ${body.source} | Request: ${requestId}`,
    });

    if (!calendarResult.success || !calendarResult.eventId) {
      console.error(JSON.stringify({
        requestId,
        event: 'calendar_creation_failed',
        error: calendarResult.error,
      }));
      return NextResponse.json(
        { success: false, error: 'Failed to create calendar event. Please try again.' },
        { status: 500 }
      );
    }

    // Store for potential rollback
    calendarEventId = calendarResult.eventId;

    console.log(JSON.stringify({
      requestId,
      event: 'calendar_event_created',
      eventId: calendarEventId,
    }));

    // 8. Create Discovery Call Record
    const { data: discoveryCall, error: dbError } = await supabase
      .from('discovery_calls')
      .insert({
        parent_name: body.parentName,
        parent_email: body.parentEmail,
        parent_phone: body.parentPhone,
        child_name: body.childName,
        child_age: body.childAge,
        child_id: body.childId || null,
        scheduled_at: scheduledAt.toISOString(),
        status: 'scheduled',
        booking_source: 'native',
        google_calendar_event_id: calendarEventId,
        google_meet_link: calendarResult.meetLink,
        slot_date: body.slotDate,
        slot_time: body.slotTime,
        source: body.source,
        // Coach assignment
        coach_id: assignedCoach?.id || null,
        assignment_type: assignedCoach ? 'auto' : 'pending',
        assigned_at: assignedCoach ? new Date().toISOString() : null,
        assigned_by: assignedCoach ? 'system' : null,
        // Tracking
        request_id: requestId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbError || !discoveryCall) {
      console.error(JSON.stringify({
        requestId,
        event: 'db_insert_failed',
        error: dbError?.message,
      }));

      // ROLLBACK: Delete calendar event since DB failed
      if (calendarEventId) {
        try {
          await deleteCalendarEvent(calendarEventId);
          console.log(JSON.stringify({
            requestId,
            event: 'calendar_event_rolled_back',
            eventId: calendarEventId,
          }));
        } catch (rollbackError) {
          console.error(JSON.stringify({
            requestId,
            event: 'calendar_rollback_failed',
            eventId: calendarEventId,
          }));
        }
      }

      return NextResponse.json(
        { success: false, error: 'Failed to save booking. Please try again.' },
        { status: 500 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'discovery_call_created',
      discoveryCallId: discoveryCall.id,
    }));

    // 9. Link to existing child if applicable
    if (!body.childId) {
      const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('parent_email', body.parentEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingChild) {
        await supabase
          .from('discovery_calls')
          .update({ child_id: existingChild.id })
          .eq('id', discoveryCall.id);
      }
    }

    // 10. Queue Notification (async, non-blocking)
    await sendBookingNotification(
      {
        phone: body.parentPhone,
        email: body.parentEmail,
        parentName: body.parentName,
        childName: body.childName,
        scheduledAt,
        meetLink: calendarResult.meetLink || '',
        discoveryCallId: discoveryCall.id,
      },
      requestId
    );

    // 11. Final Response
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'discovery_book_complete',
      discoveryCallId: discoveryCall.id,
      assignedCoach: assignedCoach?.name || 'pending',
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      booking: {
        id: discoveryCall.id,
        calendarEventId: calendarEventId,
        meetLink: calendarResult.meetLink,
        date: body.slotDate,
        time: body.slotTime,
        scheduledAt: scheduledAt.toISOString(),
      },
      coach: assignedCoach
        ? { assigned: true, name: assignedCoach.name }
        : { assigned: false, message: 'Coach will be assigned shortly' },
      message: `Discovery call booked for ${body.slotDate} at ${body.slotTime}`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'discovery_book_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    // Attempt calendar rollback on any error
    if (calendarEventId) {
      try {
        await deleteCalendarEvent(calendarEventId);
        console.log(JSON.stringify({
          requestId,
          event: 'calendar_event_rolled_back_on_error',
          eventId: calendarEventId,
        }));
      } catch {
        // Log but don't fail
      }
    }

    return NextResponse.json(
      { success: false, error: 'Booking failed. Please try again.' },
      { status: 500 }
    );
  }
}

// --- 8. DATABASE MIGRATION ---
/*
Run this SQL to add required columns and table:

-- Add request_id to discovery_calls for tracing
ALTER TABLE discovery_calls ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Create communication queue table (if not exists)
CREATE TABLE IF NOT EXISTS communication_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  variables JSONB DEFAULT '{}',
  related_entity_type TEXT,
  related_entity_id UUID,
  status TEXT DEFAULT 'pending',
  request_id TEXT,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_communication_queue_status ON communication_queue(status);
CREATE INDEX IF NOT EXISTS idx_communication_queue_created_at ON communication_queue(created_at);

-- Add index for idempotency check
CREATE INDEX IF NOT EXISTS idx_discovery_calls_email_slot 
ON discovery_calls(parent_email, slot_date, slot_time);

-- Add index for upcoming bookings check
CREATE INDEX IF NOT EXISTS idx_discovery_calls_email_status_scheduled 
ON discovery_calls(parent_email, status, scheduled_at);
*/