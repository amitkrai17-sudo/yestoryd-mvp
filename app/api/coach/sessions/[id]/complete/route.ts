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

    console.log('=== SESSION COMPLETE API ===');
    console.log('Session ID:', sessionId);
    console.log('Focus:', payload.primaryFocus || payload.focusArea);
    console.log('Progress:', payload.focusProgress || payload.progressRating);

    // Extract fields (support both new form and legacy formats)
    const primaryFocus = payload.primaryFocus || payload.focusArea;
    const focusProgress = payload.focusProgress || payload.progressRating;
    const overallRating = payload.overallRating || 4;
    const highlights = payload.highlights || payload.sessionHighlights || [];
    const challenges = payload.challenges || payload.sessionStruggles || [];
    const skillsPracticed = payload.skillsPracticed || payload.skillsWorkedOn || [];
    const engagementLevel = payload.engagementLevel || 'medium';
    const nextSessionFocus = payload.nextSessionFocus || (payload.nextSessionFocus?.[0]) || null;

    // Validate required fields
    if (!primaryFocus || !focusProgress) {
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
          .select('id, child_id, coach_id, session_number, status')
          .eq('id', sessionId)
          .single();
        return result;
      },
      `session-complete-fetch:${sessionId}`,
      800 // Warn if > 800ms
    );

    console.log(`[SESSION_COMPLETE] Fetch took ${durationMs}ms`);

    if (fetchError || !session) {
      console.error('Session fetch error:', fetchError);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 409 });
    }

    // 2. Update scheduled_sessions status
    const { error: sessionError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Session update error:', sessionError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    // 3. Build event_data for learning_events (SINGLE SOURCE OF TRUTH)
    const eventData = {
      // Identifiers
      session_id: sessionId,
      session_number: session.session_number || payload.sessionNumber || 1,
      session_type: 'coaching',

      // Step 1: Quick Pulse
      overall_rating: overallRating,
      focus_area: primaryFocus,

      // Step 2: Deep Dive
      skills_worked_on: skillsPracticed,
      progress_rating: focusProgress,
      engagement_level: engagementLevel,
      highlights: highlights,
      challenges: challenges,

      // Step 3: Planning
      next_session_focus: nextSessionFocus,
      next_session_activities: payload.nextSessionActivities || [],
      homework_assigned: payload.homeworkAssigned || false,
      homework_items: payload.homeworkItems || [],
      parent_update_needed: payload.parentUpdateNeeded || false,
      parent_update_type: payload.parentUpdateType || null,

      // Meta
      coach_notes: payload.additionalNotes || payload.coachNotes || '',
      breakthrough_moment: payload.breakthroughMoment || '',
      completed_at: new Date().toISOString(),
      form_version: '2.0',
    };

    // 4. Build content for embedding (RAG search)
    const contentParts = [
      `Coaching session #${eventData.session_number}`,
      `Focus: ${eventData.focus_area?.replace(/_/g, ' ')}`,
    ];

    if (eventData.skills_worked_on.length > 0) {
      contentParts.push(`Skills: ${eventData.skills_worked_on.join(', ')}`);
    }

    contentParts.push(`Progress: ${eventData.progress_rating?.replace(/_/g, ' ')}`);
    contentParts.push(`Engagement: ${eventData.engagement_level}`);

    if (eventData.highlights.length > 0) {
      contentParts.push(`Highlights: ${eventData.highlights.join(', ')}`);
    }

    if (eventData.challenges.length > 0) {
      contentParts.push(`Challenges: ${eventData.challenges.join(', ')}`);
    }

    if (eventData.next_session_focus) {
      contentParts.push(`Next focus: ${eventData.next_session_focus}`);
    }

    if (eventData.homework_assigned && eventData.homework_items.length > 0) {
      contentParts.push(`Homework: ${eventData.homework_items.join(', ')}`);
    }

    if (eventData.coach_notes) {
      contentParts.push(`Notes: ${eventData.coach_notes}`);
    }

    const contentForEmbedding = contentParts.join('\n').trim();

    // 5. Insert learning_event
    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: session.child_id!,
        coach_id: session.coach_id,
        session_id: sessionId,
        event_type: 'session',
        event_date: new Date().toISOString(),
        event_data: eventData,
        content_for_embedding: contentForEmbedding,
        // embedding will be generated by trigger or background job
      });

    if (eventError) {
      console.error('Learning event insert error:', eventError);
      // Log but don't fail - session is marked complete
    }

    // 6. Update children cache (for quick parent queries)
    const childSummary = {
      date: new Date().toISOString(),
      focus: primaryFocus,
      progress: focusProgress,
      highlights: highlights,
      next_focus: nextSessionFocus,
      homework: payload.homeworkItems || [],
    };

    const { error: childError } = await supabase
      .from('children')
      .update({
        last_session_summary: JSON.stringify(childSummary),
        last_session_date: new Date().toISOString(),
        last_session_focus: primaryFocus,
      })
      .eq('id', session.child_id!);

    if (childError) {
      console.error('Children cache update error:', childError);
      // Log but don't fail
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

    // Generate daily parent tasks (non-blocking for response)
    try {
      const taskResult = await generateAndInsertDailyTasks(session.child_id!, sessionId);
      console.log(`[SESSION_COMPLETE] Daily tasks generated: ${taskResult.inserted}`);
    } catch (taskError) {
      console.error('[SESSION_COMPLETE] Daily task generation failed:', taskError);
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

            console.log(`[SESSION_COMPLETE] Progress Pulse queued: session ${completedCount}, interval ${pulseInterval}`);
          }
        }
      }
    } catch (pulseError) {
      // Non-blocking — pulse failure should never block session completion
      console.error('[SESSION_COMPLETE] Progress Pulse check failed:', pulseError);
    }

    const duration = Date.now() - startTime;
    console.log(`=== SESSION COMPLETE SUCCESS (${duration}ms) ===`);

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
