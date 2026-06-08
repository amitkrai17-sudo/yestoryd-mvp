// =============================================================================
// FILE: app/api/admin/enrollment/resume/route.ts
// PURPOSE: Admin-only API to resume a paused enrollment
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resume as resumeEnrollment } from '@/lib/enrollment/pause-service';

const supabase = createAdminClient();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // --- Auth ---
  const auth = await requireAdmin();
  if (!auth.authorized) {
    console.warn(JSON.stringify({
      requestId,
      event: 'enrollment_resume_unauthorized',
      error: auth.error,
    }));
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  // --- Parse body ---
  let enrollmentId: string;
  try {
    const body = await req.json();
    enrollmentId = body.enrollmentId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!enrollmentId) {
    return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
  }

  console.info(JSON.stringify({
    requestId,
    event: 'enrollment_resume_start',
    enrollmentId,
    adminEmail: auth.email,
  }));

  // --- Step 1: Fetch enrollment, verify it is paused ---
  const { data: enrollment, error: fetchError } = await supabase
    .from('enrollments')
    .select('id, status, child_id, enrollment_type, sessions_remaining, resume_eligible_until, switched_from_enrollment_id, switch_reason')
    .eq('id', enrollmentId)
    .single();

  if (fetchError || !enrollment) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_resume_not_found',
      enrollmentId,
      error: fetchError?.message,
    }));
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  if (enrollment.status !== 'paused') {
    return NextResponse.json(
      { error: `Enrollment is not paused (current status: ${enrollment.status})` },
      { status: 400 }
    );
  }

  // --- Step 2: Check resume_eligible_until ---
  if (enrollment.resume_eligible_until) {
    const eligibleUntil = new Date(enrollment.resume_eligible_until);
    if (eligibleUntil < new Date()) {
      console.warn(JSON.stringify({
        requestId,
        event: 'enrollment_resume_window_expired',
        enrollmentId,
        resume_eligible_until: enrollment.resume_eligible_until,
      }));
      return NextResponse.json(
        { error: 'Resume window expired (90 days). Create a new enrollment instead.' },
        { status: 400 }
      );
    }
  }

  // --- Step 3: Verify no other active enrollment for this child ---
  if (!enrollment.child_id) {
    return NextResponse.json({ error: 'Enrollment has no child_id' }, { status: 400 });
  }

  const { data: activeEnrollments, error: activeCheckError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('child_id', enrollment.child_id)
    .eq('status', 'active')
    .neq('id', enrollmentId);

  if (activeCheckError) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_resume_active_check_error',
      enrollmentId,
      error: activeCheckError.message,
    }));
    return NextResponse.json({ error: 'Failed to check active enrollments' }, { status: 500 });
  }

  if (activeEnrollments && activeEnrollments.length > 0) {
    return NextResponse.json(
      { error: 'Child already has an active enrollment. Pause or complete it before resuming this one.' },
      { status: 400 }
    );
  }

  // --- Step 4: Check sessions remaining ---
  if (enrollment.enrollment_type === 'tuition') {
    const sessionsRemaining = enrollment.sessions_remaining ?? 0;
    if (sessionsRemaining <= 0) {
      return NextResponse.json(
        { error: 'No sessions remaining. Create renewal payment first.' },
        { status: 400 }
      );
    }
  }
  // For coaching enrollments: less strict — just allow resume

  // --- Step 5: Resume the enrollment ---
  // Canonical resume via shared service (BREAK2.1b). Route guards above
  // (status==='paused', resume_eligible_until, sessions_remaining) run first;
  // skipSideEffects → route keeps its own activity_log below. Service also
  // clears is_paused + pause dates (canonical). switched_from_enrollment_id /
  // switch_reason are audit fields the service does NOT touch.
  const resumeRes = await resumeEnrollment(enrollmentId, {
    source: 'admin_manual',
    skipSideEffects: true,
    actor: { type: 'admin', email: auth.email ?? undefined },
  });

  if (!resumeRes.success) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_resume_update_error',
      enrollmentId,
      error: resumeRes.error,
    }));
    return NextResponse.json({ error: 'Failed to resume enrollment' }, { status: 500 });
  }

  // --- Step 6: Log to activity_log ---
  const { error: logError } = await supabase.from('activity_log').insert({
    user_email: auth.email ?? 'unknown',
    user_type: 'admin',
    action: 'enrollment_resumed',
    metadata: {
      request_id: requestId,
      enrollment_id: enrollmentId,
      child_id: enrollment.child_id,
      enrollment_type: enrollment.enrollment_type,
    },
  });

  if (logError) {
    // Non-fatal — log the error but do not fail the request
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_resume_log_error',
      enrollmentId,
      error: logError.message,
    }));
  }

  console.info(JSON.stringify({
    requestId,
    event: 'enrollment_resume_success',
    enrollmentId,
    adminEmail: auth.email,
  }));

  // --- Step 7: Return success ---
  return NextResponse.json({ success: true, enrollmentId });
}
