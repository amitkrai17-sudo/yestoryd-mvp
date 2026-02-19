// ============================================================================
// PRICING DISPLAY API
// app/api/pricing-display/route.ts
// ============================================================================
//
// Public endpoint combining age_band_config + pricing_plans for homepage
// and enroll page. Returns age bands with per-tier pricing breakdowns.
//
// V3: Session counts are DERIVED from weekly_pattern + duration_weeks.
//     Skill booster credits are proportional to tier duration.
//
// Core logic lives in lib/pricing-display.ts (shared with server components).
//
// ============================================================================

import { NextResponse } from 'next/server';
import { fetchPricingDisplayData } from '@/lib/pricing-display';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await fetchPricingDisplayData();

  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch pricing data' }, { status: 500 });
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
