// ============================================================
// FILE: app/api/admin/pricing/route.ts
// ============================================================
// HARDENED VERSION - Admin Pricing Plans API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: Input validation, audit logging, request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  original_price: z.number().min(0).max(1000000),
  discounted_price: z.number().min(0).max(1000000).optional(),
  discount_label: z.string().max(50).optional(),
  duration_months: z.number().min(1).max(24).default(3),
  sessions_included: z.number().min(1).max(100).default(9),
  features: z.array(z.string().max(200)).max(20).default([]),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  offer_valid_until: z.string().datetime().optional().nullable(),
  display_order: z.number().min(0).max(100).optional(),
});

const updatePlanSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  original_price: z.number().min(0).max(1000000).optional(),
  discounted_price: z.number().min(0).max(1000000).optional().nullable(),
  discount_label: z.string().max(50).optional().nullable(),
  duration_months: z.number().min(1).max(24).optional(),
  sessions_included: z.number().min(1).max(100).optional(),
  features: z.array(z.string().max(200)).max(20).optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  offer_valid_until: z.string().datetime().optional().nullable(),
  display_order: z.number().min(0).max(100).optional(),
});

// --- GET: Fetch all pricing plans ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'pricing_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'pricing_get_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    const { data: plans, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'pricing_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch pricing plans' }, { status: 500 });
    }

    // Parse features JSON for each plan
    const parsedPlans = plans?.map(plan => ({
      ...plan,
      features: typeof plan.features === 'string'
        ? JSON.parse(plan.features)
        : plan.features || []
    }));

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'pricing_get_success', count: parsedPlans?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, plans: parsedPlans });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'pricing_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- POST: Create a new pricing plan ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'pricing_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createPlanSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const planData = validation.data;

    console.log(JSON.stringify({ requestId, event: 'pricing_post_request', adminEmail: auth.email, planName: planData.name }));

    const supabase = getServiceSupabase();

    // Check for duplicate slug
    const { data: existing } = await supabase
      .from('pricing_plans')
      .select('id')
      .eq('slug', planData.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A plan with this slug already exists' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .insert({
        name: planData.name,
        slug: planData.slug,
        description: planData.description || null,
        original_price: planData.original_price,
        discounted_price: planData.discounted_price || 0,
        discount_label: planData.discount_label || null,
        duration_months: planData.duration_months,
        sessions_included: planData.sessions_included,
        features: JSON.stringify(planData.features),
        is_active: planData.is_active,
        is_featured: planData.is_featured,
        offer_valid_until: planData.offer_valid_until || null,
        display_order: planData.display_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'pricing_post_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create pricing plan' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'pricing_plan_created',
      metadata: { request_id: requestId, plan_id: data.id, plan_name: planData.name, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'pricing_post_success', planId: data.id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, plan: data }, { status: 201 });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'pricing_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- PUT: Update a pricing plan ---
export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'pricing_put_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updatePlanSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { id, ...updateData } = validation.data;

    // Build update object with only provided fields
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.original_price !== undefined) updates.original_price = updateData.original_price;
    if (updateData.discounted_price !== undefined) updates.discounted_price = updateData.discounted_price;
    if (updateData.discount_label !== undefined) updates.discount_label = updateData.discount_label;
    if (updateData.duration_months !== undefined) updates.duration_months = updateData.duration_months;
    if (updateData.sessions_included !== undefined) updates.sessions_included = updateData.sessions_included;
    if (updateData.features !== undefined) updates.features = JSON.stringify(updateData.features);
    if (updateData.is_active !== undefined) updates.is_active = updateData.is_active;
    if (updateData.is_featured !== undefined) updates.is_featured = updateData.is_featured;
    if (updateData.offer_valid_until !== undefined) updates.offer_valid_until = updateData.offer_valid_until;
    if (updateData.display_order !== undefined) updates.display_order = updateData.display_order;

    console.log(JSON.stringify({ requestId, event: 'pricing_put_request', adminEmail: auth.email, planId: id, fields: Object.keys(updates) }));

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('pricing_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'pricing_put_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to update pricing plan' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Pricing plan not found' }, { status: 404 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'pricing_plan_updated',
      metadata: { request_id: requestId, plan_id: id, fields_updated: Object.keys(updates), timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'pricing_put_success', planId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, plan: data });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'pricing_put_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
