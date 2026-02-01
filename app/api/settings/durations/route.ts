// =============================================================================
// API: /api/settings/durations
// Returns session durations from site_settings (single source of truth)
// Used by SiteSettingsContext for client-side hydration
// =============================================================================

import { NextResponse } from 'next/server';
import { getSessionDurations } from '@/lib/settings/getSettings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const durations = await getSessionDurations();

    return NextResponse.json({
      success: true,
      durations,
    });
  } catch (error) {
    console.error('[API /settings/durations] Error:', error);

    // Return defaults on error
    return NextResponse.json({
      success: true,
      durations: {
        coaching: 45,
        skillBuilding: 45,
        checkin: 45,
        discovery: 45,
      },
    });
  }
}
