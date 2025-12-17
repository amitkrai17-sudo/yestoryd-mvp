// app/api/discovery-call/[id]/questionnaire/route.ts
// Save questionnaire after discovery call

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const {
      callStatus, // 'completed' | 'no_show' | 'rescheduled'
      questionnaire,
      /*
      Expected questionnaire structure:
      {
        reading_frequency: 'rarely' | 'sometimes' | 'daily',
        child_attitude: 'resistant' | 'neutral' | 'enjoys',
        parent_goal: string,
        previous_support: 'none' | 'tutor' | 'app' | 'school',
        preferred_session_time: 'morning' | 'afternoon' | 'evening',
        specific_concerns: string,
        likelihood_to_enroll: 'high' | 'medium' | 'low',
        objections: string[],
        objection_details: string,
        coach_notes: string,
        recommended_focus_areas: string[]
      }
      */
    } = body;

    // Validate
    if (!callStatus) {
      return NextResponse.json(
        { error: 'Missing callStatus' },
        { status: 400 }
      );
    }

    // Check if discovery call exists
    const { data: existingCall, error: fetchError } = await supabase
      .from('discovery_calls')
      .select('id, status, child_name')
      .eq('id', id)
      .single();

    if (fetchError || !existingCall) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // Update discovery call
    const updateData: any = {
      status: callStatus,
      questionnaire: questionnaire || {},
    };

    const { data: updatedCall, error: updateError } = await supabase
      .from('discovery_calls')
      .update(updateData)
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

    // Update child lead_status if completed
    if (callStatus === 'completed') {
      await supabase
        .from('children')
        .update({ lead_status: 'discovery_completed' })
        .eq('discovery_call_id', id);
    }

    return NextResponse.json({
      success: true,
      message: `Discovery call marked as ${callStatus}`,
      discoveryCall: updatedCall,
    });

  } catch (error) {
    console.error('Error in questionnaire API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
