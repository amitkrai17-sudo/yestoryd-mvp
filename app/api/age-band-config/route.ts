// ============================================================
// FILE: app/api/age-band-config/route.ts
// PURPOSE: Public API to get age band configuration for a given age
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ageParam = searchParams.get('age');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // If age provided, return matching band
    if (ageParam) {
      const age = parseInt(ageParam);
      if (isNaN(age) || age < 1 || age > 18) {
        return NextResponse.json({ error: 'Invalid age' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('age_band_config')
        .select('*')
        .lte('min_age', age)
        .gte('max_age', age)
        .single();

      if (error || !data) {
        return NextResponse.json({
          success: true,
          config: null,
          message: 'No age band found for this age',
        });
      }

      return NextResponse.json({ success: true, config: data });
    }

    // No age param — return all bands
    const { data, error } = await supabase
      .from('age_band_config')
      .select('*')
      .order('min_age', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    return NextResponse.json({ success: true, configs: data || [] });
  } catch (error: any) {
    console.error('age-band-config error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
