export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

// GET - Fetch active testimonials for frontend
// Usage: /api/testimonials (all active)
// Or: /api/testimonials?featured=true (only featured)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const featuredOnly = searchParams.get('featured') === 'true';

    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    const { data: testimonials, error } = await query;

    if (error) throw error;

    return NextResponse.json({ testimonials });
  } catch (error: any) {
    console.error('Failed to fetch testimonials:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
