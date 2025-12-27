// app/api/discovery-call/assign/route.ts
// Admin: Assign a coach to a discovery call
// UPDATED: Sets assignment_type = 'manual' for admin assignments

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      discovery_call_id, // Support both naming conventions
      discoveryCallId,
      coach_id,
      coachId,
      assignedBy, // Admin email
    } = body;

    // Support both naming conventions
    const callId = discovery_call_id || discoveryCallId;
    const targetCoachId = coach_id || coachId;

    // Validate required fields
    if (!callId || !targetCoachId) {
      return NextResponse.json(
        { error: 'Missing required fields: discoveryCallId/discovery_call_id, coachId/coach_id' },
        { status: 400 }
      );
    }

    // Check if discovery call exists
    const { data: existingCall, error: fetchError } = await supabase
      .from('discovery_calls')
      .select('id, status, parent_name, child_name, assigned_coach_id')
      .eq('id', callId)
      .single();

    if (fetchError || !existingCall) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, is_available, is_active, exit_status')
      .eq('id', targetCoachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Warn if coach is unavailable (but still allow assignment)
    const isUnavailable = coach.is_available === false || 
                          coach.is_active === false || 
                          coach.exit_status === 'pending';

    // Determine if this is a reassignment
    const isReassignment = !!existingCall.assigned_coach_id;

    // Update discovery call with assignment
    const { data: updatedCall, error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        assigned_coach_id: targetCoachId,
        assignment_type: 'manual', // Admin manual assignment
        assigned_by: assignedBy || 'admin',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId)
      .select()
      .single();

    if (updateError) {
      console.error('Error assigning coach:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign coach', details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`Coach ${isReassignment ? 'reassigned' : 'assigned'}: ${coach.name} -> ${existingCall.child_name}'s discovery call (manual)`);

    return NextResponse.json({
      success: true,
      message: `${isReassignment ? 'Reassigned' : 'Assigned'} ${coach.name} to ${existingCall.child_name}'s discovery call`,
      discoveryCall: updatedCall,
      coach: coach,
      warning: isUnavailable ? 'Note: This coach is marked as unavailable or exiting' : null,
    });
  } catch (error) {
    console.error('Error in assign API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}