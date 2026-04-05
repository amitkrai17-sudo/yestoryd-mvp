// ============================================================
// FILE: app/api/jobs/process-session/route.ts
// ============================================================
// Background Job: Session Processing
// Handles heavy operations offloaded from recall webhook:
// - AI transcript analysis
// - Audio download & storage
// - Embedding generation
// - Notifications
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { buildUnifiedEmbeddingContent } from '@/lib/intelligence/embedding-builder';
import { downloadAndStoreAudio } from '@/lib/audio-storage';
import { checkAndSendProactiveNotifications } from '@/lib/rai/proactive-notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeSessionTranscript, type SessionAnalysis, type BatchContext } from '@/lib/gemini/session-prompts';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization to avoid build-time errors) ---
const getSupabase = createAdminClient;


// --- QSTASH SIGNATURE VERIFICATION (Manual - avoids build-time env var issues) ---
async function verifyQStashSignature(
  request: NextRequest,
  body: string
): Promise<{ isValid: boolean; error?: string }> {
  // Skip verification in development
  if (process.env.NODE_ENV === 'development') {
    console.log('?? Skipping QStash signature verification in development');
    return { isValid: true };
  }

  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    return { isValid: false, error: 'Missing upstash-signature header' };
  }

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey) {
    console.error('QSTASH_CURRENT_SIGNING_KEY not configured');
    return { isValid: false, error: 'Server configuration error' };
  }

  // Try current key first, then next key (for key rotation)
  const keysToTry = [currentSigningKey, nextSigningKey].filter(Boolean) as string[];

  for (const key of keysToTry) {
    try {
      const [timestamp, providedSignature] = signature.split('.');
      
      // Check timestamp (allow 5 minute window)
      const timestampMs = parseInt(timestamp) * 1000;
      const now = Date.now();
      if (Math.abs(now - timestampMs) > 5 * 60 * 1000) {
        continue; // Timestamp too old, try next key
      }

      // Compute expected signature
      const toSign = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', key)
        .update(toSign)
        .digest('base64');

      if (providedSignature === expectedSignature) {
        return { isValid: true };
      }
    } catch {
      continue;
    }
  }

  return { isValid: false, error: 'Invalid signature' };
}

// --- 1. VALIDATION SCHEMA ---

const SessionJobSchema = z.object({
  botId: z.string(),
  sessionId: z.string().uuid().nullable(),
  childId: z.string().uuid().nullable(),
  coachId: z.string().uuid().nullable(),
  transcriptText: z.string(),
  recordingUrl: z.string().url().optional(),
  durationSeconds: z.number().optional(),
  attendance: z.object({
    totalParticipants: z.number(),
    participantNames: z.array(z.string()),
    coachJoined: z.boolean(),
    childJoined: z.boolean(),
    durationMinutes: z.number(),
    isValidSession: z.boolean(),
  }),
  requestId: z.string(),
});

type SessionJobPayload = z.infer<typeof SessionJobSchema>;

// --- 2. HELPER FUNCTIONS ---

/**
 * Sanitize text for AI prompt (prevent injection)
 */
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi, '[FILTERED]')
    .replace(/you\s+are\s+now/gi, '[FILTERED]')
    .replace(/system\s*:/gi, '[FILTERED]')
    .replace(/assistant\s*:/gi, '[FILTERED]')
    .substring(0, 50000);
}

/**
 * Get child context for AI analysis
 */
async function getChildContext(childId: string): Promise<{
  name: string;
  age: number;
  score: number | null;
  sessionsCompleted: number;
  recentSessions: string;
} | null> {
  const supabase = getServiceSupabase();
  
  const { data: child } = await supabase
    .from('children')
    .select('child_name, name, age, latest_assessment_score, sessions_completed')
    .eq('id', childId)
    .single();

  if (!child) return null;

  // Get recent sessions for context
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('focus_area, progress_rating, ai_summary, scheduled_date')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(3);

  let recentSessions = '';
  if (sessions?.length) {
    recentSessions = sessions.map((s, i) =>
      `Session ${i + 1}: Focus=${s.focus_area || 'N/A'}, Progress=${s.progress_rating || 'N/A'}`
    ).join('\n');
  }

  return {
    name: child.child_name || child.name || 'Child',
    age: child.age || 6,
    score: child.latest_assessment_score,
    sessionsCompleted: child.sessions_completed || 0,
    recentSessions,
  };
}


function getDefaultAnalysis(childName: string): SessionAnalysis {
  return {
    session_type: 'coaching',
    child_name: childName,
    focus_area: 'phonics',
    skills_worked_on: [],
    progress_rating: 'same',
    engagement_level: 'medium',
    confidence_level: 3,
    breakthrough_moment: null,
    concerns_noted: null,
    homework_assigned: false,
    flagged_for_attention: true,
    flag_reason: 'Automatic analysis failed - please review manually',
    safety_flag: false,
    sentiment_score: 0.5,
    summary: 'Session completed. Manual review recommended.',
    parent_summary: `${childName} completed today's reading session. The coach worked on building reading skills. Continue practicing reading at home for 10-15 minutes daily.`,
  };
}

/**
 * Save all session data to database
 */
async function saveSessionData(
  payload: SessionJobPayload,
  analysis: SessionAnalysis,
  audioStoragePath?: string,
  requestId?: string
) {
  const supabase = getServiceSupabase();
  const { sessionId, childId, coachId, transcriptText, recordingUrl, durationSeconds, attendance } = payload;
  const childName = analysis.child_name || 'Child';

  // 1. Cache parent summary on child
  if (childId && analysis.parent_summary) {
    await supabase
      .from('children')
      .update({
        last_session_summary: analysis.parent_summary,
        last_session_date: new Date().toISOString(),
        last_session_focus: analysis.focus_area,
      })
      .eq('id', childId);

    console.log(JSON.stringify({
      requestId,
      event: 'parent_summary_cached',
      childId,
    }));
  }

  // 2. Update scheduled_session with full analysis
  if (sessionId) {
    await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        recall_status: 'completed',
        completed_at: new Date().toISOString(),
        focus_area: analysis.focus_area,
        skills_worked_on: analysis.skills_worked_on,
        progress_rating: analysis.progress_rating ? Number(analysis.progress_rating) : null,
        engagement_level: analysis.engagement_level ? Number(analysis.engagement_level) : null,
        confidence_level: analysis.confidence_level,
        breakthrough_moment: analysis.breakthrough_moment,
        concerns_noted: analysis.concerns_noted,
        homework_assigned: analysis.homework_assigned,
        homework_topic: analysis.homework_topic,
        homework_description: analysis.homework_description,
        ai_summary: analysis.summary,
        recording_url: recordingUrl,
        transcript: transcriptText.substring(0, 10000),
        flagged_for_attention: analysis.flagged_for_attention,
        flag_reason: analysis.flag_reason,
        audio_storage_path: audioStoragePath,
        duration_minutes: durationSeconds ? Math.round(durationSeconds / 60) : undefined,
        attendance_count: attendance.totalParticipants,
      })
      .eq('id', sessionId);

    console.log(JSON.stringify({
      requestId,
      event: 'session_updated',
      sessionId,
    }));
  }

  // 3. Create PENDING structured capture instead of learning_event directly.
  // Coach must review and confirm before intelligence enters learning_events.
  // The full Gemini analysis is stored in the capture for coach reference.
  if (childId && coachId) {
    const transcriptAnalysisData = {
      session_id: sessionId,
      focus_area: analysis.focus_area,
      skills_worked_on: analysis.skills_worked_on,
      progress_rating: analysis.progress_rating,
      engagement_level: analysis.engagement_level,
      confidence_level: analysis.confidence_level,
      key_observations: analysis.key_observations,
      duration_seconds: durationSeconds,
      coach_talk_ratio: analysis.coach_talk_ratio,
      child_reading_samples: analysis.child_reading_samples,
      breakthrough_moment: analysis.breakthrough_moment,
      concerns_noted: analysis.concerns_noted,
      homework_assigned: analysis.homework_assigned,
      homework_description: analysis.homework_description,
      next_session_focus: analysis.next_session_focus,
      attendance,
    };

    // Normalize engagement to low/moderate/high/exceptional for capture schema
    const engagementMap: Record<string, string> = {
      'high': 'high', 'very high': 'exceptional', 'excellent': 'exceptional',
      'low': 'low', 'very low': 'low', 'poor': 'low', 'minimal': 'low',
    };
    const normalizedEngagement = engagementMap[(analysis.engagement_level || '').toLowerCase()] || 'moderate';

    // Get session date for capture record
    let captureSessionDate = new Date().toISOString().split('T')[0];
    if (sessionId) {
      const { data: sessDateRow } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date')
        .eq('id', sessionId)
        .single();
      if (sessDateRow?.scheduled_date) captureSessionDate = sessDateRow.scheduled_date;
    }

    try {
      // Check if a pending capture already exists (re-processing scenario)
      const { data: existingCapture } = sessionId ? await supabase
        .from('structured_capture_responses')
        .select('id, coach_confirmed')
        .eq('session_id', sessionId)
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() : { data: null };

      if (existingCapture?.coach_confirmed) {
        // Coach already confirmed — don't overwrite
        console.log(JSON.stringify({ requestId, event: 'capture_already_confirmed', sessionId }));
      } else if (existingCapture) {
        // Pending capture exists — update with AI data
        await supabase
          .from('structured_capture_responses')
          .update({
            capture_method: 'auto_filled',
            ai_prefilled: true,
            engagement_level: normalizedEngagement,
            custom_strength_note: (analysis.key_observations || []).join('. ') || null,
            custom_struggle_note: analysis.concerns_noted || null,
            skill_performances: JSON.stringify({
              gemini_analysis: transcriptAnalysisData,
              ai_summary: analysis.summary,
              parent_summary: analysis.parent_summary,
            }),
          })
          .eq('id', existingCapture.id);
        console.log(JSON.stringify({ requestId, event: 'pending_capture_updated', captureId: existingCapture.id }));
      } else {
        // Create new pending capture for primary child
        const { data: capture, error: captureErr } = await supabase
          .from('structured_capture_responses')
          .insert({
            session_id: sessionId,
            child_id: childId,
            coach_id: coachId,
            session_modality: 'online',
            capture_method: 'auto_filled',
            ai_prefilled: true,
            coach_confirmed: false,
            session_date: captureSessionDate,
            engagement_level: normalizedEngagement,
            skills_covered: analysis.skills_worked_on || [],
            skill_performances: JSON.stringify({
              gemini_analysis: transcriptAnalysisData,
              ai_summary: analysis.summary,
              parent_summary: analysis.parent_summary,
            }),
            custom_strength_note: (analysis.key_observations || []).join('. ') || null,
            custom_struggle_note: analysis.concerns_noted || null,
            words_mastered: [],
            words_struggled: [],
          })
          .select('id')
          .single();

        if (captureErr) {
          console.error(JSON.stringify({ requestId, event: 'pending_capture_create_error', error: captureErr.message }));
        } else {
          // Store capture_id on session for coach UI linkage
          if (sessionId && capture?.id) {
            await supabase
              .from('scheduled_sessions')
              .update({ capture_id: capture.id })
              .eq('id', sessionId);
          }
          console.log(JSON.stringify({ requestId, event: 'pending_capture_created', captureId: capture?.id }));

          // Notify coach: pending capture ready for review
          if (coachId) {
            try {
              await supabase.from('in_app_notifications').insert({
                user_id: coachId,
                user_type: 'coach',
                title: 'Review Session Intelligence',
                body: `Session with ${childName} is ready for review. Confirm skills, observations, and homework.`,
                notification_type: 'info',
                action_url: `/coach/sessions/${sessionId}`,
                metadata: {
                  session_id: sessionId,
                  child_name: childName,
                  capture_id: capture?.id,
                  type: 'pending_capture_review',
                },
              });
            } catch (notifErr: any) {
              console.error(JSON.stringify({ requestId, event: 'capture_notification_error', error: notifErr.message }));
            }
          }
        }
      }
    } catch (captureError) {
      console.error(JSON.stringify({
        requestId,
        event: 'pending_capture_error',
        error: (captureError as Error).message,
      }));
      // Non-fatal — transcript is still saved on scheduled_sessions
    }

    // 3b. Batch fan-out: create PENDING captures for sibling children too
    if (sessionId) {
      try {
        const { data: thisSession } = await supabase
          .from('scheduled_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        const batchId = (thisSession as any)?.batch_id as string | null;
        if (batchId && thisSession) {
          const { data: siblings } = await supabase
            .from('scheduled_sessions')
            .select('id, child_id, coach_id')
            .eq('batch_id' as any, batchId)
            .eq('scheduled_date', thisSession.scheduled_date!)
            .eq('scheduled_time', thisSession.scheduled_time!)
            .neq('id', sessionId)
            .neq('child_id', childId || '');

          if (siblings && siblings.length > 0) {
            console.log(JSON.stringify({
              requestId, event: 'batch_capture_fanout_start',
              batchId, siblingCount: siblings.length,
            }));

            for (const sibling of siblings) {
              if (!sibling.child_id) continue;

              const siblingContext = await getChildContext(sibling.child_id);
              const siblingName = siblingContext?.name || 'Child';
              const childObs = analysis.per_child_observations?.[siblingName];

              // Check for existing capture
              const { data: sibCapture } = await supabase
                .from('structured_capture_responses')
                .select('id, coach_confirmed')
                .eq('session_id', sibling.id)
                .eq('child_id', sibling.child_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (sibCapture?.coach_confirmed) continue; // Already confirmed

              if (sibCapture) {
                // Update existing pending capture with AI data
                await supabase
                  .from('structured_capture_responses')
                  .update({
                    capture_method: 'auto_filled',
                    ai_prefilled: true,
                    engagement_level: normalizedEngagement,
                    custom_strength_note: childObs?.strengths?.join('. ') || (analysis.key_observations || []).join('. ') || null,
                    custom_struggle_note: childObs?.struggles?.join('. ') || analysis.concerns_noted || null,
                  })
                  .eq('id', sibCapture.id);
              } else {
                // Create pending capture for sibling
                const { data: newSibCapture } = await supabase
                  .from('structured_capture_responses')
                  .insert({
                    session_id: sibling.id,
                    child_id: sibling.child_id,
                    coach_id: sibling.coach_id || coachId,
                    session_modality: 'online',
                    capture_method: 'auto_filled',
                    ai_prefilled: true,
                    coach_confirmed: false,
                    session_date: captureSessionDate,
                    engagement_level: normalizedEngagement,
                    skills_covered: analysis.skills_worked_on || [],
                    skill_performances: JSON.stringify({
                      gemini_analysis: transcriptAnalysisData,
                      child_observations: childObs || null,
                      ai_summary: analysis.summary,
                    }),
                    custom_strength_note: childObs?.strengths?.join('. ') || null,
                    custom_struggle_note: childObs?.struggles?.join('. ') || null,
                    words_mastered: [],
                    words_struggled: [],
                  })
                  .select('id')
                  .single();

                if (newSibCapture?.id) {
                  await supabase
                    .from('scheduled_sessions')
                    .update({ capture_id: newSibCapture.id })
                    .eq('id', sibling.id);
                }
              }
            }

            console.log(JSON.stringify({
              requestId, event: 'batch_capture_fanout_complete',
              batchId, siblingsProcessed: siblings.length,
            }));
          }
        }
      } catch (batchErr) {
        console.error(JSON.stringify({
          requestId, event: 'batch_capture_fanout_error',
          error: (batchErr as Error).message,
        }));
      }
    }
  } // end if (childId && coachId)

  // 4. Increment sessions completed + reset consecutive no-shows
  if (childId) {
    await supabase.rpc('increment_sessions_completed', { child_id_param: childId });

    // Reset consecutive no-shows on session completion
    await supabase
      .from('enrollments')
      .update({ consecutive_no_shows: 0, updated_at: new Date().toISOString() })
      .eq('child_id', childId)
      .eq('status', 'active');
  }
}

/**
 * Queue parent summary notification
 */
async function queueParentSummary(
  sessionId: string | null,
  childId: string,
  childName: string,
  summary: string,
  requestId: string,
  extra?: {
    focusArea?: string;
    skillsWorkedOn?: string[];
    homeworkDescription?: string;
  }
) {
  const supabase = getServiceSupabase();

  const childFirstName = childName.split(' ')[0];
  const topic = extra?.focusArea?.replace(/_/g, ' ') || 'Reading skills practice';
  const newWords = extra?.skillsWorkedOn?.length
    ? extra.skillsWorkedOn.slice(0, 3).join(', ')
    : 'Various reading skills';
  const homework = extra?.homeworkDescription || 'Keep reading daily!';

  await supabase.from('communication_queue').insert({
    template_code: 'session_summary_parent',
    recipient_id: childId,
    recipient_type: 'parent',
    related_entity_type: 'child',
    related_entity_id: childId,
    scheduled_for: new Date().toISOString(),
    variables: {
      child_name: childFirstName,
      summary,
      session_id: sessionId,
      request_id: requestId,
      topic,
      new_words: newWords,
      highlight: summary.split('.')[0] || 'Great session today',
      homework,
    },
    status: 'pending',
  });

  console.log(JSON.stringify({
    requestId,
    event: 'parent_summary_queued',
    childId,
  }));
}

// --- 4. MAIN HANDLER ---

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Get raw body for signature verification
    const body = await request.text();
    
    // 2. Verify QStash signature
    const verification = await verifyQStashSignature(request, body);
    if (!verification.isValid) {
      console.error(JSON.stringify({
        requestId,
        event: 'qstash_signature_invalid',
        error: verification.error,
      }));
      return NextResponse.json(
        { error: verification.error },
        { status: 401 }
      );
    }

    // 3. Parse and validate payload
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const validation = SessionJobSchema.safeParse(parsedBody);
    if (!validation.success) {
      console.error(JSON.stringify({
        requestId,
        event: 'job_validation_failed',
        errors: validation.error.format(),
      }));
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const payload = validation.data;
    const originalRequestId = payload.requestId;

    console.log(JSON.stringify({
      requestId,
      originalRequestId,
      event: 'session_job_started',
      sessionId: payload.sessionId,
      childId: payload.childId,
      transcriptLength: payload.transcriptText.length,
    }));

    // 4. Get child context
    const childContext = payload.childId 
      ? await getChildContext(payload.childId) 
      : null;
    const childName = childContext?.name || 'Child';

    // 5. AI Analysis (5-15 seconds) — uses shared builder from lib/gemini/session-prompts.ts
    console.log(JSON.stringify({ requestId, event: 'starting_ai_analysis' }));

    // Detect batch context for group tuition sessions
    let batchContext: BatchContext | undefined;
    if (payload.sessionId) {
      try {
        const batchSupabase = getServiceSupabase();
        const { data: sessionForBatch } = await batchSupabase
          .from('scheduled_sessions')
          .select('*')
          .eq('id', payload.sessionId)
          .single();

        const batchId = (sessionForBatch as any)?.batch_id as string | null;
        if (batchId) {
          // Find all children in this batch at the same datetime
          const { data: batchSiblings } = await batchSupabase
            .from('scheduled_sessions')
            .select('child_id')
            .eq('batch_id' as any, batchId)
            .eq('scheduled_date', sessionForBatch!.scheduled_date!)
            .eq('scheduled_time', sessionForBatch!.scheduled_time!);

          if (batchSiblings && batchSiblings.length > 1) {
            const childIds = batchSiblings.map(s => s.child_id).filter(Boolean) as string[];
            const { data: children } = await batchSupabase
              .from('children')
              .select('child_name, name')
              .in('id', childIds);

            const childNames = (children || []).map(c => c.child_name || c.name || 'Child');

            batchContext = {
              batchId,
              childNames,
              batchSize: childNames.length,
            };

            console.log(JSON.stringify({
              requestId,
              event: 'batch_context_detected',
              batchId,
              batchSize: childNames.length,
              childNames,
            }));
          }
        }
      } catch (batchDetectErr) {
        console.warn(JSON.stringify({ requestId, event: 'batch_detect_error', error: (batchDetectErr as Error).message }));
        // Non-fatal — proceed without batch context
      }
    }

    let analysis: SessionAnalysis;
    try {
      const sanitizedTranscript = sanitizeForPrompt(payload.transcriptText);
      analysis = await analyzeSessionTranscript(sanitizedTranscript, childContext, childName, batchContext);
      console.log(JSON.stringify({
        requestId,
        event: 'ai_analysis_complete',
        focusArea: analysis.focus_area,
        progressRating: analysis.progress_rating,
      }));
    } catch (aiError: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'ai_analysis_error',
        error: aiError.message,
      }));
      analysis = getDefaultAnalysis(childName);
    }

    // 6. Audio Download & Storage (10-30 seconds)
    let audioStoragePath: string | undefined;
    const supabase = getServiceSupabase();

    if (payload.sessionId && payload.childId && payload.recordingUrl) {
      console.log(JSON.stringify({ requestId, event: 'starting_audio_download' }));

      const { data: sessionData } = await supabase
        .from('scheduled_sessions')
        .select('scheduled_date')
        .eq('id', payload.sessionId)
        .single();

      const sessionDate = sessionData?.scheduled_date || new Date().toISOString().split('T')[0];

      try {
        const audioResult = await downloadAndStoreAudio(
          payload.botId,
          payload.sessionId,
          payload.childId,
          sessionDate
        );

        if (audioResult.success) {
          audioStoragePath = audioResult.storagePath;
          console.log(JSON.stringify({
            requestId,
            event: 'audio_stored',
            path: audioStoragePath,
          }));

          // Update session with audio URLs
          const videoExpiresAt = new Date();
          videoExpiresAt.setDate(videoExpiresAt.getDate() + 7);

          await supabase
            .from('scheduled_sessions')
            .update({
              audio_url: audioResult.publicUrl,
              audio_storage_path: audioStoragePath,
              video_url: payload.recordingUrl,
              video_expires_at: videoExpiresAt.toISOString(),
              recording_processed_at: new Date().toISOString(),
            })
            .eq('id', payload.sessionId);
        } else {
          console.error(JSON.stringify({
            requestId,
            event: 'audio_storage_failed',
            error: audioResult.error,
          }));
        }
      } catch (audioError: any) {
        console.error(JSON.stringify({
          requestId,
          event: 'audio_download_error',
          error: audioError.message,
        }));
      }
    }

    // 7. Save all data to database
    console.log(JSON.stringify({ requestId, event: 'saving_session_data' }));
    await saveSessionData(payload, analysis, audioStoragePath, requestId);

    // 8. Proactive notifications
    if (payload.childId && analysis) {
      try {
        const triggerResult = await checkAndSendProactiveNotifications({
          childId: payload.childId,
          childName,
          sessionId: payload.sessionId,
          coachId: payload.coachId,
          analysis,
        });

        if (triggerResult.sent) {
          console.log(JSON.stringify({
            requestId,
            event: 'proactive_notifications_sent',
            count: triggerResult.notifications?.length,
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({
          requestId,
          event: 'proactive_notification_error',
          error: (error as Error).message,
        }));
      }
    }

    // 9. Queue parent summary
    if (payload.childId && analysis.parent_summary) {
      await queueParentSummary(
        payload.sessionId,
        payload.childId,
        childName,
        analysis.parent_summary,
        requestId,
        {
          focusArea: analysis.focus_area,
          skillsWorkedOn: analysis.skills_worked_on,
          homeworkDescription: analysis.homework_description || undefined,
        }
      );
    }

    // 10. Update bot session status
    await supabase
      .from('recall_bot_sessions')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString(),
      })
      .eq('bot_id', payload.botId);

    // 11. Final response
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      originalRequestId,
      event: 'session_job_completed',
      sessionId: payload.sessionId,
      duration: `${duration}ms`,
      audioStored: !!audioStoragePath,
      analysisComplete: !!analysis.focus_area,
    }));

    return NextResponse.json({
      success: true,
      sessionId: payload.sessionId,
      analysis: {
        focusArea: analysis.focus_area,
        progressRating: analysis.progress_rating,
        engagementLevel: analysis.engagement_level,
      },
      audioStored: !!audioStoragePath,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'session_job_error',
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Processing failed', message: error.message },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Session Processing Job',
    description: 'Background worker for heavy session processing',
    timestamp: new Date().toISOString(),
  });
}