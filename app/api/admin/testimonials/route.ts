// ============================================================
// FILE: app/api/admin/testimonials/route.ts
// ============================================================
// HARDENED VERSION - Admin Testimonials API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: Input validation, audit logging, request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION SCHEMAS ---
const createTestimonialSchema = z.object({
  parent_name: z.string().min(1).max(100),
  parent_location: z.string().max(100).optional(),
  child_name: z.string().max(50).optional(),
  child_age: z.number().min(3).max(15).optional(),
  testimonial_text: z.string().min(10).max(2000),
  rating: z.number().min(1).max(5).default(5),
  image_url: z.string().url().max(500).optional().nullable(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
  display_order: z.number().min(0).max(100).default(0),
});

const updateTestimonialSchema = z.object({
  id: z.string().uuid('Invalid testimonial ID'),
  parent_name: z.string().min(1).max(100).optional(),
  parent_location: z.string().max(100).optional().nullable(),
  child_name: z.string().max(50).optional().nullable(),
  child_age: z.number().min(3).max(15).optional().nullable(),
  testimonial_text: z.string().min(10).max(2000).optional(),
  rating: z.number().min(1).max(5).optional(),
  image_url: z.string().url().max(500).optional().nullable(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().min(0).max(100).optional(),
});

const deleteTestimonialSchema = z.object({
  id: z.string().uuid('Invalid testimonial ID'),
});

// --- GET: Fetch all testimonials ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'testimonials_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'testimonials_get_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    const { data: testimonials, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'testimonials_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'testimonials_get_success', count: testimonials?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, testimonials });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'testimonials_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- POST: Create a new testimonial ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'testimonials_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createTestimonialSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const testimonialData = validation.data;

    console.log(JSON.stringify({ requestId, event: 'testimonials_post_request', adminEmail: auth.email, parentName: testimonialData.parent_name }));

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('testimonials')
      .insert({
        parent_name: testimonialData.parent_name,
        parent_location: testimonialData.parent_location || null,
        child_name: testimonialData.child_name || null,
        child_age: testimonialData.child_age || null,
        testimonial_text: testimonialData.testimonial_text,
        rating: testimonialData.rating,
        image_url: testimonialData.image_url || null,
        is_featured: testimonialData.is_featured,
        is_active: testimonialData.is_active,
        display_order: testimonialData.display_order,
      })
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'testimonials_post_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create testimonial' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'testimonial_created',
      details: { request_id: requestId, testimonial_id: data.id, parent_name: testimonialData.parent_name, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'testimonials_post_success', testimonialId: data.id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, testimonial: data }, { status: 201 });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'testimonials_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- PUT: Update a testimonial ---
export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'testimonials_put_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateTestimonialSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { id, ...updateData } = validation.data;

    // Build update object with only provided fields
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updateData.parent_name !== undefined) updates.parent_name = updateData.parent_name;
    if (updateData.parent_location !== undefined) updates.parent_location = updateData.parent_location;
    if (updateData.child_name !== undefined) updates.child_name = updateData.child_name;
    if (updateData.child_age !== undefined) updates.child_age = updateData.child_age;
    if (updateData.testimonial_text !== undefined) updates.testimonial_text = updateData.testimonial_text;
    if (updateData.rating !== undefined) updates.rating = updateData.rating;
    if (updateData.image_url !== undefined) updates.image_url = updateData.image_url;
    if (updateData.is_featured !== undefined) updates.is_featured = updateData.is_featured;
    if (updateData.is_active !== undefined) updates.is_active = updateData.is_active;
    if (updateData.display_order !== undefined) updates.display_order = updateData.display_order;

    console.log(JSON.stringify({ requestId, event: 'testimonials_put_request', adminEmail: auth.email, testimonialId: id, fields: Object.keys(updates) }));

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('testimonials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'testimonials_put_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'testimonial_updated',
      details: { request_id: requestId, testimonial_id: id, fields_updated: Object.keys(updates), timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'testimonials_put_success', testimonialId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, testimonial: data });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'testimonials_put_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- DELETE: Delete a testimonial ---
export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'testimonials_delete_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const validation = deleteTestimonialSchema.safeParse({ id });
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid testimonial ID', details: validation.error.flatten() }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'testimonials_delete_request', adminEmail: auth.email, testimonialId: id }));

    const supabase = getServiceSupabase();

    // Get testimonial info before deletion for audit log
    const { data: existing } = await supabase
      .from('testimonials')
      .select('parent_name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'testimonials_delete_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'testimonial_deleted',
      details: { request_id: requestId, testimonial_id: id, parent_name: existing?.parent_name || 'unknown', timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'testimonials_delete_success', testimonialId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, message: 'Testimonial deleted' });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'testimonials_delete_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
