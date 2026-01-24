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
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { conditionalUpdate } from '@/lib/db-utils';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
// Using getServiceSupabase from lib/api-auth.ts

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- VALIDATION SCHEMA ---
const postCallSchema = z.object({
  call_outcome: z.enum(['enrolled', 'follow_up', 'interested', 'maybe_later', 'not_interested', 'no_show', 'rescheduled']),
  likelihood: z.union([z.literal(''), z.enum(['hot', 'warm', 'cold', 'high', 'medium', 'low'])]).optional().nullable(),
  objections: z.string().max(1000).optional().nullable(),
  concerns: z.string().max(1000).optional().nullable(),
  follow_up_notes: z.string().max(2000).optional().nullable(),
  follow_up_date: z.union([z.string().length(0), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')]).optional().nullable(),
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

    // 2. Authenticate - Admin or Coach
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    const userEmail = auth.email!;
    const userRole = auth.role!;
    const sessionCoachId = auth.coachId;


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

    const supabase = getServiceSupabase();

    // 5. Fetch discovery call and verify ownership
    const { data: existingCall, error: fetchError } = await supabase
      .from('discovery_calls')
      .select('id, child_id, child_name, coach_id')
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
      if (existingCall.coach_id !== sessionCoachId) {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Coach tried to update unassigned call',
          userEmail,
          callId: id,
          assignedCoachId: existingCall.coach_id,
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
      updateData.status = 'completed';
    }

    // 8. Update discovery call (with ghost write prevention)
    const { updated, data, error: updateError } = await conditionalUpdate(
      'discovery_calls',
      id,
      updateData,
      ['call_outcome', 'likelihood', 'status'] // Key fields that indicate real change
    );

    if (updateError) {
      console.error('[POST_CALL] Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save post-call notes' },
        { status: 500 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: updated ? 'post_call_updated' : 'post_call_skipped_no_changes',
      callId: id,
      outcome: validated.call_outcome,
    }));

    // 9. Children sync handled by database trigger: trigger_sync_discovery_to_children

    // 10. Audit log - only create if actual update happened
    if (updated) {
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
    }

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
        id: id,
        call_outcome: validated.call_outcome,
        likelihood: validated.likelihood,
        completed_at: data?.completed_at || new Date().toISOString(),
      },
      message: updated ? 'Post-call notes saved successfully' : 'No changes detected',
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

    // 2. Authenticate - Admin or Coach
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    const userEmail = auth.email!;
    const userRole = auth.role!;
    const sessionCoachId = auth.coachId;


    const supabase = getServiceSupabase();

    // 4. Fetch discovery call
    const { data, error } = await supabase
      .from('discovery_calls')
      .select(`
        id,
        coach_id,
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
      if (data.coach_id !== sessionCoachId) {
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

    // Remove coach_id from response (internal field)
    const { coach_id, ...responseData } = data;

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
