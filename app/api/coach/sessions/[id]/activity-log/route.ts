// ============================================================
// FILE: app/api/coach/sessions/[id]/activity-log/route.ts
// PURPOSE: Save activity logs + coach notes on session complete
//          V2: Mark session completed, struggle flags, parent
//          summary trigger, coach streak, transcript_status
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { qstash } from '@/lib/qstash';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const { activities, session_elapsed_seconds, coach_notes } = body;

    if (!activities || !Array.isArray(activities)) {
      return NextResponse.json({ error: 'activities array is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Verify session exists and belongs to this coach
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, enrollment_id, session_number, session_template_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.child_id) {
      return NextResponse.json({ error: 'Session has no child assigned' }, { status: 400 });
    }

    // 2. Bulk insert activity logs
    const activityRows = activities.map((a: any) => ({
      session_id: sessionId,
      activity_index: a.activity_index,
      activity_name: a.activity_name,
      activity_purpose: a.activity_purpose || null,
      status: a.status,
      planned_duration_minutes: a.planned_duration_minutes || null,
      actual_duration_seconds: a.actual_duration_seconds || null,
      coach_note: a.coach_note || null,
      started_at: a.started_at ? new Date(a.started_at).toISOString() : null,
      completed_at: a.completed_at ? new Date(a.completed_at).toISOString() : new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('session_activity_log')
      .insert(activityRows);

    if (insertError) {
      console.error(JSON.stringify({ requestId, event: 'activity_log_insert_error', error: insertError.message }));
      return NextResponse.json({ error: 'Failed to save activity logs' }, { status: 500 });
    }

    // 3. Create or merge learning_events entry
    // Data Stream Merge: If Recall.ai already processed this session (event_type='session'),
    // merge companion data into that existing event. Otherwise create new session_companion_log.
    const statusCounts = {
      completed: activities.filter((a: any) => a.status === 'completed').length,
      partial: activities.filter((a: any) => a.status === 'partial').length,
      skipped: activities.filter((a: any) => a.status === 'skipped').length,
      struggled: activities.filter((a: any) => a.status === 'struggled').length,
    };

    const companionData = {
      session_id: sessionId,
      session_number: session.session_number,
      session_template_id: session.session_template_id,
      activities,
      status_counts: statusCounts,
      session_elapsed_seconds,
      coach_notes: coach_notes || null,
      logged_by: auth.email,
    };

    try {
      // Check if Recall.ai already created a 'session' event for this session
      const { data: existingEvent } = await supabase
        .from('learning_events')
        .select('id, event_data')
        .eq('child_id', session.child_id)
        .eq('event_type', 'session')
        .filter('event_data->>session_id', 'eq', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEvent) {
        // Scenario B: Recall data arrived first — merge companion data into existing event
        const mergedData = {
          ...(existingEvent.event_data as Record<string, any>),
          activity_statuses: statusCounts,
          companion_activities: activities,
          companion_notes: coach_notes || null,
          companion_elapsed_seconds: session_elapsed_seconds,
          companion_logged_by: auth.email,
          companion_merged_at: new Date().toISOString(),
        };

        await supabase
          .from('learning_events')
          .update({ event_data: mergedData })
          .eq('id', existingEvent.id);

        console.log(JSON.stringify({ requestId, event: 'companion_merged_into_session', existingEventId: existingEvent.id }));
      } else {
        // No existing Recall event — create companion log as usual
        const { error: eventError } = await supabase
          .from('learning_events')
          .insert({
            child_id: session.child_id,
            event_type: 'session_companion_log',
            event_data: companionData,
            event_date: new Date().toISOString().split('T')[0],
          });

        if (eventError) {
          console.error(JSON.stringify({ requestId, event: 'learning_event_error', error: eventError.message }));
        }
      }
    } catch (mergeError: any) {
      // Fallback: create companion log if merge check fails
      console.error(JSON.stringify({ requestId, event: 'merge_check_error', error: mergeError.message }));
      await supabase
        .from('learning_events')
        .insert({
          child_id: session.child_id,
          event_type: 'session_companion_log',
          event_data: companionData,
          event_date: new Date().toISOString().split('T')[0],
        });
    }

    // 4. Create activity_struggle_flag learning_events for struggled activities
    const struggledActivities = activities.filter((a: any) => a.status === 'struggled');
    if (struggledActivities.length > 0) {
      const struggleEvents = struggledActivities.map((a: any) => ({
        child_id: session.child_id as string, // Already verified not null above
        event_type: 'activity_struggle_flag',
        event_data: {
          session_id: sessionId,
          session_number: session.session_number,
          activity_name: a.activity_name,
          activity_purpose: a.activity_purpose || null,
          coach_note: a.coach_note || null,
          logged_by: auth.email,
        },
        event_date: new Date().toISOString().split('T')[0],
      }));

      const { error: struggleError } = await supabase
        .from('learning_events')
        .insert(struggleEvents);

      if (struggleError) {
        console.error(JSON.stringify({ requestId, event: 'struggle_flags_error', error: struggleError.message }));
      } else {
        console.log(JSON.stringify({ requestId, event: 'struggle_flags_created', count: struggledActivities.length }));
      }
    }

    // 5. Update scheduled_sessions: mark completed + companion_panel_completed
    // Check if a Recall bot was attached to determine transcript_status
    let transcriptStatus = 'none';
    try {
      const { data: botSession } = await supabase
        .from('recall_bot_sessions')
        .select('bot_id, status')
        .eq('session_id', sessionId)
        .single();

      if (botSession) {
        transcriptStatus = 'awaiting';
      }
    } catch {
      // No bot attached — that's fine
    }

    const { error: sessionUpdateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        companion_panel_completed: true,
        coach_notes: coach_notes || null,
        session_timer_seconds: session_elapsed_seconds || null,
        transcript_status: transcriptStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionUpdateError) {
      console.error(JSON.stringify({ requestId, event: 'session_update_error', error: sessionUpdateError.message }));
      // Non-fatal — activity logs already saved
    }

    // 6. Increment coach.completed_sessions_with_logs
    try {
      if (!session.coach_id) {
        console.log(JSON.stringify({ requestId, event: 'skip_coach_count', reason: 'no_coach_id' }));
        return NextResponse.json({ success: true, message: 'Activity log saved successfully', logCount: activities.length });
      }

      // Use RPC-like approach: read + write
      const { data: coach } = await supabase
        .from('coaches')
        .select('completed_sessions_with_logs')
        .eq('id', session.coach_id)
        .single();

      const currentCount = coach?.completed_sessions_with_logs || 0;

      await supabase
        .from('coaches')
        .update({
          completed_sessions_with_logs: currentCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.coach_id);

      console.log(JSON.stringify({ requestId, event: 'coach_streak_incremented', coachId: session.coach_id, newCount: currentCount + 1 }));
    } catch (streakError: any) {
      console.error(JSON.stringify({ requestId, event: 'coach_streak_error', error: streakError.message }));
      // Non-fatal
    }

    // 7. Calculate adherence score (template vs actual)
    try {
      if (session.session_template_id) {
        const { data: template } = await supabase
          .from('session_templates')
          .select('activity_flow')
          .eq('id', session.session_template_id)
          .single();

        const activityFlow = template?.activity_flow as any[] | null;

        if (activityFlow && activityFlow.length > 0) {
          const plannedCount = activityFlow.length;

          // Completion component (60%): completed or partial vs planned
          const completedOrPartial = activities.filter(
            (a: any) => a.status === 'completed' || a.status === 'partial'
          ).length;
          const completionRatio = Math.min(completedOrPartial / plannedCount, 1.0);

          // Sequence component (20%): were completed activities done in order?
          const completedIndices = activities
            .filter((a: any) => a.status === 'completed' || a.status === 'partial')
            .map((a: any) => a.activity_index as number)
            .filter((idx: number) => typeof idx === 'number');
          const sequenceFollowed = completedIndices.length <= 1 ||
            completedIndices.every((idx: number, i: number) => i === 0 || idx >= completedIndices[i - 1]);

          // Time component (20%): actual vs planned total time
          const totalPlannedMinutes = activityFlow.reduce(
            (sum: number, step: any) => sum + (step.planned_duration_minutes || 0), 0
          );
          const totalActualSeconds = activities.reduce(
            (sum: number, a: any) => sum + (a.actual_duration_seconds || 0), 0
          );
          const totalActualMinutes = totalActualSeconds / 60;

          let timeScore = 1.0;
          let timeWithinRange = true;
          if (totalPlannedMinutes > 0) {
            const timeRatio = totalActualMinutes / totalPlannedMinutes;
            timeWithinRange = timeRatio >= 0.75 && timeRatio <= 1.25;
            if (!timeWithinRange) {
              timeScore = Math.min(timeRatio, 1.5) / 1.5;
              timeScore = Math.min(timeScore, 1.0);
            }
          }

          // Weighted score
          const adherenceScore = (
            completionRatio * 0.60 +
            (sequenceFollowed ? 1.0 : 0.5) * 0.20 +
            timeScore * 0.20
          );

          // Build per-activity details
          const perActivity = activities.map((a: any) => {
            const planned = activityFlow.find(
              (step: any) => step.activity_id === a.activity_id || step.activity_name === a.activity_name
            );
            return {
              activity_name: a.activity_name,
              status: a.status,
              planned_minutes: planned?.planned_duration_minutes || null,
              actual_minutes: a.actual_duration_seconds ? Math.round(a.actual_duration_seconds / 60 * 10) / 10 : null,
            };
          });

          const adherenceDetails = {
            activities_planned: plannedCount,
            activities_completed: statusCounts.completed,
            activities_partial: statusCounts.partial,
            activities_skipped: statusCounts.skipped,
            activities_struggled: statusCounts.struggled,
            sequence_followed: sequenceFollowed,
            total_planned_minutes: totalPlannedMinutes,
            total_actual_minutes: Math.round(totalActualMinutes * 10) / 10,
            time_within_range: timeWithinRange,
            per_activity: perActivity,
          };

          // Round to 2 decimal places
          const roundedScore = Math.round(adherenceScore * 100) / 100;

          await supabase
            .from('scheduled_sessions')
            .update({
              adherence_score: roundedScore,
              adherence_details: adherenceDetails,
            })
            .eq('id', sessionId);

          console.log(JSON.stringify({
            requestId,
            event: 'adherence_calculated',
            score: roundedScore,
            completionRatio,
            sequenceFollowed,
            timeWithinRange,
          }));
        }
      }
    } catch (adherenceError: any) {
      console.error(JSON.stringify({ requestId, event: 'adherence_calc_error', error: adherenceError.message }));
      // Non-fatal — don't block activity log save
    }

    // 8. Queue parent summary generation (via QStash → parent-summary endpoint)
    try {
      if (qstash) {
        const queueResult = await qstash.publishJSON({
          url: `${APP_URL}/api/coach/sessions/${sessionId}/parent-summary`,
          body: {
            sessionId,
            childId: session.child_id,
            requestId,
          },
          retries: 3,
          delay: 5, // 5 second delay to let activity logs settle
        });

        console.log(JSON.stringify({
          requestId,
          event: 'parent_summary_queued',
          messageId: queueResult.messageId,
        }));
      } else {
        console.log(JSON.stringify({ requestId, event: 'parent_summary_skipped', reason: 'QStash not configured' }));
      }
    } catch (queueError: any) {
      console.error(JSON.stringify({ requestId, event: 'parent_summary_queue_error', error: queueError.message }));
      // Non-fatal — parent summary is a nice-to-have
    }

    console.log(JSON.stringify({
      requestId,
      event: 'activity_log_saved',
      sessionId,
      activityCount: activities.length,
      statusCounts,
      elapsed: session_elapsed_seconds,
      struggledCount: struggledActivities.length,
      transcriptStatus,
    }));

    return NextResponse.json({
      success: true,
      saved: activities.length,
      status_counts: statusCounts,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'activity_log_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
