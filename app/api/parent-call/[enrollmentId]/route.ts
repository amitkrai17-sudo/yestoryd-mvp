// ============================================================
// FILE: app/api/parent-call/[enrollmentId]/route.ts
// PURPOSE: List parent calls for an enrollment + remaining quota
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    if (!enrollmentId) {
      return NextResponse.json({ error: 'Missing enrollmentId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch all parent calls for this enrollment
    const { data: calls, error: callsError } = await supabase
      .from('parent_calls')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('requested_at', { ascending: false });

    if (callsError) {
      console.error('[ParentCall] List error:', callsError);
      return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 });
    }

    // Count calls this month (IST) excluding cancelled
    const { count: usedThisMonth } = await supabase
      .from('parent_calls')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .neq('status', 'cancelled')
      .gte('requested_at', getISTMonthStart());

    // Get max per month from site_settings
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'parent_call_max_per_month')
      .single();

    const maxPerMonth = parseInt(String(setting?.value ?? '1'), 10);
    const used = usedThisMonth || 0;

    return NextResponse.json({
      success: true,
      calls: calls || [],
      quota: {
        used,
        max: maxPerMonth,
        remaining: Math.max(0, maxPerMonth - used),
      },
    });
  } catch (error: any) {
    console.error('[ParentCall] List error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Get the start of the current month in IST as an ISO string */
function getISTMonthStart(): string {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const monthStart = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1));
  // Convert back from IST to UTC
  return new Date(monthStart.getTime() - istOffset).toISOString();
}
