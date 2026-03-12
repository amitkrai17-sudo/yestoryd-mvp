// ============================================================
// FILE: app/api/coach/leaderboard/opt-out/route.ts
// Toggle coach leaderboard opt-out preference
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coach_id, optOut } = body;

    if (!coach_id || typeof optOut !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'coach_id (string) and optOut (boolean) required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('coaches')
      .update({
        leaderboard_opt_out: optOut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coach_id);

    if (error) throw error;

    return NextResponse.json({ success: true, opted_out: optOut });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update opt-out';
    console.error('Leaderboard opt-out error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
