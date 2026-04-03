// GET /api/coach/reschedule-requests
// Returns pending reschedule requests for the coach's students

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized || !auth.coachId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get all pending reschedule requests for sessions owned by this coach
    const { data: requests, error } = await supabase
      .from('session_change_requests')
      .select(`
        id,
        session_id,
        change_type,
        status,
        reason,
        original_datetime,
        requested_new_datetime,
        created_at,
        scheduled_sessions!session_id (
          id,
          child_id,
          session_number,
          session_type,
          scheduled_date,
          scheduled_time,
          coach_id,
          children!child_id (
            child_name,
            parent_name
          )
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[coach-reschedule-requests] Error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    // Filter to only this coach's sessions
    const coachRequests = (requests || []).filter((r: any) => {
      const session = r.scheduled_sessions;
      return session?.coach_id === auth.coachId;
    });

    // Format response
    const formatted = coachRequests.map((r: any) => {
      const session = r.scheduled_sessions;
      const child = session?.children;
      return {
        id: r.id,
        sessionId: r.session_id,
        changeType: r.change_type,
        reason: r.reason,
        originalDate: r.original_datetime,
        requestedDate: r.requested_new_datetime,
        createdAt: r.created_at,
        childName: child?.child_name || 'Student',
        parentName: child?.parent_name || 'Parent',
        sessionNumber: session?.session_number,
        sessionType: session?.session_type,
        currentDate: session?.scheduled_date,
        currentTime: session?.scheduled_time,
      };
    });

    return NextResponse.json({ requests: formatted });
  } catch (error: any) {
    console.error('[coach-reschedule-requests] Error:', error.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
