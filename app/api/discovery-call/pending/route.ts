// app/api/discovery-call/pending/route.ts
// Admin: Get all discovery calls with ALL coaches
// FIXED: Field name mapping for CRM compatibility

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const coachId = searchParams.get('coachId');

    let query = supabase
      .from('discovery_calls')
      .select(`
        id,
        child_name,
        child_age,
        parent_name,
        parent_email,
        parent_phone,
        scheduled_at,
        status,
        assigned_coach_id,
        assignment_type,
        assigned_by,
        assigned_at,
        assessment_score,
        questionnaire,
        payment_link_sent_at,
        followup_sent_at,
        converted_to_enrollment,
        created_at,
        booking_source,
        google_meet_link,
        slot_date,
        slot_time,
        call_completed,
        call_outcome,
        likelihood,
        objections,
        concerns,
        follow_up_notes,
        follow_up_date,
        completed_at,
        assigned_coach:coaches!assigned_coach_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by status - empty string means 'all'
    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (status === 'assigned') {
      query = query.not('assigned_coach_id', 'is', null).eq('status', 'pending');
    } else if (status === 'scheduled') {
      query = query.eq('status', 'scheduled');
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
    }
    // If status is '' or 'all', no filter - return all

    // Filter by coach if provided
    if (coachId) {
      query = query.eq('assigned_coach_id', coachId);
    }

    const { data: calls, error } = await query;

    if (error) {
      console.error('Error fetching discovery calls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch discovery calls', details: error.message },
        { status: 500 }
      );
    }

    // Transform field names to match CRM expectations
    const transformedCalls = (calls || []).map(call => ({
      ...call,
      // Map DB column names to CRM expected names
      scheduled_time: call.scheduled_at,
      call_status: call.status,
      questionnaire_data: call.questionnaire,
      // assigned_coach is already correctly named from the join
    }));

    // Get ALL coaches - no filter on is_active
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email')
      .order('name', { ascending: true });

    if (coachError) {
      console.error('Error fetching coaches:', coachError);
    }

    console.log('Coaches fetched:', coaches);

    return NextResponse.json({
      success: true,
      calls: transformedCalls,
      coaches: coaches || [],
      count: transformedCalls.length,
    });

  } catch (error) {
    console.error('Error in pending calls API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}