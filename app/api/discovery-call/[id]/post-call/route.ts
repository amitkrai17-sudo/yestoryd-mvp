// ============================================================
// FILE: app/api/discovery-call/[id]/post-call/route.ts
// ============================================================
// HARDENED VERSION - Save Post-Call Notes
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin/Coach authentication
// - Coach ownership verification
// - UUID validation
// - Input validation with Zod
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- VALIDATION SCHEMA ---
const postCallSchema = z.object({
  call_outcome: z.enum(['enrolled', 'interested', 'maybe_later', 'not_interested', 'no_show', 'rescheduled']),
  likelihood: z.enum(['high', 'medium', 'low']).optional().nullable(),
  objections: z.string().max(1000).optional().nullable(),
  concerns: z.string().max(1000).optional().nullable(),
  follow_up_notes: z.string().max(2000).optional().nullable(),
  follow_up_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional().nullable(),
  call_completed: z.boolean().optional().default(true),
});

// ============================================================
// POST: Save post-call notes
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { id } = params;

    // 1. Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid discovery call ID format' },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    const userRole = (session.user as any).role as string;
    const sessionCoachId = (session.user as any).coachId as string | undefined;

    // 3. Authorize - Admin or Coach only
    if (!['admin', 'coach'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin or Coach role required.' },
        { status: 403 }
      );
    }

    // 4. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = postCallSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    const supabase = getSupabase();

    // 5. Fetch discovery call and verify ownership
    const { data: existingCall, error: fetchError } = await supabase
      .from('discovery_calls')
      .select('id, child_id, child_name, assigned_coach_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingCall) {
      return NextResponse.json(
        { success: false, error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // 6. AUTHORIZATION: Coaches can only update their assigned calls
    if (userRole === 'coach') {
      if (existingCall.assigned_coach_id !== sessionCoachId) {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Coach tried to update unassigned call',
          userEmail,
          callId: id,
          assignedCoachId: existingCall.assigned_coach_id,
          sessionCoachId,
        }));

        return NextResponse.json(
          { success: false, error: 'You can only update calls assigned to you' },
          { status: 403 }
        );
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'post_call_save_request',
      userEmail,
      userRole,
      callId: id,
      outcome: validated.call_outcome,
    }));

    // 7. Build update data
    const updateData: Record<string, unknown> = {
      call_completed: validated.call_completed,
      call_outcome: validated.call_outcome,
      likelihood: validated.likelihood || null,
      objections: validated.objections || null,
      concerns: validated.concerns || null,
      follow_up_notes: validated.follow_up_notes || null,
      follow_up_date: validated.follow_up_date || null,
      completed_at: new Date().toISOString(),
    };

    // If enrolled, also update call_status
    if (validated.call_outcome === 'enrolled') {
      updateData.call_status = 'completed';
    }

    // 8. Update discovery call
    const { data, error: updateError } = await supabase
      .from('discovery_calls')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Post-call update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save post-call notes' },
        { status: 500 }
      );
    }

    // 9. Update child's lead_status if outcome is 'enrolled'
    if (validated.call_outcome === 'enrolled' && existingCall.child_id) {
      await supabase
        .from('children')
        .update({ lead_status: 'enrolled' })
        .eq('id', existingCall.child_id);
    }

    // 10. Audit log
    await supabase.from('activity_log').insert({
      user_email: userEmail,
      action: 'discovery_post_call_saved',
      details: {
        request_id: requestId,
        discovery_call_id: id,
        child_name: existingCall.child_name,
        outcome: validated.call_outcome,
        likelihood: validated.likelihood,
        has_objections: !!validated.objections,
        has_follow_up: !!validated.follow_up_date,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'post_call_saved',
      callId: id,
      outcome: validated.call_outcome,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        id: data.id,
        call_outcome: data.call_outcome,
        likelihood: data.likelihood,
        completed_at: data.completed_at,
      },
      message: 'Post-call notes saved successfully',
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'post_call_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

// ============================================================
// GET: Retrieve post-call notes
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();

  try {
    const { id } = params;

    // 1. Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid discovery call ID format' },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    const userRole = (session.user as any).role as string;
    const sessionCoachId = (session.user as any).coachId as string | undefined;

    // 3. Authorize - Admin or Coach only
    if (!['admin', 'coach'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin or Coach role required.' },
        { status: 403 }
      );
    }

    const supabase = getSupabase();

    // 4. Fetch discovery call
    const { data, error } = await supabase
      .from('discovery_calls')
      .select(`
        id,
        assigned_coach_id,
        call_completed,
        call_outcome,
        likelihood,
        objections,
        concerns,
        follow_up_notes,
        follow_up_date,
        completed_at
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // 5. AUTHORIZATION: Coaches can only view their assigned calls
    if (userRole === 'coach') {
      if (data.assigned_coach_id !== sessionCoachId) {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Coach tried to view unassigned call',
          userEmail,
          callId: id,
        }));

        return NextResponse.json(
          { success: false, error: 'You can only view calls assigned to you' },
          { status: 403 }
        );
      }
    }

    // Remove assigned_coach_id from response (internal field)
    const { assigned_coach_id, ...responseData } = data;

    return NextResponse.json({
      success: true,
      requestId,
      data: responseData,
    });

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'get_post_call_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

    return NextResponse.json(
      { success: false, error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}