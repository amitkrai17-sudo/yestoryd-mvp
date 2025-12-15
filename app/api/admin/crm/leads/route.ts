import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all leads with details
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('children')
      .select(`
        id,
        name,
        age,
        lead_status,
        lead_source,
        last_contacted_at,
        next_followup_at,
        assigned_to,
        lead_notes,
        lost_reason,
        created_at,
        enrolled_at,
        coach_id,
        parent:parents(id, name, email, phone),
        coach:coaches(id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get interactions for each lead
    const childIds = data?.map(c => c.id) || [];
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .in('child_id', childIds)
      .order('created_at', { ascending: false });

    // Group interactions by child
    const interactionsByChild: Record<string, any[]> = {};
    interactions?.forEach(i => {
      if (!interactionsByChild[i.child_id]) interactionsByChild[i.child_id] = [];
      interactionsByChild[i.child_id].push(i);
    });

    // Transform data
    const leads = (data || []).map((c: any) => ({
      id: c.id,
      child_name: c.name,
      age: c.age,
      lead_status: c.lead_status || 'assessed',
      lead_source: c.lead_source || 'website',
      last_contacted_at: c.last_contacted_at,
      next_followup_at: c.next_followup_at,
      assigned_to: c.assigned_to,
      lead_notes: c.lead_notes,
      lost_reason: c.lost_reason,
      assessed_at: c.created_at,
      enrolled_at: c.enrolled_at,
      parent_id: c.parent?.id,
      parent_name: c.parent?.name || '',
      parent_email: c.parent?.email || '',
      parent_phone: c.parent?.phone || '',
      coach_id: c.coach_id,
      coach_name: c.coach?.name || null,
      coach_email: c.coach?.email || null,
      interaction_count: interactionsByChild[c.id]?.length || 0,
      recent_interactions: (interactionsByChild[c.id] || []).slice(0, 5),
    }));

    return NextResponse.json({ leads });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new lead (manual entry)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      parent_name, 
      parent_phone, 
      parent_email, 
      child_name, 
      child_age, 
      lead_source, 
      lead_notes,
      lead_status = 'assessed'
    } = body;

    // Validate required fields
    if (!parent_name || !parent_phone || !child_name || child_age === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for duplicate phone (optional - warn but allow)
    const normalizedPhone = parent_phone.replace(/\D/g, '').slice(-10);
    const { data: existingParent } = await supabase
      .from('parents')
      .select('id, phone')
      .or(`phone.ilike.%${normalizedPhone}%`)
      .maybeSingle();

    let parentId: string;

    if (existingParent) {
      // Use existing parent
      parentId = existingParent.id;
    } else {
      // Create new parent
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          name: parent_name,
          phone: parent_phone,
          email: parent_email || null,
        })
        .select()
        .single();

      if (parentError) throw parentError;
      parentId = newParent.id;
    }

    // Create child (lead)
    const { data: newChild, error: childError } = await supabase
      .from('children')
      .insert({
        parent_id: parentId,
        name: child_name,
        age: child_age,
        lead_status,
        lead_source: lead_source || 'manual',
        lead_notes,
      })
      .select()
      .single();

    if (childError) throw childError;

    return NextResponse.json({ 
      success: true, 
      lead: newChild,
      parent_existed: !!existingParent
    });
  } catch (error: any) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update lead status or details
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    // Get current status for history
    const { data: current } = await supabase
      .from('children')
      .select('lead_status')
      .eq('id', id)
      .single();

    // If marking as lost, add timestamp
    if (updates.lead_status === 'lost') {
      updates.lost_at = new Date().toISOString();
    }

    // Update the lead
    const { data, error } = await supabase
      .from('children')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change if status was updated
    if (updates.lead_status && current?.lead_status !== updates.lead_status) {
      await supabase.from('lead_status_history').insert({
        child_id: id,
        from_status: current?.lead_status,
        to_status: updates.lead_status,
        changed_by: 'admin',
        notes: updates.lost_reason || null,
      });
    }

    return NextResponse.json({ lead: data });
  } catch (error: any) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
