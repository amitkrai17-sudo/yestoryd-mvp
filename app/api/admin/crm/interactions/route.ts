// ============================================================
// FILE: app/api/admin/crm/interactions/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Interactions API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSupabase } from '@/lib/admin-auth';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION SCHEMAS ---
const getInteractionsSchema = z.object({
  child_id: z.string().uuid('Invalid child ID').optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const createInteractionSchema = z.object({
  child_id: z.string().uuid('Invalid child ID'),
  type: z.enum(['call', 'whatsapp', 'email', 'meeting', 'note']).default('note'),
  direction: z.enum(['inbound', 'outbound']).default('outbound'),
  status: z.enum(['completed', 'missed', 'scheduled', 'cancelled']).default('completed'),
  summary: z.string().min(1, 'Summary is required').max(2000),
  outcome: z.string().max(500).optional(),
  next_followup_at: z.string().datetime().optional().nullable(),
  duration_minutes: z.number().min(0).max(480).optional(),
  next_action: z.string().max(500).optional(),
});

// --- GET: Fetch interactions ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getInteractionsSchema.safeParse({
      child_id: searchParams.get('child_id'),
      limit: searchParams.get('limit'),
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { child_id: childId, limit } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'crm_interactions_request', adminEmail: auth.email, childId, limit }));

    const supabase = getSupabase();

    let query = supabase
      .from('interactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (childId) {
      query = query.eq('child_id', childId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_interactions_success', count: data?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, interactions: data || [] });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_interactions_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to fetch interactions', requestId }, { status: 500 });
  }
}

// --- POST: Create new interaction ---
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createInteractionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { child_id, type, direction, status, summary, outcome, next_followup_at, duration_minutes, next_action } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'crm_interaction_create_request', adminEmail: auth.email, childId: child_id, type }));

    const supabase = getSupabase();

    // Get parent_id from child
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('parent_id')
      .eq('id', child_id)
      .single();

    if (childError || !child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Create interaction
    const { data, error } = await supabase
      .from('interactions')
      .insert({
        child_id,
        parent_id: child.parent_id,
        type,
        direction,
        status,
        summary,
        outcome,
        duration_minutes,
        next_action,
        next_followup_at,
        logged_by: auth.email, // Properly tracks who logged it
      })
      .select()
      .single();

    if (error) throw error;

    // Update child's last_contacted_at and next_followup_at
    const childUpdates: Record<string, any> = {
      last_contacted_at: new Date().toISOString(),
    };

    if (next_followup_at) {
      childUpdates.next_followup_at = next_followup_at;
    }

    if (outcome === 'enrolled') {
      childUpdates.lead_status = 'enrolled';
      childUpdates.enrolled_at = new Date().toISOString();
    }

    await supabase.from('children').update(childUpdates).eq('id', child_id);

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'crm_interaction_created',
      details: { request_id: requestId, child_id, interaction_id: data.id, type, outcome, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_interaction_created', interactionId: data.id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, interaction: data });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_interaction_create_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to create interaction', requestId }, { status: 500 });
  }
}
