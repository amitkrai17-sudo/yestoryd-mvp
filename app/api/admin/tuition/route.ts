// ============================================================
// FILE: app/api/admin/tuition/route.ts
// PURPOSE: List all tuition onboardings with linked enrollment data.
//          Admin dashboard view for tuition management.
// ============================================================

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { last10Digits, type LastWa } from '@/lib/tuition/admin-list-enrichment';
import { getPolicy } from '@/lib/backops';
import { computeNudgeStatus, type NudgeLadderPolicy } from '@/lib/tuition/nudge-status';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_req, { supabase, requestId }) => {
  // 1. Fetch all tuition onboardings
  const { data: onboardings, error: onboardErr } = await supabase
    .from('tuition_onboarding')
    .select(`
      id, child_name, child_approximate_age, parent_phone, parent_name_hint,
      session_rate, sessions_purchased, session_duration_minutes, sessions_per_week,
      default_session_mode, schedule_preference, admin_notes,
      coach_id, enrollment_id, child_id, parent_id,
      batch_id,
      status, admin_filled_at, parent_form_completed_at,
      created_at, updated_at
    `)
    // UI-1.2: soft-dismissed records vanish from the board but persist in DB.
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (onboardErr) {
    console.error(JSON.stringify({ requestId, event: 'tuition_list_error', error: onboardErr.message }));
    return NextResponse.json({ error: 'Failed to fetch tuition records' }, { status: 500 });
  }

  // 2. Fetch linked enrollment data for completed onboardings
  const enrollmentIds = (onboardings || [])
    .map(o => o.enrollment_id)
    .filter((id): id is string => !!id);

  let enrollmentMap: Record<string, { sessions_remaining: number | null; status: string | null }> = {};

  if (enrollmentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, sessions_remaining, status')
      .in('id', enrollmentIds);

    if (enrollments) {
      for (const e of enrollments) {
        enrollmentMap[e.id] = {
          sessions_remaining: e.sessions_remaining,
          status: e.status,
        };
      }
    }
  }

  // 3. Fetch coach names
  const coachIds = Array.from(new Set((onboardings || []).map(o => o.coach_id)));
  let coachMap: Record<string, string> = {};

  if (coachIds.length > 0) {
    const { data: coaches } = await supabase
      .from('coaches')
      .select('id, name')
      .in('id', coachIds);

    if (coaches) {
      for (const c of coaches) {
        coachMap[c.id] = c.name || 'Unknown';
      }
    }
  }

  // 4. Read-only enrichments (UI-1.1b): ONE STABLE RPC does both aggregations,
  //    normalizing phones in SQL so malformed stored formats (e.g.
  //    '91+919920828303') match — the prior JS candidate-set pre-filter dropped
  //    those rows before normalization. See migration get_admin_tuition_enrichments.
  const parentPhones = (onboardings || [])
    .map(o => o.parent_phone)
    .filter((p): p is string => !!p);

  const lifetimeMap: Record<string, number> = {};
  const lastWaByKey: Record<string, LastWa> = {};

  if (enrollmentIds.length > 0 || parentPhones.length > 0) {
    const { data: enrichRows, error: enrichErr } = await supabase.rpc('get_admin_tuition_enrichments', {
      p_enrollment_ids: enrollmentIds,
      p_phones: parentPhones,
    });
    if (enrichErr) {
      // Non-fatal: enrichment is additive — log and serve rows without it.
      console.error(JSON.stringify({ requestId, event: 'tuition_enrichment_error', error: enrichErr.message }));
    }
    for (const row of enrichRows || []) {
      if (row.enrollment_id) {
        lifetimeMap[row.enrollment_id] = row.lifetime_credited ?? 0;
      } else if (row.match_last10) {
        lastWaByKey[row.match_last10] = {
          template_code: row.template_code ?? '',
          sent_at: row.sent_at ?? null,
          wa_sent: row.wa_sent ?? false,
          error_message: row.error_message ?? null,
          channel: row.channel ?? null,
        };
      }
    }
  }

  // 4b. Nudge visibility (UI-2A.5): count parent_tuition_onboarding_v5 sends per
  //     onboarding, keyed on context_id = onboarding.id — the SAME key the cron's
  //     cap uses. ONE query (no N+1). Status computed server-side from the shared
  //     ladder so the chip never drifts from the cron.
  const onboardingIds = (onboardings || []).map(o => o.id);
  const nudgeCountMap: Record<string, number> = {};
  const lastNudgeAtMap: Record<string, string> = {};

  if (onboardingIds.length > 0) {
    const { data: nudgeRows } = await supabase
      .from('communication_logs')
      .select('context_id, created_at')
      .eq('template_code', 'parent_tuition_onboarding_v5')
      .in('context_id', onboardingIds);

    for (const row of nudgeRows || []) {
      const cid = row.context_id;
      if (!cid) continue;
      nudgeCountMap[cid] = (nudgeCountMap[cid] || 0) + 1;
      if (!lastNudgeAtMap[cid] || (row.created_at || '') > lastNudgeAtMap[cid]) {
        lastNudgeAtMap[cid] = row.created_at || lastNudgeAtMap[cid];
      }
    }
  }

  // Ladder policy (same source + defaults as the cron, plus expiring window).
  const nudgePolicyRaw = await getPolicy('tuition_onboarding_nudge', {
    first_nudge_hours: 48, second_nudge_hours: 120, expire_hours: 168,
    max_nudges: 2, dedup_hours: 48, expiring_window_hours: 24,
  });
  const np = nudgePolicyRaw as Record<string, number>;
  const ladderPolicy: NudgeLadderPolicy = {
    first_nudge_hours: np.first_nudge_hours ?? 48,
    second_nudge_hours: np.second_nudge_hours ?? 120,
    max_nudges: np.max_nudges ?? 2,
    expire_hours: np.expire_hours ?? 168,
    expiring_window_hours: np.expiring_window_hours ?? 24,
  };
  const nowMs = Date.now();

  // 4c. Single "last cron run" indicator — newest run-log row.
  const { data: lastRun } = await supabase
    .from('activity_log')
    .select('created_at, metadata')
    .eq('action', 'cron_tuition_onboarding_nudge')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5. Merge results (existing fields unchanged; lifetime_credited + last_wa + nudge_* additive)
  const results = (onboardings || []).map(o => ({
    ...o,
    coach_name: coachMap[o.coach_id] || null,
    enrollment_status: o.enrollment_id ? enrollmentMap[o.enrollment_id]?.status ?? null : null,
    enrollment_sessions_remaining: o.enrollment_id ? enrollmentMap[o.enrollment_id]?.sessions_remaining ?? null : null,
    lifetime_credited: o.enrollment_id ? (lifetimeMap[o.enrollment_id] ?? 0) : null,
    last_wa: lastWaByKey[last10Digits(o.parent_phone)] ?? null,
    nudge_count: nudgeCountMap[o.id] ?? 0,
    last_nudge_at: lastNudgeAtMap[o.id] ?? null,
    nudge_status: computeNudgeStatus({
      createdAtMs: o.created_at ? Date.parse(o.created_at) : nowMs,
      nudgeCount: nudgeCountMap[o.id] ?? 0,
      nowMs,
      policy: ladderPolicy,
    }),
  }));

  return NextResponse.json({
    onboardings: results,
    total: results.length,
    last_nudge_run: lastRun
      ? { ran_at: lastRun.created_at, ...((lastRun.metadata ?? {}) as Record<string, unknown>) }
      : null,
  });
}, { auth: 'admin' });
