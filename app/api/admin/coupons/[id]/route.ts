// =============================================================================
// FILE: app/api/admin/coupons/[id]/route.ts
// PURPOSE: Single coupon CRUD operations (GET, PATCH, DELETE)
// PATTERN: Next.js 15 compatible with async params
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Get single coupon with usage history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params is now a Promise
    const { id } = await params;

    const { data: coupon, error } = await supabase
      .from('coupons')
      .select(`
        *,
        coach:coaches(id, name, email),
        parent:parents(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    // Get usage history
    const { data: usages } = await supabase
      .from('coupon_usages')
      .select(`
        *,
        parent:parents(name, email),
        child:children(child_name)
      `)
      .eq('coupon_id', id)
      .order('used_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ coupon, usages: usages || [] });

  } catch (error) {
    console.error('Coupon GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update coupon
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Fields that can be updated
    const allowedUpdates = [
      'title',
      'description',
      'discount_value',
      'max_discount',
      'max_uses',
      'per_user_limit',
      'first_enrollment_only',
      'valid_from',
      'valid_until',
      'applicable_to',
      'min_order_value',
      'is_active',
      'notes',
    ];

    // Filter to allowed fields only
    const updates: Record<string, unknown> = {};
    for (const key of allowedUpdates) {
      // Convert camelCase to snake_case
      const snakeKey = key;
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      if (body[snakeKey] !== undefined) {
        updates[snakeKey] = body[snakeKey];
      } else if (body[camelKey] !== undefined) {
        updates[snakeKey] = body[camelKey];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: coupon, error } = await supabase
      .from('coupons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating coupon:', error);
      return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
    }

    return NextResponse.json({ success: true, coupon });

  } catch (error) {
    console.error('Coupon PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Deactivate coupon (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete - just deactivate
    const { data: coupon, error } = await supabase
      .from('coupons')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deactivating coupon:', error);
      return NextResponse.json({ error: 'Failed to deactivate coupon' }, { status: 500 });
    }

    return NextResponse.json({ success: true, coupon });

  } catch (error) {
    console.error('Coupon DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
