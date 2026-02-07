// ============================================================
// FILE: app/api/admin/group-classes/options/route.ts
// ============================================================
// HARDENED VERSION - Fetch Dropdown Options + Quick Add Instructor
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const createCoachSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(20).optional(),
});

// --- GET: Fetch all dropdown options ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'group_classes_options_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'group_classes_options_get_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    const [classTypesRes, coachesRes, booksRes] = await Promise.all([
      supabase
        .from('group_class_types')
        .select('id, slug, name, icon_emoji, color_hex, price_inr, duration_minutes, age_min, age_max, max_participants, requires_book')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('coaches')
        .select('id, name, email, photo_url, phone')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('books')
        .select('id, title, author, age_min, age_max, cover_image_url')
        .eq('is_active', true)
        .order('title'),
    ]);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'group_classes_options_get_success',
      classTypes: classTypesRes.data?.length || 0,
      coaches: coachesRes.data?.length || 0,
      books: booksRes.data?.length || 0,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      classTypes: classTypesRes.data || [],
      coaches: coachesRes.data || [],
      books: booksRes.data || [],
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'group_classes_options_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- POST: Quick add a new instructor/coach ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'group_classes_options_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createCoachSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { name, email, phone } = validation.data;
    const normalizedEmail = email.toLowerCase();

    console.log(JSON.stringify({ requestId, event: 'group_classes_options_post_request', adminEmail: auth.email, coachEmail: normalizedEmail }));

    const supabase = getServiceSupabase();

    // Check if coach with this email already exists
    const { data: existing } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      // Update to active if exists
      const { data: coach, error } = await supabase
        .from('coaches')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id, name, email, phone')
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update instructor' }, { status: 500 });
      }

      // Audit log
      await supabase.from('activity_log').insert({
        user_email: auth.email,
        action: 'coach_reactivated',
        details: { request_id: requestId, coach_id: existing.id, coach_email: normalizedEmail, timestamp: new Date().toISOString() },
        created_at: new Date().toISOString(),
      });

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'coach_reactivated', coachId: existing.id, duration: `${duration}ms` }));

      return NextResponse.json({ success: true, requestId, coach, reactivated: true });
    }

    // Create new coach with minimal info
    const { data: coach, error } = await supabase
      .from('coaches')
      .insert({
        name,
        email: normalizedEmail,
        phone: phone || null,
        is_active: true,
      })
      .select('id, name, email, phone')
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'coach_create_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create instructor: ' + error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'coach_quick_added',
      details: { request_id: requestId, coach_id: coach.id, coach_name: name, coach_email: normalizedEmail, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_classes_options_post_success', coachId: coach.id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, coach, created: true }, { status: 201 });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'group_classes_options_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
