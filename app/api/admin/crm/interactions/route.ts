import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch interactions for a child
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');

    let query = supabase
      .from('interactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (childId) {
      query = query.eq('child_id', childId);
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({ interactions: data || [] });
  } catch (error: any) {
    console.error('Error fetching interactions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new interaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { child_id, type, direction, status, summary, outcome, next_followup_at, duration_minutes, next_action } = body;

    if (!child_id || !summary) {
      return NextResponse.json({ error: 'child_id and summary are required' }, { status: 400 });
    }

    // Get parent_id from child
    const { data: child } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', child_id)
      .single();

    // Create interaction
    const { data, error } = await supabase
      .from('interactions')
      .insert({
        child_id,
        parent_id: child?.parent_id,
        type: type || 'note',
        direction: direction || 'outbound',
        status: status || 'completed',
        summary,
        outcome,
        duration_minutes,
        next_action,
        next_followup_at,
        logged_by: 'admin', // TODO: Get from session
      })
      .select()
      .single();

    if (error) throw error;

    // Update child's last_contacted_at and next_followup_at
    const childUpdates: any = {
      last_contacted_at: new Date().toISOString(),
    };

    if (next_followup_at) {
      childUpdates.next_followup_at = next_followup_at;
    }

    // If outcome is enrolled, update status
    if (outcome === 'enrolled') {
      childUpdates.lead_status = 'enrolled';
      childUpdates.enrolled_at = new Date().toISOString();
    }

    await supabase
      .from('children')
      .update(childUpdates)
      .eq('id', child_id);

    return NextResponse.json({ interaction: data });
  } catch (error: any) {
    console.error('Error creating interaction:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
