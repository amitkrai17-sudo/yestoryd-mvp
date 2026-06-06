// ============================================================
// FILE: app/api/admin/tuition/route.ts
// PURPOSE: List all tuition onboardings with linked enrollment data.
//          Admin dashboard view for tuition management.
// ============================================================

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { last10Digits, type LastWa } from '@/lib/tuition/admin-list-enrichment';

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

  // 5. Merge results (existing fields unchanged; lifetime_credited + last_wa additive)
  const results = (onboardings || []).map(o => ({
    ...o,
    coach_name: coachMap[o.coach_id] || null,
    enrollment_status: o.enrollment_id ? enrollmentMap[o.enrollment_id]?.status ?? null : null,
    enrollment_sessions_remaining: o.enrollment_id ? enrollmentMap[o.enrollment_id]?.sessions_remaining ?? null : null,
    lifetime_credited: o.enrollment_id ? (lifetimeMap[o.enrollment_id] ?? 0) : null,
    last_wa: lastWaByKey[last10Digits(o.parent_phone)] ?? null,
  }));

  return NextResponse.json({ onboardings: results, total: results.length });
}, { auth: 'admin' });
