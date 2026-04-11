// ============================================================
// POST /api/jobs/post-capture-orchestrator
// Async downstream automation after SCF submit.
// Dispatched via QStash from /api/intelligence/capture.
//
// Steps (each independent — one failure doesn't block others):
// 1. Create learning_event + embedding
// 2. Create homework tasks + SmartPractice
// 3. Send parent WhatsApp/email
// 4. Track observation continuations
// 5. Generate session prep for next session
// 6. Log completion
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import { buildUnifiedEmbeddingContent } from '@/lib/intelligence/embedding-builder';
import { getSignalConfidence } from '@/lib/intelligence/score';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface OrchestratorPayload {
  captureId: string;
  sessionId: string | null;
  childId: string;
  coachId: string;
  sessionModality: string;
  isAiPrefillConfirmation?: boolean;
  timestamp?: string;
}

interface StepResults {
  learning_event: boolean;
  homework: boolean;
  parent_notify: boolean;
  smart_practice: boolean;
  continuations: boolean;
  session_prep: boolean;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Verify QStash signature
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: OrchestratorPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { captureId, sessionId, childId, coachId, sessionModality } = payload;
  const supabase = createAdminClient();
  const results: StepResults = {
    learning_event: false,
    homework: false,
    parent_notify: false,
    smart_practice: false,
    continuations: false,
    session_prep: false,
  };

  console.log(JSON.stringify({ requestId, event: 'orchestrator_start', captureId, childId }));

  // Load capture data
  const { data: capture } = await supabase
    .from('structured_capture_responses')
    .select('*')
    .eq('id', captureId)
    .single();

  if (!capture) {
    console.error(JSON.stringify({ requestId, event: 'capture_not_found', captureId }));
    return NextResponse.json({ error: 'Capture not found' }, { status: 404 });
  }

  // Load child data
  const { data: child } = await supabase
    .from('children')
    .select('id, child_name, name, age, parent_name, parent_phone, parent_email, parent_id')
    .eq('id', childId)
    .single();

  const childName = child?.child_name || child?.name || 'Child';

  // ── STEP 1: Create learning_event with embedding ──
  try {
    const confidence = capture.ai_prefilled ? 'high' : getSignalConfidence(capture.capture_method as any);

    // Build embedding content
    const contentForEmbedding = buildUnifiedEmbeddingContent({
      childName,
      eventDate: capture.session_date || new Date().toISOString().split('T')[0],
      eventType: 'structured_capture',
      sessionModality,
      skillsCovered: Array.isArray(capture.skills_covered) ? capture.skills_covered : undefined,
      engagementLevel: capture.engagement_level || undefined,
      customStrengthNote: capture.custom_strength_note || undefined,
      customStruggleNote: capture.custom_struggle_note || undefined,
      wordsMastered: Array.isArray(capture.words_mastered) ? capture.words_mastered : undefined,
      wordsStruggled: Array.isArray(capture.words_struggled) ? capture.words_struggled : undefined,
    });

    await insertLearningEvent({
      childId,
      coachId,
      sessionId: sessionId ?? undefined,
      eventType: 'structured_capture',
      eventSubtype: capture.capture_method,
      eventDate: capture.session_date || undefined,
      signalConfidence: confidence as 'high' | 'medium' | 'low',
      signalSource: 'structured_capture',
      intelligenceScore: capture.intelligence_score || 0,
      sessionModality,
      eventData: {
        captureId,
        skillsCovered: capture.skills_covered,
        skillPerformances: capture.skill_performances,
        engagementLevel: capture.engagement_level,
        strengthObservations: capture.strength_observations,
        struggleObservations: capture.struggle_observations,
        captureMethod: capture.capture_method,
        hasArtifact: !!capture.child_artifact_type && capture.child_artifact_type !== 'none',
        homework_assigned: !!capture.custom_strength_note, // approximate
        ai_prefilled: capture.ai_prefilled,
        coach_confirmed: capture.coach_confirmed,
      },
      contentForEmbedding,
    });
    results.learning_event = true;
  } catch (e) {
    console.error(JSON.stringify({ requestId, event: 'step1_learning_event_error', error: (e as Error).message }));
  }

  // ── STEP 2: Create homework tasks ──
  // Parse homework from skill_performances JSON if it contains homework data
  const skillPerfs = capture.skill_performances;
  const homeworkDesc = typeof skillPerfs === 'object' && skillPerfs !== null
    ? (skillPerfs as any).gemini_analysis?.homework_description || null
    : null;

  // Also check for coach-assigned homework from capture context_tags or custom notes
  // The capture route previously stored homework in its own payload fields
  // but now the orchestrator receives only capture_id and reads from DB
  if (homeworkDesc || capture.custom_strength_note?.includes('Practice Activity')) {
    try {
      let enrollmentId: string | null = null;
      if (sessionId) {
        const { data: sess } = await supabase
          .from('scheduled_sessions')
          .select('enrollment_id')
          .eq('id', sessionId)
          .single();
        enrollmentId = sess?.enrollment_id || null;
      }

      const { simplifyHomework } = await import('@/lib/homework/simplify-homework');
      const hw = homeworkDesc || 'Practice the skills from today\'s session for 10-15 minutes.';
      const { simplified, original } = await simplifyHomework(hw, childName, child?.age || 7);

      const { data: task } = await supabase
        .from('parent_daily_tasks')
        .insert({
          child_id: childId,
          enrollment_id: enrollmentId,
          session_id: sessionId,
          task_date: capture.session_date || new Date().toISOString().split('T')[0],
          title: 'Practice Activity',
          description: simplified,
          coach_notes: original,
          source: 'coach_assigned',
          is_completed: false,
          duration_minutes: 15,
        })
        .select('id')
        .single();

      results.homework = true;

      // SmartPractice (non-blocking)
      if (task?.id) {
        try {
          const { getChildFeatures } = await import('@/lib/features/get-child-features');
          const { features } = await getChildFeatures(childId);
          if (features.smart_practice) {
            const { generateSmartPractice } = await import('@/lib/homework/generate-smart-practice');
            await generateSmartPractice({
              coachNotes: original,
              childName,
              childAge: child?.age || 7,
              skillSlug: 'reading_comprehension',
              childId,
              taskId: task.id,
              supabase,
            });
            results.smart_practice = true;
          }
        } catch (e) {
          console.error(JSON.stringify({ requestId, event: 'step2_smart_practice_error', error: (e as Error).message }));
        }
      }
    } catch (e) {
      console.error(JSON.stringify({ requestId, event: 'step2_homework_error', error: (e as Error).message }));
    }
  }

  // ── STEP 3: Send parent WhatsApp/email ──
  if (child?.parent_phone || child?.parent_email) {
    try {
      const { sendCommunication } = await import('@/lib/communication');
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';

      await sendCommunication({
        templateCode: 'P22_practice_tasks_assigned',
        recipientType: 'parent',
        recipientId: child.parent_id || undefined,
        recipientPhone: child.parent_phone || undefined,
        recipientEmail: child.parent_email || undefined,
        recipientName: child.parent_name || undefined,
        variables: {
          parent_first_name: (child.parent_name || 'Parent').split(' ')[0],
          child_name: childName,
          task_count: '1',
          dashboard_link: `${baseUrl}/parent/dashboard`,
        },
        relatedEntityType: 'session',
        relatedEntityId: sessionId || undefined,
      });
      results.parent_notify = true;
    } catch (e) {
      console.error(JSON.stringify({ requestId, event: 'step3_parent_notify_error', error: (e as Error).message }));
    }
  }

  // ── STEP 4: Observation continuations ──
  const struggleObs = Array.isArray(capture.struggle_observations) ? capture.struggle_observations : [];
  if (struggleObs.length > 0) {
    try {
      for (const obsId of struggleObs) {
        await supabase
          .from('observation_continuations')
          .upsert({
            child_id: childId,
            observation_id: obsId,
            source_capture_id: captureId,
            continuation_status: 'active',
          }, { onConflict: 'child_id,observation_id,continuation_status' });
      }
      results.continuations = true;
    } catch (e) {
      console.error(JSON.stringify({ requestId, event: 'step4_continuations_error', error: (e as Error).message }));
    }
  } else {
    results.continuations = true; // Nothing to do = success
  }

  // ── STEP 5: Generate session prep for next session ──
  if (sessionId) {
    try {
      const { generateSessionPrep } = await import('@/lib/intelligence/session-prep');
      await generateSessionPrep(childId, coachId, captureId);
      results.session_prep = true;
    } catch (e) {
      console.error(JSON.stringify({ requestId, event: 'step5_session_prep_error', error: (e as Error).message }));
    }
  }

  // ── STEP 6: Log completion ──
  const allSucceeded = Object.values(results).every(Boolean);
  console.log(JSON.stringify({
    requestId,
    event: 'orchestrator_complete',
    captureId,
    childId,
    results,
    allSucceeded,
  }));

  return NextResponse.json({ success: true, results });
}
