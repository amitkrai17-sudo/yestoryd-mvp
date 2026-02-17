// app/api/discovery-call/create/route.ts
// Creates a discovery call record after assessment

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      parentName,
      parentEmail,
      parentPhone,
      childName,
      childAge,
      assessmentId,
      assessmentScore,
      assessmentWpm,
      assessmentFeedback,
    } = body;

    // Validate required fields
    if (!parentName || !parentEmail || !childName) {
      return NextResponse.json(
        { error: 'Missing required fields: parentName, parentEmail, childName' },
        { status: 400 }
      );
    }

    // Check if discovery call already exists for this email + child
    const { data: existing } = await supabase
      .from('discovery_calls')
      .select('id, status')
      .eq('parent_email', parentEmail)
      .eq('child_name', childName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Discovery call already exists',
        discoveryCall: existing,
        isExisting: true,
      });
    }

    // Create discovery call record
    const { data: discoveryCall, error } = await supabase
      .from('discovery_calls')
      .insert({
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        child_name: childName,
        child_age: childAge,
        assessment_id: assessmentId,
        assessment_score: assessmentScore,
        assessment_wpm: assessmentWpm,
        assessment_feedback: assessmentFeedback,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating discovery call:', error);
      return NextResponse.json(
        { error: 'Failed to create discovery call', details: error.message },
        { status: 500 }
      );
    }

    // Update child record if exists
    await supabase
      .from('children')
      .update({ 
        lead_status: 'assessed',
        discovery_call_id: discoveryCall.id 
      })
      .eq('parent_email', parentEmail)
      .eq('child_name', childName);

    return NextResponse.json({
      success: true,
      message: 'Discovery call created',
      discoveryCall,
      isExisting: false,
    });

  } catch (error) {
    console.error('Discovery call creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
