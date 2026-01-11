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
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import crypto from 'crypto';
import { generateEmbedding, buildSessionSearchableContent } from '@/lib/rai/embeddings';
import { downloadAndStoreAudio } from '@/lib/audio-storage';
import { checkAndSendProactiveNotifications } from '@/lib/rai/proactive-notifications';

// --- CONFIGURATION (Lazy initialization to avoid build-time errors) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- QSTASH SIGNATURE VERIFICATION (Manual - avoids build-time env var issues) ---
async function verifyQStashSignature(
  request: NextRequest,
  body: string
): Promise<{ isValid: boolean; error?: string }> {
  // Skip verification in development
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Skipping QStash signature verification in development');
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

// --- 2. TYPES ---

interface SessionAnalysis {
  session_type?: string;
  child_name?: string | null;
  focus_area?: string;
  skills_worked_on?: string[];
  progress_rating?: string;
  engagement_level?: string;
  confidence_level?: number;
  breakthrough_moment?: string | null;
  concerns_noted?: string | null;
  homework_assigned?: boolean;
  homework_topic?: string | null;
  homework_description?: string | null;
  next_session_focus?: string | null;
  coach_talk_ratio?: number;
  child_reading_samples?: string[];
  key_observations?: string[];
  flagged_for_attention?: boolean;
  flag_reason?: string | null;
  safety_flag?: boolean;
  safety_reason?: string | null;
  sentiment_score?: number;
  summary?: string;
  parent_summary?: string;
}

// --- 3. HELPER FUNCTIONS ---

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
  const supabase = getSupabase();
  
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

/**
 * Analyze transcript with Gemini AI
 */
async function analyzeTranscript(
  transcript: string,
  childContext: { name: string; age: number; score: number | null; sessionsCompleted: number; recentSessions: string } | null,
  childName: string,
  requestId: string
): Promise<SessionAnalysis> {
  const sanitizedTranscript = sanitizeForPrompt(transcript);
  const genAI = getGenAI();

  const prompt = `You are an AI assistant for Yestoryd, a reading coaching platform for children aged 4-12 in India.

TASK: Analyze this coaching session transcript and generate TWO outputs:
1. COACH_ANALYSIS: Detailed analysis for internal use
2. PARENT_SUMMARY: A warm, encouraging 2-3 sentence summary for parents

${childContext ? `CHILD CONTEXT:
- Name: ${childContext.name}
- Age: ${childContext.age}
- Current Score: ${childContext.score}/10
- Sessions Completed: ${childContext.sessionsCompleted}
${childContext.recentSessions ? `Recent Sessions:\n${childContext.recentSessions}` : ''}` : ''}

TRANSCRIPT (Speaker-labeled):
${sanitizedTranscript.substring(0, 15000)}

Generate a JSON response with this structure:
{
  "session_type": "coaching",
  "child_name": "${childName}",
  "focus_area": "phonics|fluency|comprehension|vocabulary",
  "skills_worked_on": ["skill codes"],
  "progress_rating": "declined|same|improved|significant_improvement",
  "engagement_level": "low|medium|high",
  "confidence_level": 1-5,
  "breakthrough_moment": "string or null",
  "concerns_noted": "string or null",
  "homework_assigned": true|false,
  "homework_topic": "string or null",
  "homework_description": "string or null",
  "next_session_focus": "string or null",
  "coach_talk_ratio": 0-100,
  "child_reading_samples": ["phrases child read"],
  "key_observations": ["observation 1", "observation 2"],
  "flagged_for_attention": false,
  "flag_reason": null,
  "safety_flag": false,
  "safety_reason": null,
  "sentiment_score": 0.7,
  "summary": "2-3 sentence technical summary for coach records",
  "parent_summary": "2-3 sentence warm, encouraging summary for parents"
}

SAFETY: Set "safety_flag": true only for genuine signs of distress, anxiety, fear, or concerning mentions about home/school.

Respond ONLY with valid JSON. No markdown, no backticks.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]) as SessionAnalysis;
      console.log(JSON.stringify({
        requestId,
        event: 'ai_analysis_complete',
        focusArea: analysis.focus_area,
        progressRating: analysis.progress_rating,
      }));
      return analysis;
    }

    return getDefaultAnalysis(childName);

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'ai_analysis_error',
      error: error.message,
    }));
    return getDefaultAnalysis(childName);
  }
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
  const supabase = getSupabase();
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
        progress_rating: analysis.progress_rating,
        engagement_level: analysis.engagement_level,
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
        duration_minutes: durationSeconds ? Math.round(durationSeconds / 60) : null,
        attendance_count: attendance.totalParticipants,
      })
      .eq('id', sessionId);

    console.log(JSON.stringify({
      requestId,
      event: 'session_updated',
      sessionId,
    }));
  }

  // 3. Create learning event with embedding
  if (childId && coachId) {
    let embedding: number[] | null = null;

    try {
      const searchableContent = buildSessionSearchableContent(childName, {
        session_type: analysis.session_type,
        focus_area: analysis.focus_area,
        skills_worked_on: analysis.skills_worked_on,
        progress_rating: analysis.progress_rating,
        engagement_level: analysis.engagement_level,
        breakthrough_moment: analysis.breakthrough_moment || undefined,
        concerns_noted: analysis.concerns_noted || undefined,
        homework_assigned: analysis.homework_assigned,
        homework_description: analysis.homework_description || undefined,
        next_session_focus: analysis.next_session_focus || undefined,
        key_observations: analysis.key_observations,
        coach_talk_ratio: analysis.coach_talk_ratio,
        child_reading_samples: analysis.child_reading_samples,
        summary: analysis.summary,
      });

      embedding = await generateEmbedding(searchableContent);
      console.log(JSON.stringify({
        requestId,
        event: 'embedding_generated',
      }));
    } catch (error) {
      console.error(JSON.stringify({
        requestId,
        event: 'embedding_error',
        error: (error as Error).message,
      }));
    }

    await supabase.from('learning_events').insert({
      child_id: childId,
      coach_id: coachId,
      session_id: sessionId,
      event_type: 'session',
      event_subtype: analysis.session_type,
      event_data: {
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
      },
      ai_summary: analysis.summary,
      content_for_embedding: `${childName} session: ${analysis.focus_area}`,
      embedding,
    });

    console.log(JSON.stringify({
      requestId,
      event: 'learning_event_created',
    }));
  }

  // 4. Increment sessions completed
  if (childId) {
    await supabase.rpc('increment_sessions_completed', { child_id_param: childId });
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
  requestId: string
) {
  const supabase = getSupabase();
  
  await supabase.from('communication_queue').insert({
    template_code: 'session_summary_parent',
    recipient_type: 'parent',
    related_entity_type: 'child',
    related_entity_id: childId,
    variables: {
      child_name: childName,
      summary,
      session_id: sessionId,
    },
    status: 'pending',
    request_id: requestId,
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

    // 5. AI Analysis (5-15 seconds)
    console.log(JSON.stringify({ requestId, event: 'starting_ai_analysis' }));
    const analysis = await analyzeTranscript(
      payload.transcriptText,
      childContext,
      childName,
      requestId
    );

    // 6. Audio Download & Storage (10-30 seconds)
    let audioStoragePath: string | undefined;
    const supabase = getSupabase();

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
        requestId
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