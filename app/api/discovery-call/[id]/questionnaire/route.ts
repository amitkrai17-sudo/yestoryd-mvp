// ============================================================
// FILE: app/api/discovery-call/[id]/questionnaire/route.ts
// ============================================================
// HARDENED VERSION - Save Questionnaire After Discovery Call
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin/Coach authentication
// - Coach ownership verification
// - UUID validation
// - Input validation
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- VALIDATION SCHEMA ---
const questionnaireSchema = z.object({
  callStatus: z.enum(['completed', 'no_show', 'rescheduled']),
  questionnaire: z.object({
    reading_frequency: z.enum(['rarely', 'sometimes', 'daily', '']).optional(),
    child_attitude: z.enum(['resistant', 'neutral', 'enjoys', '']).optional(),
    parent_goal: z.string().max(500).optional(),
    previous_support: z.enum(['none', 'tutor', 'app', 'school', '']).optional(),
    preferred_session_time: z.enum(['morning', 'afternoon', 'evening', '']).optional(),
    specific_concerns: z.string().max(1000).optional(),
    likelihood_to_enroll: z.enum(['high', 'medium', 'low', '']).optional(),
    objections: z.array(z.string().max(100)).max(10).optional(),
    objection_details: z.string().max(1000).optional(),
    coach_notes: z.string().max(2000).optional(),
    recommended_focus_areas: z.array(z.string().max(100)).max(10).optional(),
  }).optional().default({}),
});

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
        { error: 'Invalid discovery call ID format' },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userEmail = auth.email || '';
    const userRole = auth.role || 'coach';
    const sessionCoachId = auth.coachId;

    // 3. Authorize - Admin or Coach only
    if (!['admin', 'coach'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Access denied. Admin or Coach role required.' },
        { status: 403 }
      );
    }

    // 4. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = questionnaireSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { callStatus, questionnaire } = validationResult.data;

    const supabase = getServiceSupabase();

    // 5. Fetch discovery call and verify ownership
    const { data: existingCall, error: fetchError } = await supabase
      .from('discovery_calls')
      .select('id, status, child_id, child_name, coach_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingCall) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
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
          { error: 'You can only update calls assigned to you' },
          { status: 403 }
        );
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'questionnaire_save_request',
      userEmail,
      userRole,
      callId: id,
      callStatus,
    }));

    // 7. Update discovery call
    const { data: updatedCall, error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        status: callStatus,
        questionnaire: questionnaire,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error saving questionnaire:', updateError);
      return NextResponse.json(
        { error: 'Failed to save questionnaire', details: updateError.message },
        { status: 500 }
      );
    }

    // 8. Update child lead_status if completed
    if (callStatus === 'completed' && existingCall.child_id) {
      await supabase
        .from('children')
        .update({ lead_status: 'discovery_completed' })
        .eq('id', existingCall.child_id);
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'questionnaire_saved',
      callId: id,
      callStatus,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `Discovery call marked as ${callStatus}`,
      discoveryCall: {
        id: updatedCall.id,
        status: updatedCall.status,
        child_name: updatedCall.child_name,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'questionnaire_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}










