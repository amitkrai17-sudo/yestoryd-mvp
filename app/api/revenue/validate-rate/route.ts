// POST /api/revenue/validate-rate
// Validates tuition session rate against configurable guardrails.
// Called by admin and coach onboarding forms on rate field change.

import { NextRequest, NextResponse } from 'next/server';
import { loadPayoutConfig, validateSessionRate } from '@/lib/config/payout-config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionRateRupees, durationMinutes, sessionType, isAdmin } = body;

    if (!sessionRateRupees || !durationMinutes || !sessionType) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionRateRupees, durationMinutes, sessionType' },
        { status: 400 },
      );
    }

    const config = await loadPayoutConfig();
    const result = validateSessionRate(
      Number(sessionRateRupees),
      Number(durationMinutes),
      sessionType as 'individual' | 'batch',
      config,
      !!isAdmin,
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
