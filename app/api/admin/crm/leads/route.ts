import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all leads with details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Use the CRM view we created
    let query = supabase
      .from('crm_leads_view')
      .select('*')
      .order('assessed_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('lead_status', status);
    }

    if (search) {
      query = query.or(`child_name.ilike.%${search}%,parent_name.ilike.%${search}%,parent_email.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      // If view doesn't exist, fallback to direct query
      if (error.message.includes('crm_leads_view')) {
        const { data: fallbackData, error: fallbackError } = await supabase
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
            created_at,
            enrolled_at,
            parent:parents(name, email, phone),
            coach:coaches(name, email)
          `)
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;

        // Transform data
        const leads = (fallbackData || []).map((c: any) => ({
          id: c.id,
          child_name: c.name,
          age: c.age,
          lead_status: c.lead_status || 'assessed',
          lead_source: c.lead_source || 'website',
          last_contacted_at: c.last_contacted_at,
          next_followup_at: c.next_followup_at,
          assigned_to: c.assigned_to,
          lead_notes: c.lead_notes,
          assessed_at: c.created_at,
          enrolled_at: c.enrolled_at,
          parent_name: c.parent?.name || '',
          parent_email: c.parent?.email || '',
          parent_phone: c.parent?.phone || '',
          coach_name: c.coach?.name || null,
          coach_email: c.coach?.email || null,
          latest_assessment: null,
          interaction_count: 0,
          recent_interactions: [],
        }));

        return NextResponse.json({ leads });
      }
      throw error;
    }

    return NextResponse.json({ leads: data || [] });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
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
        changed_by: 'admin', // TODO: Get from session
      });
    }

    return NextResponse.json({ lead: data });
  } catch (error: any) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
