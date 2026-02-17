// ============================================================
// GET /api/parent/session/available-slots?sessionId=xxx
// Returns available slots for rescheduling a specific session
// Uses the same slot logic as the scheduling slots API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized || !auth.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify parent owns the session
  const { data: parent } = await supabase
    .from('parents')
    .select('id')
    .eq('email', auth.email ?? '')
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const { data: children } = await supabase
    .from('children')
    .select('id, age')
    .eq('parent_id', parent.id);

  const childIds = (children || []).map((c) => c.id);

  // Fetch session with coach info
  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select('id, child_id, coach_id, session_type, duration_minutes, scheduled_date, status')
    .eq('id', sessionId)
    .single();

  if (!session || !session.child_id || !childIds.includes(session.child_id)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'scheduled') {
    return NextResponse.json({ error: 'Only scheduled sessions can be rescheduled' }, { status: 400 });
  }

  // Check reschedule limits via enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, max_reschedules, reschedules_used')
    .eq('child_id', session.child_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enrollment) {
    const remaining = (enrollment.max_reschedules || 3) - (enrollment.reschedules_used || 0);
    if (remaining <= 0) {
      return NextResponse.json({
        error: 'Reschedule limit reached',
        maxReschedules: enrollment.max_reschedules,
        rescheduleUsed: enrollment.reschedules_used,
      }, { status: 422 });
    }
  }

  // Fetch available slots for this coach over next 14 days
  const child = children?.find((c) => c.id === session.child_id);
  const childAge = child?.age || 8;

  // Use the internal scheduling slots API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';
  const slotsParams = new URLSearchParams({
    coachId: session.coach_id ?? '',
    sessionType: session.session_type || 'coaching',
    childAge: String(childAge),
    days: '14',
  });

  try {
    const slotsRes = await fetch(`${baseUrl}/api/scheduling/slots?${slotsParams}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!slotsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 502 });
    }

    const slotsData = await slotsRes.json();
    const availableSlots = (slotsData.slots || []).filter((s: any) => s.available);

    return NextResponse.json({
      slots: availableSlots,
      slotsByDate: slotsData.slotsByDate || {},
      durationMinutes: session.duration_minutes || slotsData.durationMinutes,
      rescheduleInfo: enrollment ? {
        maxReschedules: enrollment.max_reschedules || 3,
        rescheduleUsed: enrollment.reschedules_used || 0,
        remaining: (enrollment.max_reschedules || 3) - (enrollment.reschedules_used || 0),
      } : null,
    });
  } catch (err: any) {
    console.error('Available slots fetch error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch available slots' }, { status: 500 });
  }
}
