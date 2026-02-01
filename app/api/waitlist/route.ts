// =============================================================================
// FILE: app/api/waitlist/route.ts
// =============================================================================
// Waitlist API - Capture interested users for locked products
// Yestoryd - AI-Powered Reading Intelligence Platform
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/waitlist
 * Add a user to the launch waitlist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, productSlug, childName, childAge, source } = body;

    // Validation
    if (!name || !email || !phone || !productSlug) {
      return NextResponse.json(
        { error: 'Name, email, phone, and product are required' },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please enter a valid name' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate phone (Indian format - 10 digits starting with 6-9)
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit Indian mobile number' },
        { status: 400 }
      );
    }

    // Validate child age if provided
    if (childAge !== null && childAge !== undefined) {
      const age = parseInt(childAge);
      if (isNaN(age) || age < 4 || age > 12) {
        return NextResponse.json(
          { error: 'Child age must be between 4 and 12' },
          { status: 400 }
        );
      }
    }

    // Check if already on waitlist for this product
    const { data: existing } = await supabaseAdmin
      .from('launch_waitlist')
      .select('id, created_at')
      .eq('email', email.toLowerCase().trim())
      .eq('product_slug', productSlug)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "You're already on the waitlist! We'll notify you when we launch.",
        alreadyExists: true,
        data: { id: existing.id }
      });
    }

    // Insert into waitlist
    const { data, error } = await supabaseAdmin
      .from('launch_waitlist')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: cleanPhone,
        product_slug: productSlug,
        child_name: childName?.trim() || null,
        child_age: childAge ? parseInt(childAge) : null,
        source: source || 'pricing_page',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Waitlist] Insert error:', error);

      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        return NextResponse.json({
          success: true,
          message: "You're already on the waitlist!",
          alreadyExists: true,
        });
      }

      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 }
      );
    }

    console.log(`[Waitlist] New signup: ${email} for ${productSlug}`);

    // TODO: Phase 5 - Send confirmation WhatsApp/Email
    // await sendWaitlistConfirmation({ name, email, phone, productSlug });

    return NextResponse.json({
      success: true,
      message: "You're on the list! We'll notify you when we launch.",
      data: { id: data.id }
    });

  } catch (error) {
    console.error('[Waitlist] API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/waitlist
 * Get waitlist entries (admin only - requires service role)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productSlug = searchParams.get('product');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabaseAdmin
      .from('launch_waitlist')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (productSlug) {
      query = query.eq('product_slug', productSlug);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Waitlist] Fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch waitlist' },
        { status: 500 }
      );
    }

    // Get stats
    const { data: stats } = await supabaseAdmin
      .from('launch_waitlist')
      .select('product_slug')
      .then(result => {
        if (!result.data) return { data: {} };
        const counts: Record<string, number> = {};
        result.data.forEach(row => {
          counts[row.product_slug] = (counts[row.product_slug] || 0) + 1;
        });
        return { data: counts };
      });

    return NextResponse.json({
      success: true,
      data,
      stats,
      total: data?.length || 0,
    });

  } catch (error) {
    console.error('[Waitlist] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
