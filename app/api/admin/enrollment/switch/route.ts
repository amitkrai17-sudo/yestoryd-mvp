// =============================================================================
// FILE: app/api/admin/enrollment/switch/route.ts
// PURPOSE: Admin-only API to switch a child from coaching ↔ tuition enrollment.
//
// Flow:
//   1. Validate body + fetch current enrollment
//   2. Verify no duplicate active enrollment for the child
//   3. Cancel all future scheduled sessions (calendar + recall)
//   4. Pause current enrollment (status = 'paused', 90-day resume window)
//   5. Create new enrollment in payment_pending state
//   6. Log activity_log + insertLearningEvent (milestone)
//   7. Return { success, newEnrollmentId, paymentLink, cancelledSessionsCount }
//
// NOTE: No WhatsApp/email notifications in this phase — admin shares the
//       payment link manually. Notifications can be added later.
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelEvent } from '@/lib/googleCalendar';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import { insertLearningEvent } from '@/lib/rai/learning-events';

const supabase = createAdminClient();

// =============================================================================
// Types
// =============================================================================

interface SwitchEnrollmentBody {
  enrollmentId: string;
  targetType: 'coaching' | 'tuition';
  planId?: string;       // Required when targetType = 'coaching'
  sessionRate?: number;  // Required when targetType = 'tuition' (paise)
  sessionCount?: number; // Required when targetType = 'tuition'
  reason: string;
  notes?: string;
}

// =============================================================================
// POST handler
// =============================================================================

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // --- Auth: admin only ---
  const auth = await requireAdmin();
  if (!auth.authorized) {
    console.warn(JSON.stringify({
      requestId,
      event: 'enrollment_switch_unauthorized',
      error: auth.error,
    }));
    return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: 401 });
  }

  // --- Parse body ---
  let body: SwitchEnrollmentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { enrollmentId, targetType, planId, sessionRate, sessionCount, reason, notes } = body;

  // --- Basic validation ---
  if (!enrollmentId) {
    return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 });
  }
  if (targetType !== 'coaching' && targetType !== 'tuition') {
    return NextResponse.json({ error: 'targetType must be "coaching" or "tuition"' }, { status: 400 });
  }
  if (!reason || reason.trim().length === 0) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }
  if (targetType === 'tuition' && (sessionRate == null || sessionCount == null)) {
    return NextResponse.json(
      { error: 'sessionRate and sessionCount are required when switching to tuition' },
      { status: 400 }
    );
  }
  if (targetType === 'coaching' && !planId) {
    return NextResponse.json(
      { error: 'planId is required when switching to coaching' },
      { status: 400 }
    );
  }

  console.info(JSON.stringify({
    requestId,
    event: 'enrollment_switch_start',
    enrollmentId,
    targetType,
    adminEmail: auth.email,
  }));

  // ============================================================================
  // STEP 1: Fetch + validate current enrollment
  // ============================================================================

  const { data: enrollment, error: fetchError } = await supabase
    .from('enrollments')
    .select(`
      id,
      child_id,
      parent_id,
      coach_id,
      enrollment_type,
      status,
      sessions_remaining,
      age_band,
      season_number
    `)
    .eq('id', enrollmentId)
    .single();

  if (fetchError || !enrollment) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_not_found',
      enrollmentId,
      error: fetchError?.message,
    }));
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  // Verify status is switchable
  const switchableStatuses = ['active', 'tuition_paused'];
  if (!enrollment.status || !switchableStatuses.includes(enrollment.status)) {
    return NextResponse.json(
      { error: `Enrollment status "${enrollment.status}" is not eligible for switching. Must be active or tuition_paused.` },
      { status: 400 }
    );
  }

  // Determine current enrollment type (default to 'coaching' if null)
  const currentType =
    enrollment.enrollment_type === 'tuition' ? 'tuition' : 'coaching';

  // Prevent same-type switch
  if (currentType === targetType) {
    return NextResponse.json(
      { error: `Enrollment is already of type "${targetType}". Cannot switch to the same type.` },
      { status: 400 }
    );
  }

  // ============================================================================
  // STEP 2: Check no other active enrollment exists for this child
  // ============================================================================

  const { data: activeConflicts, error: conflictError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('child_id', enrollment.child_id as string)
    .eq('status', 'active')
    .neq('id', enrollmentId);

  if (conflictError) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_conflict_check_error',
      enrollmentId,
      error: conflictError.message,
    }));
    return NextResponse.json({ error: 'Failed to check for active enrollments' }, { status: 500 });
  }

  if (activeConflicts && activeConflicts.length > 0) {
    return NextResponse.json(
      { error: 'Child already has another active enrollment. Resolve it before switching.' },
      { status: 400 }
    );
  }

  // ============================================================================
  // STEP 3: Fetch and cancel future scheduled sessions
  // ============================================================================

  const now = new Date().toISOString();

  const { data: futureSessions, error: sessionsError } = await supabase
    .from('scheduled_sessions')
    .select('id, google_event_id, recall_bot_id, scheduled_date')
    .eq('child_id', enrollment.child_id as string)
    .in('status', ['scheduled'])
    .gt('scheduled_date', now.split('T')[0]); // date-only comparison

  if (sessionsError) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_sessions_fetch_error',
      enrollmentId,
      error: sessionsError.message,
    }));
    return NextResponse.json({ error: 'Failed to fetch future sessions' }, { status: 500 });
  }

  let cancelledSessionsCount = 0;
  const cancelNote = `Cancelled by admin (enrollment switch): ${reason}`;

  if (futureSessions && futureSessions.length > 0) {
    // Cancel external resources first (calendar + recall) — best effort
    for (const session of futureSessions) {
      if (session.google_event_id) {
        try {
          await cancelEvent(session.google_event_id, true);
        } catch (calErr: unknown) {
          const msg = calErr instanceof Error ? calErr.message : String(calErr);
          console.error(JSON.stringify({
            requestId,
            event: 'enrollment_switch_calendar_cancel_failed',
            sessionId: session.id,
            error: msg,
          }));
        }
      }
      if (session.recall_bot_id) {
        try {
          await cancelRecallBot(session.recall_bot_id);
        } catch (recallErr: unknown) {
          const msg = recallErr instanceof Error ? recallErr.message : String(recallErr);
          console.error(JSON.stringify({
            requestId,
            event: 'enrollment_switch_recall_cancel_failed',
            sessionId: session.id,
            error: msg,
          }));
        }
      }
    }

    // Bulk DB update — single query for all sessions
    const sessionIds = futureSessions.map(s => s.id);
    const { error: bulkCancelError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'cancelled',
        coach_notes: cancelNote,
        updated_at: new Date().toISOString(),
      })
      .in('id', sessionIds);

    if (bulkCancelError) {
      console.error(JSON.stringify({
        requestId,
        event: 'enrollment_switch_bulk_cancel_error',
        enrollmentId,
        error: bulkCancelError.message,
      }));
      return NextResponse.json({ error: 'Failed to cancel future sessions' }, { status: 500 });
    }

    cancelledSessionsCount = sessionIds.length;
  }

  console.info(JSON.stringify({
    requestId,
    event: 'enrollment_switch_sessions_cancelled',
    enrollmentId,
    cancelledSessionsCount,
  }));

  // ============================================================================
  // STEP 4: Pause the current enrollment
  // ============================================================================

  const pauseReason =
    targetType === 'coaching' ? 'switched_to_coaching' : 'switched_to_tuition';

  const resumeEligibleUntil = new Date();
  resumeEligibleUntil.setDate(resumeEligibleUntil.getDate() + 90);

  const { error: pauseError } = await supabase
    .from('enrollments')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
      pause_reason: pauseReason,
      resume_eligible_until: resumeEligibleUntil.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId);

  if (pauseError) {
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_pause_error',
      enrollmentId,
      error: pauseError.message,
    }));
    return NextResponse.json({ error: 'Failed to pause current enrollment' }, { status: 500 });
  }

  // ============================================================================
  // STEP 5: Create new enrollment
  // ============================================================================

  // Build base fields shared across both target types
  const baseEnrollmentInsert = {
    child_id: enrollment.child_id,
    parent_id: enrollment.parent_id,
    coach_id: enrollment.coach_id,
    age_band: enrollment.age_band,
    season_number: enrollment.season_number ?? 1,
    status: 'payment_pending',
    previous_enrollment_id: enrollmentId,
    switch_reason: reason,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let newEnrollmentInsert: Record<string, unknown>;

  if (targetType === 'tuition') {
    newEnrollmentInsert = {
      ...baseEnrollmentInsert,
      enrollment_type: 'tuition',
      billing_model: 'prepaid_sessions',
      session_rate: sessionRate!,
      sessions_purchased: sessionCount!,
      sessions_remaining: 0,
      amount: 0,
    };
  } else {
    // targetType === 'coaching': fetch the pricing plan first
    const { data: plan, error: planError } = await supabase
      .from('pricing_plans')
      .select('id, name, slug, discounted_price, original_price, sessions_coaching, sessions_included, product_type')
      .eq('id', planId!)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      // Rollback the pause before returning error
      await supabase
        .from('enrollments')
        .update({
          status: enrollment.status,
          paused_at: null,
          pause_reason: null,
          resume_eligible_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      console.error(JSON.stringify({
        requestId,
        event: 'enrollment_switch_plan_not_found',
        planId,
        error: planError?.message,
      }));
      return NextResponse.json(
        { error: `Pricing plan not found or inactive (id: ${planId})` },
        { status: 400 }
      );
    }

    // Derive enrollment_type from plan metadata
    const enrollmentType = deriveEnrollmentType(plan.product_type, plan.slug);

    newEnrollmentInsert = {
      ...baseEnrollmentInsert,
      enrollment_type: enrollmentType,
      billing_model: 'upfront',
      product_id: plan.id,
      amount: 0, // payment pending — will be set upon Razorpay payment
      original_amount: plan.discounted_price,
      total_sessions: plan.sessions_coaching ?? plan.sessions_included ?? null,
    };
  }

  const { data: newEnrollment, error: createError } = await supabase
    .from('enrollments')
    .insert(newEnrollmentInsert)
    .select('id')
    .single();

  if (createError || !newEnrollment) {
    // Rollback the pause — best effort
    await supabase
      .from('enrollments')
      .update({
        status: enrollment.status,
        paused_at: null,
        pause_reason: null,
        resume_eligible_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_create_error',
      enrollmentId,
      error: createError?.message,
    }));
    return NextResponse.json({ error: 'Failed to create new enrollment' }, { status: 500 });
  }

  const newEnrollmentId = newEnrollment.id;

  // Build payment link — tuition/pay works for both types since tuition
  // checkout page handles prepaid sessions; coaching will need its own
  // checkout page when built. For now use /tuition/pay for both.
  const paymentLink = `/tuition/pay/${newEnrollmentId}`;

  console.info(JSON.stringify({
    requestId,
    event: 'enrollment_switch_created',
    oldEnrollmentId: enrollmentId,
    newEnrollmentId,
    targetType,
    paymentLink,
  }));

  // ============================================================================
  // STEP 6: Log — activity_log + learning event (fire and forget on failures)
  // ============================================================================

  // 6a. activity_log
  try {
    await supabase.from('activity_log').insert({
      user_email: auth.email ?? 'unknown',
      user_type: 'admin',
      action: 'enrollment_switched',
      metadata: {
        request_id: requestId,
        old_enrollment_id: enrollmentId,
        new_enrollment_id: newEnrollmentId,
        child_id: enrollment.child_id,
        from_type: currentType,
        to_type: targetType,
        reason,
        notes: notes ?? null,
        cancelled_sessions_count: cancelledSessionsCount,
        payment_link: paymentLink,
      },
    });
  } catch (logErr: unknown) {
    const msg = logErr instanceof Error ? logErr.message : String(logErr);
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_activity_log_error',
      error: msg,
    }));
    // Non-fatal — do not fail the request
  }

  // 6b. learning_events — 'milestone' is in the CHECK constraint
  try {
    await insertLearningEvent({
      childId: enrollment.child_id as string,
      eventType: 'milestone',
      eventData: {
        milestone_type: 'enrollment_switch',
        old_enrollment_id: enrollmentId,
        new_enrollment_id: newEnrollmentId,
        from_type: currentType,
        to_type: targetType,
        reason,
        notes: notes ?? null,
        cancelled_sessions_count: cancelledSessionsCount,
      },
      contentForEmbedding: `Enrollment switched from ${currentType} to ${targetType}. Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}.`,
      signalSource: 'system_generated',
      signalConfidence: 'low',
      coachId: enrollment.coach_id ?? null,
    });
  } catch (leErr: unknown) {
    const msg = leErr instanceof Error ? leErr.message : String(leErr);
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_switch_learning_event_error',
      error: msg,
    }));
    // Non-fatal — do not fail the request
  }

  // ============================================================================
  // STEP 7: Return success
  // ============================================================================

  return NextResponse.json({
    success: true,
    newEnrollmentId,
    paymentLink,
    cancelledSessionsCount,
  });
}

// =============================================================================
// Helper: derive enrollment_type string from pricing plan metadata
// =============================================================================

function deriveEnrollmentType(
  productType: string | null,
  slug: string | null
): string {
  // Prefer explicit product_type if set
  if (productType) return productType;

  // Fallback: infer from slug
  const s = (slug ?? '').toLowerCase();
  if (s.includes('starter')) return 'starter';
  if (s.includes('continuation') || s.includes('continuance')) return 'continuation';
  if (s.includes('full')) return 'full';

  return 'coaching';
}
