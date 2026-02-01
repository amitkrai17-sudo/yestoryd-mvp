// ============================================================================
// FILE: app/api/admin/scheduling/queue/route.ts
// PURPOSE: Admin API for manual scheduling queue
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { getQueue, resolve } from '@/lib/scheduling/manual-queue';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - List queue items with filters
// ============================================================================

const GetSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved']).optional(),
  enrollmentId: z.string().uuid().optional(),
  coachId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => { params[key] = value; });

    const validation = GetSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const filters = validation.data;

    const result = await getQueue(filters);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error, requestId },
        { status: 500 }
      );
    }

    // Enrich with child/coach names
    const supabase = getServiceSupabase();
    const enrichedItems = [];

    for (const item of result.items) {
      let childName: string | null = null;
      let coachName: string | null = null;

      if (item.child_id) {
        const { data: child } = await supabase
          .from('children')
          .select('child_name, name')
          .eq('id', item.child_id)
          .single();
        childName = child?.child_name || child?.name || null;
      }

      if (item.coach_id) {
        const { data: coach } = await supabase
          .from('coaches')
          .select('name')
          .eq('id', item.coach_id)
          .single();
        coachName = coach?.name || null;
      }

      enrichedItems.push({
        ...item,
        child_name: childName,
        coach_name: coachName,
      });
    }

    // Stats
    const { data: statsData } = await supabase
      .from('scheduling_queue')
      .select('status');

    const stats = {
      pending: 0,
      in_progress: 0,
      resolved: 0,
      total: 0,
    };

    if (statsData) {
      for (const row of statsData) {
        const s = row.status as keyof typeof stats;
        if (s in stats) stats[s]++;
        stats.total++;
      }
    }

    return NextResponse.json({
      success: true,
      requestId,
      items: enrichedItems,
      total: result.total,
      stats,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'scheduling_queue_get_error',
      error: error.message,
    }));
    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Resolve a queue item
// ============================================================================

const ResolveSchema = z.object({
  queueId: z.string().uuid(),
  notes: z.string().min(1),
  // Optional: if resolving by scheduling the session
  newDate: z.string().optional(),
  newTime: z.string().optional(),
  newCoachId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = ResolveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { queueId, notes, newDate, newTime, newCoachId } = validation.data;

    // If admin provided a new slot, reschedule the session first
    if (newDate && newTime) {
      const supabase = getServiceSupabase();
      const { data: queueItem } = await supabase
        .from('scheduling_queue')
        .select('session_id')
        .eq('id', queueId)
        .single();

      if (queueItem?.session_id) {
        const { rescheduleSession, reassignCoach } = await import('@/lib/scheduling/session-manager');

        // Reassign coach if specified
        if (newCoachId) {
          await reassignCoach(queueItem.session_id, newCoachId, 'Admin manual resolution');
        }

        // Reschedule
        const rescheduleResult = await rescheduleSession(
          queueItem.session_id,
          { date: newDate, time: newTime },
          'Admin manual resolution'
        );

        if (!rescheduleResult.success) {
          return NextResponse.json(
            { success: false, error: `Reschedule failed: ${rescheduleResult.error}`, requestId },
            { status: 422 }
          );
        }
      }
    }

    // Resolve queue item
    const result = await resolve(queueId, {
      notes,
      resolvedBy: auth.email || 'admin',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, requestId },
        { status: 500 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'scheduling_queue_resolved',
      queueId,
      resolvedBy: auth.email,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Queue item resolved',
    });
  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'scheduling_queue_resolve_error',
      error: error.message,
    }));
    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}
