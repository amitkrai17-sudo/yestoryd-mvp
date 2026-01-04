// app/api/discovery-call/assign/route.ts
// Assign coach to discovery call

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { discovery_call_id, coach_id } = body;

    if (!discovery_call_id || !coach_id) {
      return NextResponse.json(
        { error: 'Missing discovery_call_id or coach_id' },
        { status: 400 }
      );
    }

    // Update the discovery call with assigned coach
    const { data, error } = await supabase
      .from('discovery_calls')
      .update({
        assigned_coach_id: coach_id,
        assignment_type: 'manual',
        assigned_by: 'admin',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', discovery_call_id)
      .select(`
        *,
        assigned_coach:coaches!assigned_coach_id(id, name, email)
      `)
      .single();

    if (error) {
      console.error('Error assigning coach:', error);
      return NextResponse.json(
        { error: 'Failed to assign coach', details: error.message },
        { status: 500 }
      );
    }

    // Update coach's last_assigned_at for round-robin tracking
    await supabase
      .from('coaches')
      .update({ 
        last_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', coach_id);

    console.log(`✅ Coach assigned: ${data.assigned_coach?.name} → ${data.child_name}`);

    return NextResponse.json({
      success: true,
      message: 'Coach assigned successfully',
      discoveryCall: data,
    });

  } catch (error) {
    console.error('Error in assign API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
