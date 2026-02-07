export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use anon key for public access (RLS will filter)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch public settings for frontend
// Usage: /api/settings?keys=whatsapp_number,support_email
// Or: /api/settings?category=pricing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keys = searchParams.get('keys');
    const category = searchParams.get('category');

    let query = supabase.from('site_settings').select('key, value');

    if (keys) {
      const keyList = keys.split(',').map(k => k.trim());
      query = query.in('key', keyList);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform to key-value object
    const settings: Record<string, any> = {};
    data?.forEach(item => {
      try {
        settings[item.key] = JSON.parse(item.value);
      } catch {
        settings[item.key] = item.value;
      }
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
