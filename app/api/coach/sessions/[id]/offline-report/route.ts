// ============================================================
// FILE: app/api/coach/sessions/[id]/offline-report/route.ts
// PURPOSE: Coach submits offline session report — converges with
//          the online companion panel pipeline. Produces identical
//          downstream data structures: session_activity_log,
//          learning_events, adherence_score, parent summary queue.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { qstash } from '@/lib/qstash';
import { transcribeVoiceNote, analyzeChildReading } from '@/lib/gemini/audio-analysis';
import type { ReadingAnalysis } from '@/lib/gemini/audio-analysis';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

interface ActivityInput {
  activity_index: number;
  activity_name: string;
  activity_purpose?: string;
  status: 'completed' | 'partial' | 'skipped' | 'struggled';
  planned_duration_minutes?: number;
  actual_duration_seconds?: number;
  coach_note?: string;
  started_at?: string;
  completed_at?: string;
}

interface OfflineReportBody {
  actual_start_time: string;
  actual_end_time: string;
  activities: ActivityInput[];
  additional_activities?: ActivityInput[];
  words_struggled?: string[];
  words_mastered?: string[];
  coach_notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body: OfflineReportBody = await request.json();
    const supabase = getServiceSupabase();
    const coachId = auth.coachId;

    if (!coachId) {
      return NextResponse.json({ error: 'Coach identity required' }, { status: 403 });
    }

    // Validate required fields
    if (!body.actual_start_time || !body.actual_end_time) {
      return NextResponse.json({ error: 'actual_start_time and actual_end_time are required' }, { status: 400 });
    }

    if (!body.activities || !Array.isArray(body.activities) || body.activities.length === 0) {
      return NextResponse.json({ error: 'activities array is required and must not be empty' }, { status: 400 });
    }

    // 2. Fetch session with all needed fields
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, coach_id, enrollment_id, session_number,
        session_template_id, session_mode, offline_request_status,
        coach_voice_note_path, child_reading_clip_path,
        report_deadline, status
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 3. Validations
    if (session.coach_id !== coachId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Session does not belong to this coach' }, { status: 403 });
    }

    if (session.session_mode !== 'offline') {
      return NextResponse.json({ error: 'This endpoint is only for offline sessions' }, { status: 400 });
    }

    const approvedStatuses = ['approved', 'auto_approved'];
    if (!session.offline_request_status || !approvedStatuses.includes(session.offline_request_status)) {
      return NextResponse.json({ error: 'Offline session must be approved before submitting a report' }, { status: 400 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Report already submitted for this session' }, { status: 400 });
    }

    // Voice note is REQUIRED
    if (!session.coach_voice_note_path) {
      return NextResponse.json(
        { error: 'Voice note must be uploaded before submitting the report. Use the upload-audio endpoint first.' },
        { status: 400 }
      );
    }

    const childId = session.child_id;
    if (!childId) {
      return NextResponse.json({ error: 'Session has no child assigned' }, { status: 400 });
    }

    // Check report deadline
    const now = new Date();
    const reportLate = session.report_deadline ? now > new Date(session.report_deadline) : false;

    console.log(JSON.stringify({
      requestId,
      event: 'offline_report_started',
      sessionId,
      coachId,
      reportLate,
      hasReadingClip: !!session.child_reading_clip_path,
    }));

    // Combine template + additional activities
    const allActivities = [
      ...body.activities,
      ...(body.additional_activities || []),
    ];

    // ============================================================
    // STEP A: Insert into session_activity_log (source: offline_report)
    // Mirrors activity-log route step 2
    // ============================================================

    const activityRows = allActivities.map((a) => ({
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
      source: 'offline_report',
    }));

    const { error: insertError } = await supabase
      .from('session_activity_log')
      .insert(activityRows);

    if (insertError) {
      console.error(JSON.stringify({ requestId, event: 'activity_log_insert_error', error: insertError.message }));
      return NextResponse.json({ error: 'Failed to save activity logs' }, { status: 500 });
    }

    // ============================================================
    // STEP B: Transcribe voice note via Gemini (inline, not queued)
    // ============================================================

    let voiceNoteTranscript: string | null = null;
    try {
      voiceNoteTranscript = await transcribeVoiceNote(session.coach_voice_note_path);
      console.log(JSON.stringify({
        requestId,
        event: 'voice_note_transcribed',
        transcriptLength: voiceNoteTranscript.length,
      }));
    } catch (transcribeError: unknown) {
      const msg = transcribeError instanceof Error ? transcribeError.message : 'Unknown error';
      console.error(JSON.stringify({ requestId, event: 'voice_note_transcription_error', error: msg }));
      // Non-fatal — continue without transcript
    }

    // ============================================================
    // STEP C: Analyze child reading clip via Gemini (if exists)
    // ============================================================

    let readingAnalysis: ReadingAnalysis | null = null;
    if (session.child_reading_clip_path) {
      try {
        readingAnalysis = await analyzeChildReading(session.child_reading_clip_path, childId);
        console.log(JSON.stringify({
          requestId,
          event: 'reading_clip_analyzed',
          wpm: readingAnalysis.wpm,
          fluencyScore: readingAnalysis.fluency_score,
        }));
      } catch (readingError: unknown) {
        const msg = readingError instanceof Error ? readingError.message : 'Unknown error';
        console.error(JSON.stringify({ requestId, event: 'reading_clip_analysis_error', error: msg }));
        // Non-fatal — continue without reading analysis
      }
    }

    // ============================================================
    // STEP D: Create learning_event (session_companion_log)
    // Mirrors activity-log route step 3
    // ============================================================

    const statusCounts = {
      completed: allActivities.filter((a) => a.status === 'completed').length,
      partial: allActivities.filter((a) => a.status === 'partial').length,
      skipped: allActivities.filter((a) => a.status === 'skipped').length,
      struggled: allActivities.filter((a) => a.status === 'struggled').length,
    };

    // Confidence tagging
    const confidenceTag = session.child_reading_clip_path ? 'coach_audio' : 'coach_reported';

    const companionData = {
      session_id: sessionId,
      session_mode: 'offline',
      source: 'offline_report',
      session_number: session.session_number,
      session_template_id: session.session_template_id,
      activities: allActivities,
      status_counts: statusCounts,
      actual_start_time: body.actual_start_time,
      actual_end_time: body.actual_end_time,
      words_struggled: body.words_struggled || [],
      words_mastered: body.words_mastered || [],
      coach_notes: body.coach_notes || null,
      logged_by: auth.email,
      confidence_level: confidenceTag,
      voice_note_transcript: voiceNoteTranscript,
      reading_clip_analysis: readingAnalysis,
    };

    // Offline sessions never have a Recall.ai event, so always create new
    // JSON round-trip ensures plain JSON type compatibility with Supabase Json column
    const eventData = JSON.parse(JSON.stringify(companionData));
    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'session_companion_log',
        event_data: eventData,
        event_date: new Date().toISOString().split('T')[0],
      });

    if (eventError) {
      console.error(JSON.stringify({ requestId, event: 'learning_event_error', error: eventError.message }));
    }

    // ============================================================
    // STEP E: Create activity_struggle_flag learning_events
    // Mirrors activity-log route step 4
    // ============================================================

    const struggledActivities = allActivities.filter((a) => a.status === 'struggled');
    if (struggledActivities.length > 0) {
      const struggleEvents = struggledActivities.map((a) => ({
        child_id: childId,
        event_type: 'activity_struggle_flag' as const,
        event_data: {
          session_id: sessionId,
          session_number: session.session_number,
          activity_name: a.activity_name,
          activity_purpose: a.activity_purpose || null,
          coach_note: a.coach_note || null,
          logged_by: auth.email,
          source: 'offline_report',
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

    // ============================================================
    // STEP F: Calculate adherence score (same logic as online)
    // Mirrors activity-log route step 7
    // ============================================================

    let adherenceScore: number | null = null;

    try {
      if (session.session_template_id) {
        const { data: template } = await supabase
          .from('session_templates')
          .select('activity_flow')
          .eq('id', session.session_template_id)
          .single();

        const activityFlow = template?.activity_flow as Array<{ planned_duration_minutes?: number; activity_id?: string; activity_name?: string }> | null;

        if (activityFlow && activityFlow.length > 0) {
          const plannedCount = activityFlow.length;

          // Completion component (60%)
          const completedOrPartial = allActivities.filter(
            (a) => a.status === 'completed' || a.status === 'partial'
          ).length;
          const completionRatio = Math.min(completedOrPartial / plannedCount, 1.0);

          // Sequence component (20%)
          const completedIndices = allActivities
            .filter((a) => a.status === 'completed' || a.status === 'partial')
            .map((a) => a.activity_index)
            .filter((idx): idx is number => typeof idx === 'number');
          const sequenceFollowed = completedIndices.length <= 1 ||
            completedIndices.every((idx, i) => i === 0 || idx >= completedIndices[i - 1]);

          // Time component (20%)
          const totalPlannedMinutes = activityFlow.reduce(
            (sum, step) => sum + (step.planned_duration_minutes || 0), 0
          );
          const totalActualSeconds = allActivities.reduce(
            (sum, a) => sum + (a.actual_duration_seconds || 0), 0
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
          const rawScore = (
            completionRatio * 0.60 +
            (sequenceFollowed ? 1.0 : 0.5) * 0.20 +
            timeScore * 0.20
          );

          // Per-activity details
          const perActivity = allActivities.map((a) => {
            const planned = activityFlow.find(
              (step) => step.activity_name === a.activity_name
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

          adherenceScore = Math.round(rawScore * 100) / 100;

          await supabase
            .from('scheduled_sessions')
            .update({
              adherence_score: adherenceScore,
              adherence_details: adherenceDetails,
            })
            .eq('id', sessionId);

          console.log(JSON.stringify({
            requestId,
            event: 'adherence_calculated',
            score: adherenceScore,
            completionRatio,
            sequenceFollowed,
            timeWithinRange,
          }));
        }
      }
    } catch (adherenceError: unknown) {
      const msg = adherenceError instanceof Error ? adherenceError.message : 'Unknown error';
      console.error(JSON.stringify({ requestId, event: 'adherence_calc_error', error: msg }));
    }

    // ============================================================
    // STEP G: Update scheduled_sessions — mark completed
    // Mirrors activity-log route step 5
    // ============================================================

    const startTime = new Date(body.actual_start_time);
    const endTime = new Date(body.actual_end_time);
    const elapsedSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    const { error: sessionUpdateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        companion_panel_completed: true,
        coach_notes: body.coach_notes || null,
        session_timer_seconds: elapsedSeconds > 0 ? elapsedSeconds : null,
        transcript_status: 'none',
        voice_note_transcript: voiceNoteTranscript,
        completed_at: new Date().toISOString(),
        report_submitted_at: new Date().toISOString(),
        report_late: reportLate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionUpdateError) {
      console.error(JSON.stringify({ requestId, event: 'session_update_error', error: sessionUpdateError.message }));
    }

    // ============================================================
    // STEP H: Increment coach streak
    // Mirrors activity-log route step 6
    // ============================================================

    try {
      if (session.coach_id) {
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
      }
    } catch (streakError: unknown) {
      const msg = streakError instanceof Error ? streakError.message : 'Unknown error';
      console.error(JSON.stringify({ requestId, event: 'coach_streak_error', error: msg }));
    }

    // ============================================================
    // STEP I: Queue parent summary with offline context
    // Mirrors activity-log route step 8
    // ============================================================

    try {
      if (qstash) {
        const queueResult = await qstash.publishJSON({
          url: `${APP_URL}/api/coach/sessions/${sessionId}/parent-summary`,
          body: {
            sessionId,
            childId,
            requestId,
            // Extra offline context for the parent-summary route
            offlineContext: {
              session_mode: 'offline',
              voice_note_transcript: voiceNoteTranscript,
              reading_clip_analysis: readingAnalysis,
              confidence_level: confidenceTag,
              words_struggled: body.words_struggled || [],
              words_mastered: body.words_mastered || [],
            },
          },
          retries: 3,
          delay: 5,
        });

        console.log(JSON.stringify({
          requestId,
          event: 'parent_summary_queued',
          messageId: queueResult.messageId,
        }));
      } else {
        console.log(JSON.stringify({ requestId, event: 'parent_summary_skipped', reason: 'QStash not configured' }));
      }
    } catch (queueError: unknown) {
      const msg = queueError instanceof Error ? queueError.message : 'Unknown error';
      console.error(JSON.stringify({ requestId, event: 'parent_summary_queue_error', error: msg }));
    }

    // ============================================================
    // Final response
    // ============================================================

    console.log(JSON.stringify({
      requestId,
      event: 'offline_report_completed',
      sessionId,
      activityCount: allActivities.length,
      statusCounts,
      adherenceScore,
      reportLate,
      hasTranscript: !!voiceNoteTranscript,
      hasReadingAnalysis: !!readingAnalysis,
      confidenceTag,
    }));

    return NextResponse.json({
      success: true,
      saved: allActivities.length,
      status_counts: statusCounts,
      adherence_score: adherenceScore,
      report_late: reportLate,
      voice_note_transcribed: !!voiceNoteTranscript,
      reading_clip_analyzed: !!readingAnalysis,
      confidence_level: confidenceTag,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'offline_report_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
