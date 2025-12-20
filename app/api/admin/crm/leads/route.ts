// file: app/api/admin/crm/leads/route.ts
// Admin CRM Leads API - with lead source tracking and coach details
// Shows which leads came from coaches vs Yestoryd marketing

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'all', 'yestoryd', 'coach'
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    console.log('📊 CRM Leads API - Filters:', { source, status, search });

    // Build query with lead source coach details
    let query = supabase
      .from('children')
      .select(`
        *,
        lead_source_coach:lead_source_coach_id (
          id,
          name,
          email,
          referral_code
        ),
        assigned_coach:coach_id (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by lead source
    if (source && source !== 'all') {
      if (source === 'coach') {
        query = query.eq('lead_source', 'coach');
      } else if (source === 'yestoryd') {
        // Include 'yestoryd', 'free_trial', NULL, and empty strings
        query = query.or('lead_source.eq.yestoryd,lead_source.eq.free_trial,lead_source.is.null');
      }
    }

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('lead_status', status);
    }

    // Search by name, email, or phone
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(`name.ilike.%${searchTerm}%,parent_email.ilike.%${searchTerm}%,parent_phone.ilike.%${searchTerm}%,parent_name.ilike.%${searchTerm}%`);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('❌ Error fetching leads:', error);
      throw error;
    }

    console.log(`✅ Found ${leads?.length || 0} leads`);

    // Calculate stats
    const allLeads = leads || [];
    const stats = {
      total: allLeads.length,
      yestoryd_leads: allLeads.filter(l => 
        !l.lead_source || l.lead_source === 'yestoryd' || l.lead_source === 'free_trial'
      ).length,
      coach_leads: allLeads.filter(l => l.lead_source === 'coach').length,
      enrolled: allLeads.filter(l => 
        l.lead_status === 'enrolled' || l.lead_status === 'active'
      ).length,
      pending: allLeads.filter(l => 
        !['enrolled', 'active', 'completed', 'lost', 'churned'].includes(l.lead_status || '')
      ).length,
    };

    // Transform leads to include formatted source info
    const transformedLeads = allLeads.map(lead => {
      // Determine source type
      const isCoachLead = lead.lead_source === 'coach' && lead.lead_source_coach;
      
      return {
        ...lead,
        // Display-friendly source
        source_display: isCoachLead
          ? `👤 ${lead.lead_source_coach.name}`
          : '🟢 Yestoryd',
        source_type: isCoachLead ? 'coach' : 'yestoryd',
        // Referrer details
        referrer_name: lead.lead_source_coach?.name || null,
        referrer_email: lead.lead_source_coach?.email || null,
        referrer_code: lead.lead_source_coach?.referral_code || null,
        // Assigned coach details
        assigned_coach_name: lead.assigned_coach?.name || null,
      };
    });

    return NextResponse.json({
      success: true,
      leads: transformedLeads,
      stats,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

  } catch (error) {
    console.error('❌ CRM Leads API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH - Update a lead
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Lead ID required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('children')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, lead: data });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}
