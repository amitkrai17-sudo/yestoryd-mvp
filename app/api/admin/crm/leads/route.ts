// ============================================================
// FILE: app/api/admin/crm/leads/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Leads API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { capitalizeName } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const getLeadsSchema = z.object({
  source: z.enum(['all', 'yestoryd', 'coach']).optional().default('all'),
  status: z.string().optional(),
  search: z.string().max(100).optional(),
});

const updateLeadSchema = z.object({
  id: z.string().uuid('Invalid lead ID'),
  lead_status: z.string().max(50).optional(),
  coach_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
  next_followup_at: z.string().datetime().optional(),
}).passthrough();

const ALLOWED_UPDATE_FIELDS = [
  'lead_status', 'coach_id', 'notes', 'next_followup_at',
  'parent_name', 'parent_phone', 'parent_email', 'age', 'grade',
];

// --- GET: Fetch leads with filters ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getLeadsSchema.safeParse({
      source: searchParams.get('source') || 'all',
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { source, status, search } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'crm_leads_request', adminEmail: auth.email, filters: { source, status } }));

    const supabase = getServiceSupabase();

    let query = supabase
      .from('children')
      .select(`
        *,
        lead_source_coach:lead_source_coach_id (id, name, email, referral_code),
        assigned_coach:coach_id (id, name, email)
      `)
      .order('created_at', { ascending: false });

    if (source !== 'all') {
      if (source === 'coach') {
        query = query.eq('lead_source', 'coach');
      } else if (source === 'yestoryd') {
        query = query.or('lead_source.eq.yestoryd,lead_source.eq.free_trial,lead_source.is.null');
      }
    }

    if (status && status !== 'all') {
      query = query.eq('lead_status', status);
    }

    if (search && search.trim()) {
      const searchTerm = search.trim().replace(/[%_]/g, '');
      query = query.or(`name.ilike.%${searchTerm}%,parent_email.ilike.%${searchTerm}%,parent_phone.ilike.%${searchTerm}%,parent_name.ilike.%${searchTerm}%`);
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    const allLeads = leads || [];
    const stats = {
      total: allLeads.length,
      yestoryd_leads: allLeads.filter(l => !l.lead_source || l.lead_source === 'yestoryd' || l.lead_source === 'free_trial').length,
      coach_leads: allLeads.filter(l => l.lead_source === 'coach').length,
      enrolled: allLeads.filter(l => l.lead_status === 'enrolled' || l.lead_status === 'active').length,
      pending: allLeads.filter(l => !['enrolled', 'active', 'completed', 'lost', 'churned'].includes(l.lead_status || '')).length,
    };

    const transformedLeads = allLeads.map(lead => {
      const isCoachLead = lead.lead_source === 'coach' && lead.lead_source_coach;
      return {
        ...lead,
        // Capitalize all names for consistent display
        name: capitalizeName(lead.name),
        child_name: capitalizeName(lead.child_name),
        parent_name: capitalizeName(lead.parent_name),
        source_display: isCoachLead ? `👤 ${capitalizeName(lead.lead_source_coach.name)}` : '🟢 Yestoryd',
        source_type: isCoachLead ? 'coach' : 'yestoryd',
        referrer_name: lead.lead_source_coach?.name ? capitalizeName(lead.lead_source_coach.name) : null,
        referrer_email: lead.lead_source_coach?.email || null,
        referrer_code: lead.lead_source_coach?.referral_code || null,
        assigned_coach_name: lead.assigned_coach?.name ? capitalizeName(lead.assigned_coach.name) : null,
      };
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_leads_success', count: transformedLeads.length, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, leads: transformedLeads, stats }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' },
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_leads_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Failed to fetch leads', requestId }, { status: 500 });
  }
}

// --- PATCH: Update a lead ---
export async function PATCH(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateLeadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { id, ...allUpdates } = validation.data;

    const updates: Record<string, any> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in allUpdates) {
        updates[field] = (allUpdates as any)[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'crm_lead_update_request', adminEmail: auth.email, leadId: id, fields: Object.keys(updates) }));

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('children')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'crm_lead_updated',
      details: { request_id: requestId, lead_id: id, fields_updated: Object.keys(updates), timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_lead_updated', leadId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, lead: data });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_lead_update_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Failed to update lead', requestId }, { status: 500 });
  }
}
