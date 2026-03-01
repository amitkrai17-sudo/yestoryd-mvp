// =============================================================================
// FILE: app/api/parent/cro-settings/route.ts
// PURPOSE: Public CRO display settings for parent portal
// =============================================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CRO_KEYS = [
  'trust_families_count',
  're_enrollment_heading',
  're_enrollment_subtext',
  're_enrollment_cta',
  're_enrollment_trust',
  'referral_benefit',
  'milestone_messages',
];

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('key, value')
      .in('key', CRO_KEYS);

    if (error) {
      return NextResponse.json({ settings: {} });
    }

    const settings: Record<string, string> = {};
    for (const row of data || []) {
      const val = typeof row.value === 'object'
        ? JSON.stringify(row.value)
        : String(row.value).replace(/^["']|["']$/g, '');
      settings[row.key] = val;
    }

    return NextResponse.json(
      { settings },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch {
    return NextResponse.json({ settings: {} });
  }
}
