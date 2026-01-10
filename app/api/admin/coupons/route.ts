// ============================================================
// FILE: app/api/admin/coupons/route.ts
// ============================================================
// HARDENED VERSION - Admin Coupon Management
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: Input validation, audit logging, duplicate prevention
//
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSupabase } from '@/lib/admin-auth';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION SCHEMAS ---
const getQuerySchema = z.object({
  type: z.enum(['referral', 'promo', 'all']).optional().default('all'),
  status: z.enum(['active', 'expired', 'all']).optional().default('all'),
});

const createCouponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/i, 'Code must be alphanumeric with underscores/hyphens'),
  couponType: z.enum(['fixed_discount', 'percent_discount', 'first_time', 'event', 'coach_referral', 'parent_referral']),
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  discountType: z.enum(['fixed', 'percent']).optional(),
  discountValue: z.number().min(0).max(100000).optional(),
  maxDiscount: z.number().min(0).max(100000).optional().nullable(),
  maxUses: z.number().min(1).max(10000).optional().nullable(),
  perUserLimit: z.number().min(1).max(10).default(1),
  firstEnrollmentOnly: z.boolean().default(false),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional().nullable(),
  applicableTo: z.array(z.enum(['coaching', 'elearning', 'group_classes'])).default(['coaching', 'elearning', 'group_classes']),
  minOrderValue: z.number().min(0).max(100000).default(0),
}).refine(
  data => {
    // Promo coupons require discount details
    if (['fixed_discount', 'percent_discount', 'first_time', 'event'].includes(data.couponType)) {
      return data.discountType && data.discountValue !== undefined;
    }
    return true;
  },
  { message: 'Promotional coupons require discountType and discountValue' }
).refine(
  data => {
    // Percent discount max is 100
    if (data.discountType === 'percent' && data.discountValue !== undefined) {
      return data.discountValue <= 100;
    }
    return true;
  },
  { message: 'Percent discount cannot exceed 100%' }
);

// --- GET: List all coupons with stats ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'coupons_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getQuerySchema.safeParse({
      type: searchParams.get('type') || 'all',
      status: searchParams.get('status') || 'all',
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { type, status } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'coupons_get_request', adminEmail: auth.email, type, status }));

    const supabase = getSupabase();

    let query = supabase
      .from('coupons')
      .select(`
        *,
        coach:coaches(id, name, email),
        parent:parents(id, name, email)
      `)
      .order('created_at', { ascending: false });

    // Filter by type
    if (type === 'referral') {
      query = query.in('coupon_type', ['coach_referral', 'parent_referral']);
    } else if (type === 'promo') {
      query = query.in('coupon_type', ['fixed_discount', 'percent_discount', 'first_time', 'event']);
    }

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'expired') {
      query = query.or(`is_active.eq.false,valid_until.lt.${new Date().toISOString()}`);
    }

    const { data: coupons, error } = await query;

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'coupons_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: coupons?.length || 0,
      active: coupons?.filter(c => c.is_active).length || 0,
      referrals: coupons?.filter(c => ['coach_referral', 'parent_referral'].includes(c.coupon_type)).length || 0,
      promos: coupons?.filter(c => !['coach_referral', 'parent_referral'].includes(c.coupon_type)).length || 0,
      totalUsage: coupons?.reduce((sum, c) => sum + (c.current_uses || 0), 0) || 0,
      totalDiscountGiven: coupons?.reduce((sum, c) => sum + (c.total_discount_given || 0), 0) || 0,
    };

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'coupons_get_success', count: coupons?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, coupons, stats });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'coupons_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- POST: Create new promotional coupon ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'coupons_post_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = createCouponSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const couponData = validation.data;
    const normalizedCode = couponData.code.toUpperCase().trim();

    console.log(JSON.stringify({ requestId, event: 'coupons_post_request', adminEmail: auth.email, code: normalizedCode, type: couponData.couponType }));

    const supabase = getSupabase();

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A coupon with this code already exists' }, { status: 409 });
    }

    // Create coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert({
        code: normalizedCode,
        coupon_type: couponData.couponType,
        title: couponData.title || null,
        description: couponData.description || null,
        discount_type: couponData.discountType || null,
        discount_value: couponData.discountValue || null,
        max_discount: couponData.maxDiscount || null,
        max_uses: couponData.maxUses || null,
        per_user_limit: couponData.perUserLimit,
        first_enrollment_only: couponData.firstEnrollmentOnly,
        valid_from: couponData.validFrom || new Date().toISOString(),
        valid_until: couponData.validUntil || null,
        applicable_to: couponData.applicableTo,
        min_order_value: couponData.minOrderValue,
        is_active: true,
        current_uses: 0,
        total_discount_given: 0,
      })
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'coupons_post_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'coupon_created',
      details: {
        request_id: requestId,
        coupon_id: coupon.id,
        code: normalizedCode,
        type: couponData.couponType,
        discount_type: couponData.discountType,
        discount_value: couponData.discountValue,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'coupons_post_success', couponId: coupon.id, code: normalizedCode, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, coupon }, { status: 201 });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'coupons_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- PATCH: Update existing coupon ---
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { id, ...updateData } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Coupon ID is required' }, { status: 400 });
    }

    // Validate UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid coupon ID format' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'coupons_patch_request', adminEmail: auth.email, couponId: id }));

    const supabase = getSupabase();

    // Build safe update object
    const allowedFields = ['title', 'description', 'discount_value', 'max_discount', 'max_uses', 'per_user_limit', 'valid_until', 'is_active'];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      } else if (updateData[camelField] !== undefined) {
        updates[field] = updateData[camelField];
      }
    }

    const { data: coupon, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'coupons_patch_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'coupon_updated',
      details: { request_id: requestId, coupon_id: id, fields_updated: Object.keys(updates), timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'coupons_patch_success', couponId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, coupon });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'coupons_patch_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- DELETE: Deactivate coupon (soft delete) ---
export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Valid coupon ID is required' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'coupons_delete_request', adminEmail: auth.email, couponId: id }));

    const supabase = getSupabase();

    // Soft delete - just deactivate
    const { data: coupon, error } = await supabase
      .from('coupons')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('code')
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'coupons_delete_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to deactivate coupon' }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'coupon_deactivated',
      details: { request_id: requestId, coupon_id: id, code: coupon?.code, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'coupons_delete_success', couponId: id, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, message: 'Coupon deactivated' });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'coupons_delete_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
