// app/api/discovery-call/assign/route.ts
// Admin: Assign a coach to a discovery call

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
      discoveryCallId,
      coachId,
      assignedBy, // Admin email
    } = body;

    // Validate required fields
    if (!discoveryCallId || !coachId) {
      return NextResponse.json(
        { error: 'Missing required fields: discoveryCallId, coachId' },
        { status: 400 }
      );
    }

    // Check if discovery call exists
    const { data: existingCall, error: fetchError } = await supabase
      .from('discovery_calls')
      .select('id, status, parent_name, child_name')
      .eq('id', discoveryCallId)
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
      .select('id, name, email')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { error: 'Coach not found' },
        { status: 404 }
      );
    }

    // Update discovery call with assignment
    const { data: updatedCall, error: updateError } = await supabase
      .from('discovery_calls')
      .update({
        assigned_coach_id: coachId,
        assigned_by: assignedBy || 'admin',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', discoveryCallId)
      .select()
      .single();

    if (updateError) {
      console.error('Error assigning coach:', updateError);
      return NextResponse.json(
        { error: 'Failed to assign coach', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${coach.name} to ${existingCall.child_name}'s discovery call`,
      discoveryCall: updatedCall,
      coach: coach,
    });

  } catch (error) {
    console.error('Error in assign API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
