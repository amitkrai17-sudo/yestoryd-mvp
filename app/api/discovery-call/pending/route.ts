// app/api/discovery-call/pending/route.ts
// Admin: Get all discovery calls with ALL coaches

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const coachId = searchParams.get('coachId');

    let query = supabase
      .from('discovery_calls')
      .select(`
        *,
        coach:coaches!assigned_coach_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by status
    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (status === 'assigned') {
      query = query.not('assigned_coach_id', 'is', null).eq('status', 'pending');
    } else if (status === 'scheduled') {
      query = query.eq('status', 'scheduled');
    } else if (status === 'completed') {
      query = query.eq('status', 'completed');
    } else if (status === 'all') {
      // No filter - return all
    }

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

    // Get ALL coaches - no filter on is_active
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email')
      .order('name', { ascending: true });

    if (coachError) {
      console.error('Error fetching coaches:', coachError);
    }

    console.log('Coaches fetched:', coaches); // Debug log

    return NextResponse.json({
      success: true,
      calls: calls || [],
      coaches: coaches || [],
      count: calls?.length || 0,
    });

  } catch (error) {
    console.error('Error in pending calls API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
