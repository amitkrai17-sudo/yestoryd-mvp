// ============================================================
// FILE: app/api/admin/tuition/route.ts
// PURPOSE: List all tuition onboardings with linked enrollment data.
//          Admin dashboard view for tuition management.
// ============================================================

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

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

  // 4. Merge results
  const results = (onboardings || []).map(o => ({
    ...o,
    coach_name: coachMap[o.coach_id] || null,
    enrollment_status: o.enrollment_id ? enrollmentMap[o.enrollment_id]?.status ?? null : null,
    enrollment_sessions_remaining: o.enrollment_id ? enrollmentMap[o.enrollment_id]?.sessions_remaining ?? null : null,
  }));

  return NextResponse.json({ onboardings: results, total: results.length });
}, { auth: 'admin' });
