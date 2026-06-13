// ============================================================
// FILE: app/api/coach/tuition-onboardings/route.ts
// PURPOSE: Coach-scoped, READ-ONLY list of the coach's own pending tuition
//   onboardings + nudge-ladder status. Visibility only — no actions.
//   Coach scoping mirrors app/api/coach/students/route.ts
//   (requireAdminOrCoach() -> auth.coachId -> .eq('coach_id', coachId)).
//   Nudge status reuses lib/tuition/nudge-status.ts (same ladder as the cron).
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { getPolicy } from '@/lib/backops';
import { computeNudgeStatus, type NudgeLadderPolicy } from '@/lib/tuition/nudge-status';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase configuration');
  return createClient(url, key);
}

export async function GET() {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized || !auth.coachId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const supabase = getSupabase();

    // 1. Pending onboardings owned by this coach (read-only)
    const { data: onboardings, error } = await supabase
      .from('tuition_onboarding')
      .select('id, child_name, parent_phone, parent_name_hint, sessions_purchased, session_rate, status, created_at')
      .eq('coach_id', auth.coachId)
      .in('status', ['draft', 'parent_pending'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[coach-tuition-onboardings] fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to load onboardings' }, { status: 500 });
    }
    if (!onboardings || onboardings.length === 0) {
      return NextResponse.json({ onboardings: [], last_nudge_run: null });
    }

    // 2. Nudge counts keyed on context_id = onboarding.id (one query, no N+1)
    const ids = onboardings.map(o => o.id);
    const { data: nudgeRows } = await supabase
      .from('communication_logs')
      .select('context_id, created_at')
      .eq('template_code', 'parent_tuition_onboarding_v5')
      .in('context_id', ids);

    const countMap: Record<string, number> = {};
    const lastMap: Record<string, string> = {};
    for (const r of nudgeRows || []) {
      const cid = r.context_id;
      if (!cid) continue;
      countMap[cid] = (countMap[cid] || 0) + 1;
      if (!lastMap[cid] || (r.created_at || '') > lastMap[cid]) lastMap[cid] = r.created_at || lastMap[cid];
    }

    // 3. Ladder policy (same source as the cron + admin list)
    const raw = await getPolicy('tuition_onboarding_nudge', {
      first_nudge_hours: 48, second_nudge_hours: 120, expire_hours: 168,
      max_nudges: 2, dedup_hours: 48, expiring_window_hours: 24,
    });
    const p = raw as Record<string, number>;
    const policy: NudgeLadderPolicy = {
      first_nudge_hours: p.first_nudge_hours ?? 48,
      second_nudge_hours: p.second_nudge_hours ?? 120,
      max_nudges: p.max_nudges ?? 2,
      expire_hours: p.expire_hours ?? 168,
      expiring_window_hours: p.expiring_window_hours ?? 24,
    };
    const nowMs = Date.now();

    // 4. Last cron run indicator (newest run-log row)
    const { data: lastRun } = await supabase
      .from('activity_log')
      .select('created_at, metadata')
      .eq('action', 'cron_tuition_onboarding_nudge')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const results = onboardings.map(o => ({
      id: o.id,
      child_name: o.child_name,
      parent_name_hint: o.parent_name_hint,
      parent_phone: o.parent_phone,
      sessions_purchased: o.sessions_purchased,
      session_rate: o.session_rate,
      status: o.status,
      created_at: o.created_at,
      nudge_count: countMap[o.id] ?? 0,
      last_nudge_at: lastMap[o.id] ?? null,
      nudge_status: computeNudgeStatus({
        createdAtMs: o.created_at ? Date.parse(o.created_at) : nowMs,
        nudgeCount: countMap[o.id] ?? 0,
        nowMs,
        policy,
      }),
    }));

    return NextResponse.json({
      onboardings: results,
      last_nudge_run: lastRun
        ? { ran_at: lastRun.created_at, ...((lastRun.metadata ?? {}) as Record<string, unknown>) }
        : null,
    });
  } catch (err: any) {
    console.error('[coach-tuition-onboardings] error:', err?.message || err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
