// ============================================================
// FILE: app/api/admin/sessions/offline-requests/route.ts
// PURPOSE: Returns pending offline requests needing admin approval
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();

    // Fetch pending offline requests with coach, child, enrollment info
    const { data: requests, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, session_number, scheduled_date, scheduled_time,
        offline_request_reason, offline_reason_detail,
        offline_location, offline_location_type,
        enrollment_id, created_at, updated_at,
        children!scheduled_sessions_child_id_fkey (id, child_name, age),
        coaches!scheduled_sessions_coach_id_fkey (id, name, email, phone)
      `)
      .eq('offline_request_status', 'pending')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'offline_requests_query_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [], count: 0 });
    }

    // For each request, get enrollment offline count and max allowed
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const child = req.children as unknown as { id: string; child_name: string | null; age: number | null } | null;
        const coach = req.coaches as unknown as { id: string; name: string | null; email: string | null; phone: string | null } | null;

        let offlineCount = 0;
        let maxOffline = 0;
        let totalSessions = 0;

        if (req.enrollment_id) {
          const [countResult, enrollmentResult] = await Promise.all([
            supabase
              .from('scheduled_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('enrollment_id', req.enrollment_id)
              .eq('session_mode', 'offline'),
            supabase
              .from('enrollments')
              .select('total_sessions')
              .eq('id', req.enrollment_id)
              .single(),
          ]);

          offlineCount = countResult.count ?? 0;
          totalSessions = enrollmentResult.data?.total_sessions ?? 24;
          maxOffline = Math.floor(totalSessions * 25 / 100);
        }

        return {
          id: req.id,
          session_number: req.session_number,
          scheduled_date: req.scheduled_date,
          scheduled_time: req.scheduled_time,
          reason: req.offline_request_reason,
          reason_detail: req.offline_reason_detail,
          location: req.offline_location,
          location_type: req.offline_location_type,
          requested_at: req.updated_at,
          child_name: child?.child_name || 'Unknown',
          child_age: child?.age,
          coach_id: coach?.id,
          coach_name: coach?.name || 'Unknown',
          coach_email: coach?.email,
          enrollment_id: req.enrollment_id,
          offline_count: offlineCount,
          max_offline: maxOffline,
          total_sessions: totalSessions,
        };
      })
    );

    console.log(JSON.stringify({
      requestId,
      event: 'offline_requests_fetched',
      count: enrichedRequests.length,
    }));

    return NextResponse.json({
      requests: enrichedRequests,
      count: enrichedRequests.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'offline_requests_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
