// app/api/tuition/schedule/route.ts
// Schedule a tuition session for a child
// Auth: coach or admin. Does NOT deduct balance (deduction on completion).

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { scheduleSession } from '@/lib/scheduling/operations/create-session';
import { setSessionMode } from '@/lib/scheduling/session-mode-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized || !auth.coachId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { enrollmentId, date, time, durationMinutes, mode } = body;

    if (!enrollmentId || !date || !time) {
      return NextResponse.json(
        { error: 'enrollmentId, date, and time are required' },
        { status: 400 }
      );
    }

    // Past dates allowed — coaches may backdate sessions that already happened

    // Verify enrollment
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('id, enrollment_type, status, child_id, coach_id, sessions_remaining')
      .eq('id', enrollmentId)
      .single();

    if (enrollError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.enrollment_type !== 'tuition') {
      return NextResponse.json({ error: 'Only tuition enrollments can be scheduled here' }, { status: 400 });
    }

    // BREAK2.1c: canonical paused signal, checked FIRST for a specific message.
    // Fixes the latent bug where the guard only read is_paused — a balance-paused
    // tuition enrollment (status='paused', is_paused never set by the balance
    // writer) was not reliably blocked from scheduling.
    if (enrollment.status === 'paused') {
      return NextResponse.json({ error: 'Enrollment is paused' }, { status: 400 });
    }

    if (enrollment.status !== 'active' && enrollment.status !== 'pending_start') {
      return NextResponse.json({ error: 'Enrollment is not active' }, { status: 400 });
    }

    if ((enrollment.sessions_remaining ?? 0) <= 0) {
      return NextResponse.json({ error: 'No sessions remaining. Parent needs to purchase more.' }, { status: 400 });
    }

    // Verify coach owns this enrollment (or is admin)
    if (auth.role !== 'admin' && enrollment.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Not authorized for this enrollment' }, { status: 403 });
    }

    // Get next session number
    const { count } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId);

    const sessionNumber = (count || 0) + 1;

    // Duration SSOT: explicit param → tuition_onboarding → fallback 60
    let duration = durationMinutes;
    if (!duration) {
      const { data: onboarding } = await supabase
        .from('tuition_onboarding')
        .select('session_duration_minutes')
        .eq('enrollment_id', enrollmentId)
        .single();
      duration = onboarding?.session_duration_minutes || 60;
    }
    const isOnline = mode === 'online';

    // Use existing scheduling infrastructure
    const result = await scheduleSession(
      {
        enrollmentId,
        childId: enrollment.child_id!,
        coachId: enrollment.coach_id!,
        sessionType: 'tuition',
        sessionNumber,
        sessionTitle: `English Classes Session #${sessionNumber}`,
        durationMinutes: duration,
        scheduledDate: date,
        scheduledTime: time,
      },
      {
        skipCalendar: !isOnline,
        skipRecall: !isOnline,
        skipNotifications: false,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to schedule session' }, { status: 500 });
    }

    // If offline, set session_mode via the SOLE mode owner. Born-offline (skipCalendar) →
    // no Meet link → meet-release is a no-op. suppressOfflineNotify: this route sends no
    // mode-change notification today, so suppression keeps it byte-identical (no net-new
    // send). setSessionMode makes its own typed service client (omit opts.supabase, since
    // this route's inline createClient is untyped). NOTE: setSessionMode also bumps
    // updated_at, which the prior inline write did not.
    if (!isOnline && result.sessionId) {
      await setSessionMode(result.sessionId, 'offline', {
        actor: auth.role === 'admin' ? 'admin' : 'coach',
        suppressOfflineNotify: true,
        approval: { requestStatus: 'auto_approved' },
      });
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      meetLink: result.meetLink || null,
    });
  } catch (error: any) {
    console.error('[tuition-schedule] Error:', error.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
