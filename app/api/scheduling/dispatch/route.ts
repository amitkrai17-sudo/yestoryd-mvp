// ============================================================================
// FILE: app/api/scheduling/dispatch/route.ts
// PURPOSE: Main orchestrator entry point for scheduling events
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAdminOrCoach } from '@/lib/api-auth';
import { dispatch, type SchedulingEventType } from '@/lib/scheduling/orchestrator';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes

const DispatchSchema = z.object({
  event: z.string(),
  payload: z.record(z.any()).default({}),
});

const VALID_EVENTS: SchedulingEventType[] = [
  'enrollment.created',
  'enrollment.resumed',
  'enrollment.paused',
  'enrollment.delayed_start_activated',
  'coach.unavailable',
  'coach.available',
  'coach.exit',
  'session.reschedule',
  'session.cancel',
  'session.completed',
  'session.no_show',
];

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Auth check — admin, coach, or internal API key
    const internalKey = request.headers.get('x-internal-api-key');
    const isInternalAuth = process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY;

    let auth: { authorized: boolean; email?: string | null; role?: string | null; error?: string };
    if (isInternalAuth) {
      auth = { authorized: true, email: 'engage@yestoryd.com', role: 'admin' };
    } else {
      auth = await requireAdminOrCoach();
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.error || 'Unauthorized' },
          { status: auth.email ? 403 : 401 }
        );
      }
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = DispatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { event, payload } = validation.data;

    if (!VALID_EVENTS.includes(event as SchedulingEventType)) {
      return NextResponse.json(
        { error: `Invalid event: ${event}`, validEvents: VALID_EVENTS },
        { status: 400 }
      );
    }

    // Coach-level events are restricted
    const coachOnlyEvents: SchedulingEventType[] = [
      'session.reschedule',
      'session.cancel',
      'session.completed',
      'session.no_show',
    ];
    const adminOnlyEvents: SchedulingEventType[] = [
      'coach.unavailable',
      'coach.available',
      'coach.exit',
      'enrollment.created',
      'enrollment.paused',
      'enrollment.resumed',
      'enrollment.delayed_start_activated',
    ];

    if (adminOnlyEvents.includes(event as SchedulingEventType) && !auth.role?.includes('admin')) {
      // If not admin, check admin auth
      const adminAuth = await requireAdmin();
      if (!adminAuth.authorized) {
        return NextResponse.json({ error: 'Admin access required for this event' }, { status: 403 });
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'scheduling_dispatch',
      schedulingEvent: event,
      triggeredBy: auth.email,
    }));

    // Dispatch
    const result = await dispatch(event as SchedulingEventType, {
      ...payload,
      requestId,
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'scheduling_dispatch_complete',
      schedulingEvent: event,
      success: result.success,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: result.success,
      requestId,
      event: result.event,
      data: result.data,
      error: result.error,
      duration: `${duration}ms`,
    }, {
      status: result.success ? 200 : 422,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'scheduling_dispatch_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}
