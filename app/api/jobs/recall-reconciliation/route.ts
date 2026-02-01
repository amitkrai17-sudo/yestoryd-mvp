// ============================================================
// FILE: app/api/jobs/recall-reconciliation/route.ts
// ============================================================
// Recall.ai Transcript Reconciliation Job
// Recovers missing transcripts from sessions where webhooks
// failed silently. Runs every 6 hours via Vercel Cron.
//
// Flow:
// 1. Find orphaned sessions (completed time-wise but missing transcript)
// 2. Check Recall.ai bot status for each
// 3. If transcript available, fetch and process via Gemini
// 4. Download and store audio
// 5. Log reconciliation results
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/api-auth';
import { downloadAndStoreAudio } from '@/lib/audio-storage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, buildSessionSearchableContent } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';
const MAX_SESSIONS_PER_RUN = 20;

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// --- AUTH ---
function verifyCronAuth(request: NextRequest): { isValid: boolean; source: string } {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { isValid: true, source: 'vercel_cron' };
  }

  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature) {
    return { isValid: true, source: 'qstash' };
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey && apiKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  if (process.env.NODE_ENV === 'development') {
    return { isValid: true, source: 'development' };
  }

  return { isValid: false, source: 'none' };
}

// --- RECALL API HELPERS ---

interface RecallBotStatus {
  id: string;
  status: { code: string };
  transcript?: { text: string }[];
  recordings?: { media_shortcuts?: { audio?: { url: string }; video?: { url: string } } }[];
  video_url?: string;
  meeting_participants?: { name: string }[];
}

async function getRecallBotDetails(botId: string): Promise<RecallBotStatus | null> {
  const apiKey = process.env.RECALL_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function getRecallTranscript(botId: string): Promise<string | null> {
  const apiKey = process.env.RECALL_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(`${RECALL_API_URL}/bot/${botId}/transcript`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    if (Array.isArray(data) && data.length > 0) {
      return data
        .map((seg: any) => `${seg.speaker || 'Unknown'}: ${seg.words?.map((w: any) => w.text).join(' ') || seg.text || ''}`)
        .filter((line: string) => line.trim().length > 2)
        .join('\n');
    }
    return null;
  } catch {
    return null;
  }
}

// --- ANALYSIS (reuses process-session patterns) ---

function sanitizeForPrompt(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi, '[FILTERED]')
    .replace(/you\s+are\s+now/gi, '[FILTERED]')
    .replace(/system\s*:/gi, '[FILTERED]')
    .replace(/assistant\s*:/gi, '[FILTERED]')
    .substring(0, 50000);
}

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

async function analyzeTranscript(
  transcript: string,
  childName: string,
  childContext: { name: string; age: number; score: number | null; sessionsCompleted: number; recentSessions: string } | null,
): Promise<SessionAnalysis> {
  const sanitized = sanitizeForPrompt(transcript);
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
${sanitized.substring(0, 15000)}

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SessionAnalysis;
    }
  } catch (err: any) {
    console.error('Reconciliation AI analysis error:', err.message);
  }

  return {
    session_type: 'coaching',
    child_name: childName,
    focus_area: 'phonics',
    progress_rating: 'same',
    engagement_level: 'medium',
    flagged_for_attention: true,
    flag_reason: 'Reconciliation: automatic analysis failed - please review manually',
    summary: 'Session recovered via reconciliation. Manual review recommended.',
    parent_summary: `${childName} completed a reading session. Continue practicing reading at home for 10-15 minutes daily.`,
  };
}

async function getChildContext(supabase: ReturnType<typeof getSupabase>, childId: string) {
  const { data: child } = await supabase
    .from('children')
    .select('child_name, name, age, latest_assessment_score, sessions_completed')
    .eq('id', childId)
    .single();

  if (!child) return null;

  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('focus_area, progress_rating, ai_summary, scheduled_date')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(3);

  let recentSessions = '';
  if (sessions?.length) {
    recentSessions = sessions.map((s: any, i: number) =>
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

// --- SAVE SESSION DATA (mirrors process-session) ---

async function saveReconciliationData(
  supabase: ReturnType<typeof getSupabase>,
  sessionId: string,
  childId: string,
  coachId: string,
  transcriptText: string,
  analysis: SessionAnalysis,
  audioStoragePath?: string,
  botId?: string,
) {
  const childName = analysis.child_name || 'Child';

  // 1. Cache parent summary on child
  if (analysis.parent_summary) {
    await supabase
      .from('children')
      .update({
        last_session_summary: analysis.parent_summary,
        last_session_date: new Date().toISOString(),
        last_session_focus: analysis.focus_area,
      })
      .eq('id', childId);
  }

  // 2. Update scheduled_session
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
      transcript: transcriptText.substring(0, 10000),
      flagged_for_attention: analysis.flagged_for_attention,
      flag_reason: analysis.flag_reason,
      audio_storage_path: audioStoragePath,
    })
    .eq('id', sessionId);

  // 3. Create learning event with embedding
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
  } catch (err: any) {
    console.error('Reconciliation embedding error:', err.message);
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
      coach_talk_ratio: analysis.coach_talk_ratio,
      child_reading_samples: analysis.child_reading_samples,
      breakthrough_moment: analysis.breakthrough_moment,
      concerns_noted: analysis.concerns_noted,
      homework_assigned: analysis.homework_assigned,
      homework_description: analysis.homework_description,
      next_session_focus: analysis.next_session_focus,
      reconciled: true,
    },
    ai_summary: analysis.summary,
    content_for_embedding: `${childName} session: ${analysis.focus_area}`,
    embedding,
  });

  // 4. Increment sessions completed
  await supabase.rpc('increment_sessions_completed', { child_id_param: childId });
  await supabase
    .from('enrollments')
    .update({ consecutive_no_shows: 0, updated_at: new Date().toISOString() })
    .eq('child_id', childId)
    .eq('status', 'active');

  // 5. Update recall_bot_sessions if bot exists
  if (botId) {
    await supabase
      .from('recall_bot_sessions')
      .update({ status: 'completed', processing_completed_at: new Date().toISOString() })
      .eq('bot_id', botId);
  }
}

// --- LOG RECONCILIATION ---

async function logReconciliation(
  supabase: ReturnType<typeof getSupabase>,
  sessionId: string,
  botId: string | null,
  status: 'recovered' | 'no_transcript' | 'bot_not_found' | 'no_bot' | 'error',
  errorMessage?: string,
) {
  await supabase.from('recall_reconciliation_logs').insert({
    session_id: sessionId,
    bot_id: botId,
    status,
    error_message: errorMessage || null,
  });
}

// --- MAIN HANDLER ---

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const auth = verifyCronAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(JSON.stringify({ requestId, event: 'reconciliation_started', source: auth.source }));

  const supabase = getServiceSupabase();
  let recovered = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // 1. Find orphaned sessions: past sessions with recall_bot_id but no transcript
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: orphanedSessions, error: queryError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, recall_bot_id, scheduled_date, scheduled_time, duration_minutes, session_type')
      .not('recall_bot_id', 'is', null)
      .is('transcript', null)
      .in('recall_status', ['pending', 'scheduled', 'in_meeting', 'recording'])
      .neq('status', 'cancelled')
      .lt('scheduled_date', twoHoursAgo.split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(MAX_SESSIONS_PER_RUN);

    if (queryError) {
      console.error(JSON.stringify({ requestId, event: 'query_error', error: queryError.message }));
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    if (!orphanedSessions || orphanedSessions.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_orphaned_sessions' }));
      return NextResponse.json({ success: true, recovered: 0, skipped: 0, errors: 0 });
    }

    // Also find sessions where scheduled_date matches but time has passed
    // (for today's sessions that are >2hrs old)
    const { data: todayOrphans } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, recall_bot_id, scheduled_date, scheduled_time, duration_minutes, session_type')
      .not('recall_bot_id', 'is', null)
      .is('transcript', null)
      .in('recall_status', ['pending', 'scheduled', 'in_meeting', 'recording'])
      .neq('status', 'cancelled')
      .eq('scheduled_date', twoHoursAgo.split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(MAX_SESSIONS_PER_RUN);

    // Merge and deduplicate
    const allOrphans = [...(orphanedSessions || [])];
    if (todayOrphans?.length) {
      const existingIds = new Set(allOrphans.map(s => s.id));
      for (const s of todayOrphans) {
        // Check if session end time + 2hrs has passed
        const sessionEnd = new Date(`${s.scheduled_date}T${s.scheduled_time}`);
        sessionEnd.setMinutes(sessionEnd.getMinutes() + (s.duration_minutes || 30) + 120);
        if (sessionEnd < new Date() && !existingIds.has(s.id)) {
          allOrphans.push(s);
        }
      }
    }

    const sessionsToProcess = allOrphans.slice(0, MAX_SESSIONS_PER_RUN);

    console.log(JSON.stringify({
      requestId,
      event: 'orphaned_sessions_found',
      count: sessionsToProcess.length,
    }));

    // 2. Process each orphaned session
    for (const session of sessionsToProcess) {
      const botId = session.recall_bot_id;

      try {
        // 2a. Get bot status from Recall.ai
        const botDetails = await getRecallBotDetails(botId);

        if (!botDetails) {
          await logReconciliation(supabase, session.id, botId, 'bot_not_found');
          // Mark as failed so we don't retry forever
          await supabase
            .from('scheduled_sessions')
            .update({ recall_status: 'failed' })
            .eq('id', session.id);
          skipped++;
          continue;
        }

        const botStatus = botDetails.status?.code;

        // Only process if bot has finished (done status)
        if (!['done', 'fatal'].includes(botStatus)) {
          // Bot still in progress or waiting — skip for now
          skipped++;
          continue;
        }

        if (botStatus === 'fatal') {
          await logReconciliation(supabase, session.id, botId, 'error', `Bot status: fatal`);
          await supabase
            .from('scheduled_sessions')
            .update({ recall_status: 'failed' })
            .eq('id', session.id);
          skipped++;
          continue;
        }

        // 2b. Fetch transcript
        const transcript = await getRecallTranscript(botId);

        if (!transcript || transcript.trim().length < 20) {
          await logReconciliation(supabase, session.id, botId, 'no_transcript', 'Transcript empty or too short');
          await supabase
            .from('scheduled_sessions')
            .update({ recall_status: 'no_transcript' })
            .eq('id', session.id);
          skipped++;
          continue;
        }

        console.log(JSON.stringify({
          requestId,
          event: 'processing_orphan',
          sessionId: session.id,
          botId,
          transcriptLength: transcript.length,
        }));

        // 2c. Get child context for AI analysis
        const childContext = await getChildContext(supabase, session.child_id);
        const childName = childContext?.name || 'Child';

        // 2d. Run Gemini analysis
        const analysis = await analyzeTranscript(transcript, childName, childContext);

        // 2e. Download and store audio
        let audioStoragePath: string | undefined;
        try {
          const audioResult = await downloadAndStoreAudio(
            botId,
            session.id,
            session.child_id,
            session.scheduled_date,
          );
          if (audioResult.success) {
            audioStoragePath = audioResult.storagePath;

            // Update audio URLs
            const videoUrl = botDetails.recordings?.[0]?.media_shortcuts?.video?.url || botDetails.video_url;
            const videoExpiresAt = new Date();
            videoExpiresAt.setDate(videoExpiresAt.getDate() + 7);

            await supabase
              .from('scheduled_sessions')
              .update({
                audio_url: audioResult.publicUrl,
                audio_storage_path: audioStoragePath,
                ...(videoUrl ? { video_url: videoUrl, video_expires_at: videoExpiresAt.toISOString() } : {}),
                recording_processed_at: new Date().toISOString(),
              })
              .eq('id', session.id);
          }
        } catch (audioErr: any) {
          console.error(JSON.stringify({
            requestId,
            event: 'audio_download_error',
            sessionId: session.id,
            error: audioErr.message,
          }));
        }

        // 2f. Save all session data
        await saveReconciliationData(
          supabase,
          session.id,
          session.child_id,
          session.coach_id,
          transcript,
          analysis,
          audioStoragePath,
          botId,
        );

        // 2g. Queue parent summary
        if (analysis.parent_summary) {
          await supabase.from('communication_queue').insert({
            template_code: 'session_summary_parent',
            recipient_type: 'parent',
            related_entity_type: 'child',
            related_entity_id: session.child_id,
            variables: {
              child_name: childName,
              summary: analysis.parent_summary,
              session_id: session.id,
            },
            status: 'pending',
            request_id: requestId,
          });
        }

        await logReconciliation(supabase, session.id, botId, 'recovered');
        recovered++;

        console.log(JSON.stringify({
          requestId,
          event: 'session_recovered',
          sessionId: session.id,
          botId,
        }));

      } catch (sessionErr: any) {
        console.error(JSON.stringify({
          requestId,
          event: 'session_reconciliation_error',
          sessionId: session.id,
          error: sessionErr.message,
        }));
        await logReconciliation(supabase, session.id, botId, 'error', sessionErr.message);
        errors++;
      }

      // Rate limit: small delay between sessions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'reconciliation_completed',
      recovered,
      skipped,
      errors,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      recovered,
      skipped,
      errors,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'reconciliation_fatal_error',
      error: error.message,
      stack: error.stack,
    }));

    return NextResponse.json(
      { error: 'Reconciliation failed', message: error.message },
      { status: 500 }
    );
  }
}
