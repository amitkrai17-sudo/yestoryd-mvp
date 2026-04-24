// ============================================================
// FILE: app/api/admin/sessions/upcoming/route.ts
// PURPOSE: List future scheduled_sessions (next 30 days, IST)
//          for the admin mode-change UI.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();

    const nowMs = Date.now();
    const istNow = new Date(nowMs + 5.5 * 60 * 60 * 1000);
    const today = istNow.toISOString().split('T')[0];
    const plus30 = new Date(nowMs + (30 * 24 + 5.5) * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: sessions, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, scheduled_date, scheduled_time, session_mode, google_meet_link,
        children!scheduled_sessions_child_id_fkey (id, child_name),
        coaches!scheduled_sessions_coach_id_fkey (id, name)
      `)
      .gte('scheduled_date', today)
      .lte('scheduled_date', plus30)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'upcoming_sessions_query_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const normalized = (sessions || [])
      .map((s) => {
        const child = s.children as unknown as { id: string; child_name: string | null } | null;
        const coach = s.coaches as unknown as { id: string; name: string | null } | null;
        return {
          id: s.id,
          scheduled_date: s.scheduled_date,
          scheduled_time: s.scheduled_time,
          session_mode: s.session_mode,
          google_meet_link: s.google_meet_link,
          child_name: child?.child_name ?? 'Unknown',
          coach_name: coach?.name ?? 'Unknown',
        };
      })
      .filter((s) => {
        const dt = new Date(`${s.scheduled_date}T${s.scheduled_time}+05:30`).getTime();
        return dt > nowMs;
      });

    return NextResponse.json({ sessions: normalized, count: normalized.length });
  } catch (err) {
    console.error(JSON.stringify({ requestId, event: 'upcoming_sessions_error', error: err instanceof Error ? err.message : 'Unknown' }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
