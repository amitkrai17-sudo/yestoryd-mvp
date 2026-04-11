// =============================================================================
// FILE: app/api/coach/sessions/[id]/complete/route.ts
// PURPOSE: Complete a coaching session and create learning event
// CRITICAL: Single source of truth for rAI queries
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import { timedQuery } from '@/lib/db-utils';
import { NextRequest, NextResponse } from 'next/server';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { generateAndInsertDailyTasks } from '@/lib/tasks/generate-daily-tasks';
import { queueProgressPulse } from '@/lib/qstash';
import { getCategoryBySlug } from '@/lib/config/skill-categories';
import { deductTuitionBalance } from '@/lib/tuition/balance-tracker';
import { buildUnifiedEmbeddingContent } from '@/lib/intelligence/embedding-builder';
import { loadPayoutConfig, loadCoachGroup, calculateEnrollmentBreakdown, getTuitionCoachPercent } from '@/lib/config/payout-config';


export const dynamic = 'force-dynamic';

/**
 * Complete a coaching session
 * - Updates scheduled_sessions status
 * - Inserts learning_event with full JSONB data
 * - Updates children cache for quick parent queries
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const supabase = supabaseAdmin;
    const { id: sessionId } = await params;
    const payload = await request.json();

    // Structured capture path: captureId present means intelligence/capture
    // already saved the learning event. We just mark session complete.
    const isStructuredCapture = !!payload.captureId;

    // Extract fields (support both new form and legacy formats)
    const primaryFocus = payload.primaryFocus || payload.focusArea || null;
    const focusProgress = payload.focusProgress || payload.progressRating || null;
    const overallRating = payload.overallRating || 4;
    const highlights = payload.highlights || payload.sessionHighlights || [];
    const challenges = payload.challenges || payload.sessionStruggles || [];
    const skillsPracticed = payload.skillsPracticed || payload.skillsWorkedOn || [];
    const engagementLevel = payload.engagementLevel || 'medium';
    const nextSessionFocus = payload.nextSessionFocus || (payload.nextSessionFocus?.[0]) || null;

    // Validate required fields (skip for structured capture — data saved separately)
    if (!isStructuredCapture && !primaryFocus) {
      return NextResponse.json(
        { error: 'Missing required fields: primaryFocus/focusArea and focusProgress/progressRating' },
        { status: 400 }
      );
    }

    // 1. Get session details first (with timing for performance monitoring)
    const { data: session, error: fetchError, durationMs } = await timedQuery(
      async () => {
        const result = await supabase
          .from('scheduled_sessions')
          .select('id, child_id, coach_id, session_number, status, enrollment_id, session_mode, session_type, google_meet_link, children!scheduled_sessions_child_id_fkey (child_name)')
          .eq('id', sessionId)
          .single();
        return result;
      },
      `session-complete-fetch:${sessionId}`,
      800 // Warn if > 800ms
    );

    if (fetchError || !session) {
      console.error('Session fetch error:', fetchError);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
    }

    // 2. Resolve category_id from focus area slug (skip if structured capture)
    const category = primaryFocus ? await getCategoryBySlug(primaryFocus) : null;

    // 3. Update scheduled_sessions status + focus metadata
    const sessionUpdate: Record<string, any> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    };
    if (primaryFocus) {
      sessionUpdate.focus_area = primaryFocus;
      sessionUpdate.category_id = category?.id ?? null;
    }
    if (payload.captureId) {
      sessionUpdate.capture_id = payload.captureId;
    }
    if (payload.intelligenceScore != null) {
      sessionUpdate.intelligence_score = payload.intelligenceScore;
    }

    const { error: sessionError } = await supabase
      .from('scheduled_sessions')
      .update(sessionUpdate)
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Session update error:', sessionError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    // 4. Structured capture is now MANDATORY for all session completions.
    //    If captureId is present, the learning_event was already created by capture/route.ts.
    //    If not, check for a pending capture or require one.
    if (!isStructuredCapture) {
      // Check if a pending capture exists for this session
      const { data: pendingCapture } = await supabase
        .from('structured_capture_responses')
        .select('id, coach_confirmed')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingCapture && !pendingCapture.coach_confirmed) {
        return NextResponse.json(
          { error: 'pending_capture', captureId: pendingCapture.id,
            message: 'Please review and confirm the session capture before completing.' },
          { status: 400 }
        );
      }

      if (!pendingCapture) {
        return NextResponse.json(
          { error: 'capture_required',
            message: 'Session completion requires a structured capture. Please fill the capture form.' },
          { status: 400 }
        );
      }

      // pendingCapture exists and IS confirmed — treat as structured capture
      // (coach confirmed capture outside of the normal flow, e.g. via capture page directly)
    }

    // 5. Update children last_session_date
    const { error: childDateError } = await supabase
      .from('children')
      .update({
        last_session_date: new Date().toISOString(),
      })
      .eq('id', session.child_id!);
    if (childDateError) {
      console.error('Children date update error:', childDateError);
    }

    // Ensure child_intelligence_profiles row exists (created lazily)
    try {
      const { data: existingProfile } = await supabase
        .from('child_intelligence_profiles')
        .select('id')
        .eq('child_id', session.child_id!)
        .maybeSingle();

      if (!existingProfile) {
        await supabase
          .from('child_intelligence_profiles')
          .insert({
            child_id: session.child_id!,
            freshness_status: 'fresh',
            overall_confidence: 'medium',
            last_any_signal_at: new Date().toISOString(),
            total_event_count: 1,
            medium_confidence_event_count: 1,
          });
      } else {
        await supabase
          .from('child_intelligence_profiles')
          .update({
            freshness_status: 'fresh',
            last_any_signal_at: new Date().toISOString(),
          })
          .eq('child_id', session.child_id!);
      }
    } catch (profileErr) {
      console.error('Intelligence profile upsert error:', profileErr);
    }

    // Dispatch to orchestrator for consistent post-completion handling
    try {
      await dispatch('session.completed', {
        sessionId,
        requestId: crypto.randomUUID(),
      });
    } catch (dispatchError) {
      console.error('Orchestrator session.completed dispatch failed:', dispatchError);
      // Fallback: reset no-shows directly
      try {
        await supabase
          .from('enrollments')
          .update({ consecutive_no_shows: 0, updated_at: new Date().toISOString() })
          .eq('child_id', session.child_id!)
          .eq('status', 'active');
      } catch (noShowResetError) {
        console.error('Failed to reset consecutive_no_shows:', noShowResetError);
      }
    }

    // Generate daily parent tasks — skip if homework already assigned (AI or coach)
    try {
      const { data: existingHomework } = await supabase
        .from('parent_daily_tasks')
        .select('id')
        .eq('session_id', sessionId)
        .in('source', ['coach_assigned', 'ai_recommended'])
        .limit(1);

      if (!existingHomework || existingHomework.length === 0) {
        await generateAndInsertDailyTasks(session.child_id!, sessionId);
      } else {
        console.log(`[SESSION_COMPLETE] Skipping template tasks for ${sessionId} — homework tasks exist`);
      }
    } catch (taskError) {
      console.error('[SESSION_COMPLETE] Daily task generation failed:', taskError);
    }

    // Periodic reading test (every 4th session, non-blocking)
    try {
      const { createReadingTestTask } = await import('@/lib/homework/generate-reading-test');
      const childName = (session as any).children?.child_name || 'Child';
      await createReadingTestTask({
        childId: session.child_id!,
        childName,
        enrollmentId: session.enrollment_id || undefined,
        sessionId,
        sessionNumber: session.session_number || undefined,
        supabase,
      });
    } catch (rtErr) {
      console.error('[SESSION_COMPLETE] Reading test task creation failed:', rtErr);
    }

    // Notify parent of new practice tasks (template + coach-assigned combined)
    try {
      const { count: taskCount } = await supabase
        .from('parent_daily_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('is_completed', false);

      console.log(JSON.stringify({ event: 'practice_notify_check', sessionId, taskCount }));

      if (taskCount && taskCount > 0) {
        const { data: childInfo } = await supabase
          .from('children')
          .select('child_name, parent_phone, parent_email, parent_name, parent_id')
          .eq('id', session.child_id!)
          .single();

        if (childInfo?.parent_phone || childInfo?.parent_email) {
          const { sendCommunication } = await import('@/lib/communication');
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';

          const commResult = await sendCommunication({
            templateCode: 'P22_practice_tasks_assigned',
            recipientType: 'parent',
            recipientId: childInfo.parent_id || undefined,
            recipientPhone: childInfo.parent_phone || undefined,
            recipientEmail: childInfo.parent_email || undefined,
            recipientName: childInfo.parent_name || undefined,
            variables: {
              parent_first_name: (childInfo.parent_name || 'Parent').split(' ')[0],
              child_name: childInfo.child_name || 'your child',
              task_count: String(taskCount),
              dashboard_link: `${baseUrl}/parent/dashboard`,
            },
            relatedEntityType: 'session',
            relatedEntityId: sessionId,
          });

          console.log(JSON.stringify({ event: 'practice_notify_result', sessionId, success: commResult.success, results: commResult.results }));
        } else {
          console.log(JSON.stringify({ event: 'practice_notify_skip', sessionId, reason: 'no_contact_info' }));
        }
      }
    } catch (notifyErr) {
      console.error('[SESSION_COMPLETE] Practice task notification failed:', notifyErr);
      // Non-blocking
    }

    // Progress Pulse check — queue report after every N sessions
    try {
      // Count total completed coaching sessions for this child
      const { count: completedCount } = await supabase
        .from('scheduled_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', session.child_id!)
        .eq('status', 'completed')
        .in('session_type', ['coaching', 'online']);

      if (completedCount && completedCount > 0) {
        // Get enrollment + age_band_config to find pulse interval
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id, age_band')
          .eq('child_id', session.child_id!)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (enrollment?.age_band) {
          const { data: bandConfig } = await supabase
            .from('age_band_config')
            .select('progress_pulse_interval')
            .eq('id', enrollment.age_band)
            .single();

          const pulseInterval = bandConfig?.progress_pulse_interval;

          if (pulseInterval && pulseInterval > 0 && completedCount % pulseInterval === 0) {
            // Fetch child + parent details for the pulse job
            const { data: childInfo } = await supabase
              .from('children')
              .select('child_name, parent_phone, parent_email, parent_id')
              .eq('id', session.child_id!)
              .single();

            let parentName: string | undefined;
            if (childInfo?.parent_id) {
              const { data: parent } = await supabase
                .from('parents')
                .select('name')
                .eq('id', childInfo.parent_id)
                .single();
              parentName = parent?.name ?? undefined;
            }

            await queueProgressPulse({
              enrollmentId: enrollment.id,
              childId: session.child_id!,
              childName: childInfo?.child_name || 'Student',
              coachId: session.coach_id!,
              completedCount,
              pulseInterval,
              parentPhone: childInfo?.parent_phone ?? undefined,
              parentEmail: childInfo?.parent_email ?? undefined,
              parentName,
              requestId: crypto.randomUUID(),
            });

            // Progress Pulse queued successfully
          }
        }
      }
    } catch (pulseError) {
      // Non-blocking — pulse failure should never block session completion
      console.error('[SESSION_COMPLETE] Progress Pulse check failed:', pulseError);
    }

    // Write to activity_log for audit trail
    try {
      await supabase.from('activity_log').insert({
        action: 'session_completed',
        user_email: session.coach_id || 'unknown',
        user_type: 'coach',
        metadata: {
          session_id: sessionId,
          child_id: session.child_id,
          session_number: session.session_number,
          focus_area: primaryFocus,
          progress_rating: focusProgress,
          engagement_level: engagementLevel,
          highlights_count: highlights.length,
          challenges_count: challenges.length,
          homework_assigned: payload.homeworkAssigned || false,
        },
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr);
    }

    // Tuition balance deduction
    if (session.enrollment_id) {
      try {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('enrollment_type')
          .eq('id', session.enrollment_id)
          .single();

        if (enrollment?.enrollment_type === 'tuition') {
          const sessionsDelivered = payload.sessionsDelivered || 1;
          await deductTuitionBalance(
            session.enrollment_id,
            sessionId,
            sessionsDelivered,
            session.coach_id || 'coach',
            crypto.randomUUID(),
          );
        }
      } catch (tuitionErr) {
        console.error('Tuition balance deduction error:', tuitionErr);
      }
    }

    // --- TUITION EARNINGS PIPELINE ---
    if ((session as any).session_type === 'tuition' && session.coach_id) {
      try {
        // 1. Get tuition onboarding data for this child
        const { data: tuitionRows } = await supabase
          .from('tuition_onboarding')
          .select('session_rate, session_duration_minutes, child_name')
          .eq('child_id', session.child_id!)
          .eq('status', 'parent_completed')
          .limit(1);

        const tuitionData = tuitionRows?.[0];
        if (!tuitionData || !tuitionData.session_rate) {
          console.warn(`[tuition-earnings] No tuition_onboarding for child ${session.child_id}`);
        } else {
          // 2. Get coach tier
          const coachGroup = await loadCoachGroup(session.coach_id);
          const config = await loadPayoutConfig();

          // 3. Calculate split via Calculator B (tuition branch)
          const sessionRateRupees = tuitionData.session_rate / 100;
          const breakdown = calculateEnrollmentBreakdown(
            sessionRateRupees,           // rupees (per session, consistent with coaching pipeline)
            1, 0,                        // 1 coaching, 0 skill building
            'starter',                   // enrollment type (not used for tuition)
            'organic',                   // referrer type
            coachGroup,                  // coach tier
            0,                           // TDS cumulative (below threshold)
            config,
            undefined,                   // influencer override
            'tuition',                   // productType
          );

          // 4. Next payout date (7th of current or next month)
          const now = new Date();
          const payoutDay = config.payout_day_of_month || 7;
          const payoutDate = now.getDate() <= payoutDay
            ? new Date(now.getFullYear(), now.getMonth(), payoutDay)
            : new Date(now.getFullYear(), now.getMonth() + 1, payoutDay);
          const scheduledDate = payoutDate.toISOString().split('T')[0];

          // 5. Idempotency check + insert
          const { data: existingPayout } = await supabase
            .from('coach_payouts')
            .select('id')
            .eq('session_id', sessionId)
            .eq('product_type', 'tuition')
            .limit(1);

          if (!existingPayout?.length) {
            const { error: payoutError } = await supabase
              .from('coach_payouts')
              .insert({
                coach_id: session.coach_id,
                child_id: session.child_id,
                child_name: tuitionData.child_name,
                session_type: 'tuition',
                payout_type: 'tuition_session',
                product_type: 'tuition',
                session_id: sessionId,
                payout_month: 0,
                gross_amount: breakdown.coach_cost_amount,
                tds_amount: breakdown.tds_amount,
                net_amount: breakdown.net_to_coaching_coach,
                scheduled_date: scheduledDate,
                status: 'scheduled',
                description: `Tuition: ${tuitionData.child_name} - ${now.toISOString().split('T')[0]}`,
                payout_period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
              });

            if (payoutError) {
              console.error('[tuition-earnings] coach_payout insert failed:', payoutError);
            } else {
              console.log(`[tuition-earnings] Scheduled ${breakdown.coach_cost_amount} paise for ${tuitionData.child_name} (session ${sessionId})`);
            }
          }
        }
      } catch (err) {
        console.error('[tuition-earnings] Pipeline error (non-blocking):', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Session completed successfully',
      data: {
        sessionId,
        childId: session.child_id,
        focusArea: primaryFocus,
        progress: focusProgress,
      },
    });
  } catch (error) {
    console.error('Session complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Return session completion status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = supabaseAdmin;
    const { id: sessionId } = await params;

    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select('id, status, completed_at')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      completedAt: session.completed_at,
      isCompleted: session.status === 'completed',
    });
  } catch (error) {
    console.error('Session status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
