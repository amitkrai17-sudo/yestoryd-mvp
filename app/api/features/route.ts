export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Check feature flags for frontend
// Usage: /api/features?flags=show_free_trial,enable_razorpay
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flags = searchParams.get('flags');

    let query = supabase.from('feature_flags').select('flag_key, flag_value');

    if (flags) {
      const flagList = flags.split(',').map(f => f.trim());
      query = query.in('flag_key', flagList);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to key-value object
    const features: Record<string, boolean> = {};
    data?.forEach(item => {
      features[item.flag_key] = item.flag_value;
    });

    return NextResponse.json(features);
  } catch (error: any) {
    console.error('Failed to fetch feature flags:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
