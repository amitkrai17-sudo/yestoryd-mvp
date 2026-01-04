// =============================================================================
// FILE: app/api/discovery-call/[id]/post-call/route.ts
// PURPOSE: Save post-call notes for discovery calls
// =============================================================================

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
    const discoveryCallId = params.id;
    const body = await request.json();
    
    const {
      call_outcome,
      likelihood,
      objections,
      concerns,
      follow_up_notes,
      follow_up_date,
      call_completed,
    } = body;

    // Validate required field
    if (!call_outcome) {
      return NextResponse.json(
        { success: false, error: 'Call outcome is required' },
        { status: 400 }
      );
    }

    // Update discovery_calls record
    const updateData: Record<string, unknown> = {
      call_completed: call_completed ?? true,
      call_outcome,
      likelihood: likelihood || null,
      objections: objections || null,
      concerns: concerns || null,
      follow_up_notes: follow_up_notes || null,
      follow_up_date: follow_up_date || null,
      completed_at: new Date().toISOString(),
    };

    // If enrolled, also update call_status
    if (call_outcome === 'enrolled') {
      updateData.call_status = 'completed';
    }

    const { data, error } = await supabase
      .from('discovery_calls')
      .update(updateData)
      .eq('id', discoveryCallId)
      .select()
      .single();

    if (error) {
      console.error('[API] Post-call update error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save post-call notes' },
        { status: 500 }
      );
    }

    // If outcome is 'enrolled', also update the child's lead_status if linked
    if (call_outcome === 'enrolled' && data.child_id) {
      await supabase
        .from('children')
        .update({ lead_status: 'enrolled' })
        .eq('id', data.child_id);
    }

    // Log for analytics (optional)
    console.log(`[Discovery Call ${discoveryCallId}] Post-call notes saved:`, {
      outcome: call_outcome,
      likelihood,
      hasObjections: !!objections,
      hasConcerns: !!concerns,
      hasFollowUp: !!follow_up_date,
    });

    return NextResponse.json({
      success: true,
      data,
      message: 'Post-call notes saved successfully',
    });

  } catch (error) {
    console.error('[API] Post-call error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Retrieve post-call notes
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const discoveryCallId = params.id;

    const { data, error } = await supabase
      .from('discovery_calls')
      .select(`
        id,
        call_completed,
        call_outcome,
        likelihood,
        objections,
        concerns,
        follow_up_notes,
        follow_up_date,
        completed_at
      `)
      .eq('id', discoveryCallId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('[API] Get post-call error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
