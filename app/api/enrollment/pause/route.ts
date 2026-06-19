// =============================================================================
// FILE: app/api/enrollment/pause/route.ts
// PURPOSE: Parent self-service pause/resume API
// FIXES: Correct pause day calculations, pause_count on start, max 3 pauses
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { createAdminClient } from '@/lib/supabase/admin';
import { pause as pauseEnrollment, resume as resumeEnrollment } from '@/lib/enrollment/pause-service';

const supabase = createAdminClient();

// Configuration
const MAX_PAUSE_DAYS_TOTAL = 30;    // Maximum total pause days per enrollment
const MAX_PAUSE_DAYS_SINGLE = 10;   // Maximum days for a single pause
const MAX_PAUSE_COUNT = 3;          // Maximum number of pauses allowed
const MIN_NOTICE_HOURS = 48;        // Minimum notice before pause starts

// =============================================================================
// Helper: Log enrollment event
// =============================================================================
async function logEnrollmentEvent(
  enrollmentId: string,
  eventType: string,
  eventData: Record<string, any>,
  triggeredBy: string
) {
  try {
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: eventType,
      event_data: eventData,
      triggered_by: triggeredBy,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log enrollment event:', error);
  }
}

// =============================================================================
// GET: Get pause status for an enrollment
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');

    if (!enrollmentId) {
      return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });
    }

    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        id, status, pause_start_date, pause_end_date,
        pause_reason, total_pause_days, pause_count, program_end,
        children (name)
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const totalPauseDaysUsed = enrollment.total_pause_days || 0;
    const remainingPauseDays = Math.max(0, MAX_PAUSE_DAYS_TOTAL - totalPauseDaysUsed);
    const pauseCount = enrollment.pause_count || 0;

    return NextResponse.json({
      success: true,
      data: {
        enrollmentId: enrollment.id,
        childName: (enrollment.children as any)?.[0]?.name || 'Child',
        status: enrollment.status,
        isPaused: enrollment.status === 'paused',
        currentPause: enrollment.status === 'paused' ? {
          startDate: enrollment.pause_start_date,
          endDate: enrollment.pause_end_date,
          reason: enrollment.pause_reason,
        } : null,
        pauseStats: {
          totalPauseDaysUsed,
          remainingPauseDays,
          maxSinglePause: Math.min(MAX_PAUSE_DAYS_SINGLE, remainingPauseDays),
          pauseCount,
          maxPauseCount: MAX_PAUSE_COUNT,
        },
        canPause: remainingPauseDays > 0 &&
                  pauseCount < MAX_PAUSE_COUNT &&
                  enrollment.status === 'active', // BREAK2.1c: active excludes paused
        programEndDate: enrollment.program_end,
      },
    });
  } catch (error) {
    console.error('Error fetching pause status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST: Pause or Resume enrollment
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      enrollmentId,
      action,           // 'pause' | 'resume' | 'early_resume'
      pauseStartDate,   // For pause
      pauseEndDate,     // For pause
      pauseReason,      // For pause: 'exams' | 'travel' | 'illness' | 'other'
    } = body;

    if (!enrollmentId || !action) {
      return NextResponse.json(
        { error: 'enrollmentId and action required' },
        { status: 400 }
      );
    }

    // Fetch enrollment
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(`
        id, status, total_pause_days, pause_count,
        program_end, original_end_date, coach_id,
        pause_start_date, pause_end_date,
        children (id, name),
        coaches!coach_id (id, name, email)
      `)
      .eq('id', enrollmentId)
      .single();

    if (fetchError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // ============================================
    // ACTION: RESUME (Early Resume)
    // ============================================
    if (action === 'resume' || action === 'early_resume') {
      if (enrollment.status !== 'paused') {
        return NextResponse.json({ error: 'Enrollment is not paused' }, { status: 400 });
      }

      // Calculate actual pause duration (never negative)
      const pauseStart = new Date(enrollment.pause_start_date!);
      const actualPauseEnd = new Date(); // Resume today
      const actualPauseDays = Math.max(0, Math.ceil(
        (actualPauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Recalculate end date based on actual pause duration
      const originalEnd = new Date(enrollment.original_end_date || enrollment.program_end || new Date().toISOString());
      const newEndDate = new Date(originalEnd);
      newEndDate.setDate(newEndDate.getDate() + actualPauseDays);

      // Get pending sessions to reschedule
      const { data: pendingSessions } = await supabase
        .from('scheduled_sessions')
        .select('id, scheduled_date, scheduled_time')
        .eq('child_id', (enrollment.children as any)?.[0]?.id)
        .eq('status', 'paused')
        .order('scheduled_date', { ascending: true });

      // Canonical resume write via shared service (BREAK2.1b). skipSideEffects:
      // this route keeps its own event logging + (TODO) session rescheduling below.
      const resumeResult = await resumeEnrollment(enrollmentId, {
        source: 'parent_self_service',
        skipSideEffects: true,
        actor: { type: 'parent' },
      });

      if (!resumeResult.success) {
        // Idempotent double-click: service rejects an already-resumed enrollment.
        if (resumeResult.rejected === 'not_paused') {
          console.log(`[ENROLLMENT_PAUSE] Resume skipped - not paused for ${enrollmentId}`);
          return NextResponse.json({
            success: true,
            message: 'Program already resumed',
            data: { alreadyResumed: true },
          });
        }
        console.error('Error resuming enrollment:', resumeResult.error);
        return NextResponse.json({ error: resumeResult.error || 'Failed to resume' }, { status: 500 });
      }

      await logEnrollmentEvent(enrollmentId, 'pause_ended', {
        original_pause_end: enrollment.pause_end_date,
        actual_pause_end: actualPauseEnd.toISOString().split('T')[0],
        actual_pause_days: actualPauseDays,
        early_resume: action === 'early_resume',
        new_end_date: newEndDate.toISOString().split('T')[0],
      }, 'parent');

      // Sessions are un-paused by resumeEnrollment() itself (4b-2): each still-paused
      // row is restored to its captured pre_pause_status via transitionSessionStatus,
      // calendar intact. (Runs even with skipSideEffects — un-freezing is the fix.)
      // TODO: Send WhatsApp notification

      return NextResponse.json({
        success: true,
        message: 'Program resumed successfully',
        data: {
          actualPauseDays,
          newProgramEnd: newEndDate.toISOString().split('T')[0],
          sessionsRescheduled: pendingSessions?.length || 0,
        },
      });
    }

    // ============================================
    // ACTION: PAUSE
    // ============================================
    if (action === 'pause') {
      // Validate pause request
      const validation = validatePauseRequest(enrollment, pauseStartDate, pauseEndDate, pauseReason);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const startDate = new Date(pauseStartDate);
      const endDate = new Date(pauseEndDate);
      const pauseDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate new program end date
      const currentEndDate = new Date(enrollment.program_end || new Date().toISOString());
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + pauseDays);

      // Get sessions during pause period to mark as paused
      const { data: sessionsToCancel } = await supabase
        .from('scheduled_sessions')
        .select('id, scheduled_date, scheduled_time, google_event_id, recall_bot_id')
        .eq('child_id', (enrollment.children as any)?.[0]?.id)
        .gte('scheduled_date', pauseStartDate)
        .lte('scheduled_date', pauseEndDate)
        .in('status', ['scheduled', 'rescheduled']);

      // Canonical pause write via shared service (BREAK2.1b). skipSideEffects:
      // this route keeps its own session teardown + event log + orchestrator
      // dispatch below — the service only writes the canonical enrollment row
      // (status='paused' + is_paused dual-write, pause_count, dates, program_end).
      const pauseResult = await pauseEnrollment(enrollmentId, {
        source: 'parent_self_service',
        reason: pauseReason,
        startDate: pauseStartDate,
        endDate: pauseEndDate,
        skipSideEffects: true,
        actor: { type: 'parent' },
      });

      if (!pauseResult.success) {
        console.error('Error pausing enrollment:', pauseResult.error);
        return NextResponse.json({ error: pauseResult.error || 'Failed to pause' }, { status: 500 });
      }

      // Session freezing is OWNED by the enrollment.paused orchestrator handler
      // (dispatched below) → freezeEnrollmentSessions → transitionSessionStatus.
      // It suspends each window session to 'paused' KEEPING calendar + Recall, and
      // captures pre_pause_status for an exact resume. This route no longer writes
      // session status or tears down calendar inline (F1/F2 single-owner). The
      // sessionsToCancel SELECT above is retained only for the response/event count.

      // Log event
      await logEnrollmentEvent(enrollmentId, 'pause_started', {
        start_date: pauseStartDate,
        end_date: pauseEndDate,
        reason: pauseReason,
        pause_days: pauseDays,
        sessions_affected: sessionsToCancel?.length || 0,
        new_program_end: newEndDate.toISOString().split('T')[0],
        pause_number: (enrollment.pause_count || 0) + 1,
      }, 'parent');

      // Dispatch to orchestrator for consistent session cancellation during pause
      try {
        await dispatch('enrollment.paused', {
          enrollmentId,
          pauseStartDate,
          pauseEndDate,
          reason: pauseReason,
          requestId: crypto.randomUUID(),
        });
      } catch (dispatchError) {
        console.error('Orchestrator enrollment.paused dispatch failed:', dispatchError);
      }

      return NextResponse.json({
        success: true,
        message: 'Program paused successfully',
        data: {
          pauseStartDate,
          pauseEndDate,
          pauseDays,
          newProgramEnd: newEndDate.toISOString().split('T')[0],
          sessionsAffected: sessionsToCancel?.length || 0,
          pauseNumber: (enrollment.pause_count || 0) + 1,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in pause API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// Validation helper
// =============================================================================
function validatePauseRequest(
  enrollment: any,
  pauseStartDate: string,
  pauseEndDate: string,
  pauseReason: string
): { valid: boolean; error?: string } {
  // Check if already paused — BREAK2.1c: canonical paused signal
  if (enrollment.status === 'paused') {
    return { valid: false, error: 'Enrollment is already paused' };
  }

  // Check enrollment status
  if (enrollment.status !== 'active') {
    return { valid: false, error: 'Only active enrollments can be paused' };
  }

  // Check required fields
  if (!pauseStartDate || !pauseEndDate || !pauseReason) {
    return { valid: false, error: 'Start date, end date, and reason are required' };
  }

  // Check pause count limit
  const pauseCount = enrollment.pause_count || 0;
  if (pauseCount >= MAX_PAUSE_COUNT) {
    return { valid: false, error: `Maximum ${MAX_PAUSE_COUNT} pauses allowed per enrollment` };
  }

  // Parse dates
  const startDate = new Date(pauseStartDate);
  const endDate = new Date(pauseEndDate);
  const now = new Date();

  // Check dates are valid
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { valid: false, error: 'Invalid dates' };
  }

  // Check end date is after start date
  if (endDate <= startDate) {
    return { valid: false, error: 'End date must be after start date' };
  }

  // Check minimum notice (48 hours)
  const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart < MIN_NOTICE_HOURS) {
    return { valid: false, error: `Pause requires at least ${MIN_NOTICE_HOURS} hours notice` };
  }

  // Check pause duration
  const pauseDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (pauseDays > MAX_PAUSE_DAYS_SINGLE) {
    return { valid: false, error: `Maximum ${MAX_PAUSE_DAYS_SINGLE} days per pause` };
  }

  // Check total pause days
  const totalPauseDaysUsed = enrollment.total_pause_days || 0;
  const remainingPauseDays = MAX_PAUSE_DAYS_TOTAL - totalPauseDaysUsed;
  
  if (pauseDays > remainingPauseDays) {
    return { valid: false, error: `Only ${remainingPauseDays} pause days remaining` };
  }

  // Check valid reason
  const validReasons = ['exams', 'travel', 'illness', 'other'];
  if (!validReasons.includes(pauseReason)) {
    return { valid: false, error: 'Invalid pause reason' };
  }

  return { valid: true };
}
