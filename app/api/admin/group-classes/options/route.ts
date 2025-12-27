// =============================================================================
// FILE: app/api/admin/group-classes/options/route.ts
// PURPOSE: Fetch dropdown options + quick add instructor
// FIXED: Using is_active (boolean) instead of status
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all dropdown options
export async function GET() {
  try {
    const [classTypesRes, coachesRes, booksRes] = await Promise.all([
      supabase
        .from('group_class_types')
        .select('id, slug, name, icon_emoji, color_hex, price_inr, duration_minutes, age_min, age_max, max_participants, requires_book')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('coaches')
        .select('id, name, email, photo_url, phone')
        .eq('is_active', true)  // FIXED: was 'status', 'active'
        .order('name'),
      supabase
        .from('books')
        .select('id, title, author, age_min, age_max, cover_image_url')
        .eq('is_active', true)
        .order('title'),
    ]);

    return NextResponse.json({
      classTypes: classTypesRes.data || [],
      coaches: coachesRes.data || [],
      books: booksRes.data || [],
    });
  } catch (error) {
    console.error('Error fetching options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Quick add a new instructor/coach
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if coach with this email already exists
    const { data: existing } = await supabase
      .from('coaches')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      // Update to active if exists
      const { data: coach, error } = await supabase
        .from('coaches')
        .update({ is_active: true })
        .eq('id', existing.id)
        .select('id, name, email, phone')
        .single();
      
      if (error) {
        return NextResponse.json({ error: 'Failed to update instructor' }, { status: 500 });
      }
      return NextResponse.json({ coach }, { status: 200 });
    }

    // Create new coach with minimal info
    const { data: coach, error } = await supabase
      .from('coaches')
      .insert({
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        is_active: true,  // FIXED: was 'status: active'
      })
      .select('id, name, email, phone')
      .single();

    if (error) {
      console.error('Error creating coach:', error);
      return NextResponse.json({ error: 'Failed to create instructor: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ coach }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}