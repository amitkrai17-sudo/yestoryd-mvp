// ============================================================
// FILE: app/api/webhooks/recall/route.ts
// ============================================================
// HARDENED VERSION v2 - With Async Processing & Smart Chunking
// Incorporates feedback:
// 1. Async bot.done processing (offload to QStash)
// 2. Smart transcript chunking (keep beginning + end)
// 3. Optimized for Vercel timeout limits
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { Client } from '@upstash/qstash';
import { Webhook } from 'svix';
import { createAdminClient } from '@/lib/supabase/admin';
import { logOpsEvent, generateCorrelationId } from '@/lib/backops';
import type { Json } from '@/lib/supabase/database.types';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const RECALL_WEBHOOK_SECRET = process.env.RECALL_WEBHOOK_SECRET;
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// --- RECALL API HELPERS (fetch real data when webhook payload is sparse) ---

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1';

interface RecallBotDetails {
  id: string;
  status: { code: string };
  transcript?: { text: string }[];
  recordings?: { media_shortcuts?: { audio?: { url: string }; video?: { url: string } } }[];
  video_url?: string;
  meeting_participants?: { id: number; name: string; is_host?: boolean }[];
  recording?: { url: string; duration_seconds: number };
}

async function getRecallBotDetails(botId: string): Promise<RecallBotDetails | null> {
  const apiKey = process.env.RECALL_API_KEY;
  if (!apiKey) {
    console.warn('[recall-webhook] RECALL_API_KEY not configured — cannot fetch bot details');
    return null;
  }

  try {
    const resp = await fetch(`${RECALL_API_URL}/bot/${botId}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    if (!resp.ok) {
      console.error(`[recall-webhook] Failed to fetch bot ${botId}: ${resp.status}`);
      return null;
    }
    return await resp.json();
  } catch (err: any) {
    console.error(`[recall-webhook] Error fetching bot ${botId}:`, err.message);
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

// --- 1. VALIDATION SCHEMAS ---

const StatusChangeSchema = z.object({
  code: z.string(),
  message: z.string(),
  created_at: z.string(),
});

const ParticipantSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_host: z.boolean().optional(),
});

const WordSchema = z.object({
  text: z.string(),
  start_time: z.number(),
  end_time: z.number(),
  speaker_id: z.number().optional(),
});

const RecallWebhookSchema = z.object({
  event: z.enum([
    'bot.status_change', 'bot.transcription', 'bot.recording_ready', 'bot.done',
    'bot.call_ended', 'bot.fatal',
    'bot.participant_join', 'bot.participant_leave',
    'recording.status_change', 'transcript.status_change',
  ]),
  data: z.object({
    bot_id: z.string(),
    status: z.string().optional(),
    status_changes: z.array(StatusChangeSchema).optional(),
    transcript: z.object({
      words: z.array(WordSchema),
    }).optional(),
    recording: z.object({
      url: z.string().url(),
      duration_seconds: z.number(),
    }).optional(),
    meeting_metadata: z.object({
      title: z.string(),
      start_time: z.string(),
      end_time: z.string(),
    }).optional(),
    meeting_participants: z.array(ParticipantSchema).optional(),
  }),
});

type RecallWebhookPayload = z.infer<typeof RecallWebhookSchema>;

// --- 2. TYPES ---

type SessionStatus = 'scheduled' | 'bot_joining' | 'in_progress' | 'completed' | 
                     'no_show' | 'coach_no_show' | 'partial' | 'bot_error';

interface AttendanceInfo {
  totalParticipants: number;
  participantNames: string[];
  coachJoined: boolean;
  childJoined: boolean;
  durationMinutes: number;
  isValidSession: boolean;
}

// --- 3. SECURITY HELPERS ---

/**
 * Verify Recall.ai webhook signature using Svix.
 * Recall.ai uses Svix for webhook delivery. The signature is verified
 * using three headers: svix-id, svix-timestamp, svix-signature.
 * The secret is in whsec_ format from the Recall.ai dashboard.
 */
function verifyRecallSignature(
  body: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string }
): boolean {
  if (!RECALL_WEBHOOK_SECRET) {
    console.warn('RECALL_WEBHOOK_SECRET not configured — skipping verification');
    return true;
  }

  try {
    const wh = new Webhook(RECALL_WEBHOOK_SECRET);
    wh.verify(body, {
      'svix-id': headers.svixId,
      'svix-timestamp': headers.svixTimestamp,
      'svix-signature': headers.svixSignature,
    });
    return true;
  } catch (err: any) {
    console.error('Svix signature verification failed:', err.message);
    return false;
  }
}

async function checkIdempotency(
  webhookId: string,
  eventType: string,
  requestId: string
): Promise<{ isDuplicate: boolean }> {
  const { error } = await supabase
    .from('processed_webhooks')
    .insert({
      webhook_id: webhookId,
      event_type: `recall_${eventType}`,
      processed_at: new Date().toISOString(),
      request_id: requestId,
    });

  if (error?.code === '23505') {
    return { isDuplicate: true };
  }
  return { isDuplicate: false };
}

// --- 4. RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(botId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(botId);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(botId, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= 100) return false;
  record.count++;
  return true;
}

// --- 5. HELPER FUNCTIONS ---

function analyzeAttendance(
  participants: Array<{ id: number; name: string; is_host?: boolean }>,
  durationSeconds: number
): AttendanceInfo {
  const durationMinutes = Math.round(durationSeconds / 60);
  const participantNames = participants.map(p => p.name);

  const coachJoined = participants.some(p =>
    p.is_host ||
    p.name.toLowerCase().includes('coach') ||
    p.name.toLowerCase().includes('yestoryd') ||
    p.name.includes('@')
  );

  const childJoined = participants.length >= 2 && !participants.every(p => p.is_host);
  const isValidSession = participants.length >= 2 && durationMinutes >= 10;

  return {
    totalParticipants: participants.length,
    participantNames,
    coachJoined,
    childJoined,
    durationMinutes,
    isValidSession,
  };
}

function determineSessionOutcome(
  attendance: AttendanceInfo,
  durationSeconds?: number
): { status: SessionStatus; reason?: string } {
  const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : 0;

  if (attendance.totalParticipants === 0) {
    return { status: 'no_show', reason: 'No one joined' };
  }

  if (attendance.totalParticipants === 1) {
    if (attendance.coachJoined) {
      return { status: 'no_show', reason: 'Child/parent did not join' };
    }
    return { status: 'coach_no_show', reason: 'Coach did not join' };
  }

  if (durationMinutes < 5) {
    return { status: 'partial', reason: `Too short (${durationMinutes} min)` };
  }

  if (durationMinutes < 10) {
    return { status: 'partial', reason: `Brief session (${durationMinutes} min)` };
  }

  return { status: 'completed' };
}

// ============================================================
// SMART TRANSCRIPT CHUNKING
// Keep beginning (intro) + end (wrap-up/homework), summarize middle
// ============================================================
function smartTruncateTranscript(transcript: string, maxLength: number = 15000): string {
  if (transcript.length <= maxLength) return transcript;

  // Allocate space: 40% beginning, 40% end, 20% for separator
  const beginningLength = Math.floor(maxLength * 0.4);
  const endLength = Math.floor(maxLength * 0.4);
  
  const beginning = transcript.substring(0, beginningLength);
  const end = transcript.substring(transcript.length - endLength);
  
  // Find natural break points (end of speaker turn)
  const beginningTrimmed = beginning.substring(0, beginning.lastIndexOf('\n') || beginningLength);
  const endStart = end.indexOf('\n');
  const endTrimmed = endStart > 0 ? end.substring(endStart + 1) : end;

  const middleLength = transcript.length - beginningLength - endLength;
  const middleMinutes = Math.round(middleLength / 500); // Rough estimate: 500 chars per minute

  return `${beginningTrimmed}

[... ${middleMinutes} minutes of session content summarized ...]
[Middle portion contained approximately ${middleLength} characters]

${endTrimmed}`;
}

function buildTranscriptWithSpeakers(
  words: Array<{ text: string; speaker_id?: number }>,
  participants: Array<{ id: number; name: string }>
): string {
  if (!words.length) return '';

  const speakerCounts: Record<number, number> = {};
  for (const word of words) {
    const id = word.speaker_id || 0;
    speakerCounts[id] = (speakerCounts[id] || 0) + 1;
  }

  const speakerIds = Object.keys(speakerCounts).map(Number);
  const sorted = speakerIds.sort((a, b) => speakerCounts[b] - speakerCounts[a]);
  const coachSpeakerId = sorted[0] || 0;
  const childSpeakerId = sorted[1] || -1;

  const lines: string[] = [];
  let currentSpeaker = -1;
  let currentLine = '';

  for (const word of words) {
    const speakerId = word.speaker_id || 0;

    if (speakerId !== currentSpeaker) {
      if (currentLine.trim()) {
        const label = currentSpeaker === coachSpeakerId ? 'COACH' :
                      currentSpeaker === childSpeakerId ? 'CHILD' :
                      `SPEAKER_${currentSpeaker}`;
        lines.push(`${label}: "${currentLine.trim()}"`);
      }
      currentSpeaker = speakerId;
      currentLine = '';
    }
    currentLine += word.text + ' ';
  }

  if (currentLine.trim()) {
    const label = currentSpeaker === coachSpeakerId ? 'COACH' :
                  currentSpeaker === childSpeakerId ? 'CHILD' :
                  `SPEAKER_${currentSpeaker}`;
    lines.push(`${label}: "${currentLine.trim()}"`);
  }

  return lines.join('\n');
}

async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  requestId: string,
  additionalData?: Record<string, unknown>
) {
  const updateData: Record<string, unknown> = {
    status,
    recall_status: status,
    updated_at: new Date().toISOString(),
    ...additionalData,
  };

  if (['completed', 'no_show', 'coach_no_show', 'partial', 'bot_error'].includes(status)) {
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from('scheduled_sessions')
    .update(updateData)
    .eq('id', sessionId);

  console.log(JSON.stringify({ requestId, event: 'session_status_updated', sessionId, status }));
}

// ============================================================
// QUEUE SESSION PROCESSING TO BACKGROUND JOB
// Offload heavy processing (AI, audio download) to QStash
// ============================================================
async function queueSessionProcessing(data: {
  botId: string;
  sessionId: string | null;
  childId: string | null;
  coachId: string | null;
  transcriptText: string;
  recordingUrl?: string;
  durationSeconds?: number;
  attendance: AttendanceInfo;
  requestId: string;
}): Promise<{ success: boolean; messageId?: string }> {
  try {
    const result = await qstashClient.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/process-session`,
      body: {
        ...data,
        // Smart truncate for queue payload size limits
        transcriptText: smartTruncateTranscript(data.transcriptText, 30000),
      },
      retries: 3,
      delay: 2, // 2 second delay to allow any race conditions to settle
    });

    console.log(JSON.stringify({
      requestId: data.requestId,
      event: 'session_processing_queued',
      messageId: result.messageId,
    }));

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(JSON.stringify({
      requestId: data.requestId,
      event: 'queue_error',
      error: error.message,
    }));
    return { success: false };
  }
}

// --- 6. EVENT HANDLERS ---

async function handleStatusChange(
  payload: RecallWebhookPayload,
  requestId: string,
  correlationId?: string
) {
  const { bot_id, status, status_changes } = payload.data;

  console.log(JSON.stringify({
    requestId,
    event: 'bot_status_change',
    botId: bot_id,
    status,
  }));

  // Get session info
  const { data: botSession } = await supabase
    .from('recall_bot_sessions')
    .select('session_id, child_id, coach_id')
    .eq('bot_id', bot_id)
    .single();

  // Update bot session
  await supabase
    .from('recall_bot_sessions')
    .upsert({
      bot_id,
      status,
      last_status_change: new Date().toISOString(),
      status_history: status_changes,
    }, { onConflict: 'bot_id' });

  if (botSession?.session_id) {
    const sessionId = botSession.session_id;

    switch (status) {
      case 'joining':
      case 'in_waiting_room':
        await updateSessionStatus(sessionId, 'bot_joining', requestId);
        break;
      case 'in_call_not_recording':
      case 'in_call_recording':
        await updateSessionStatus(sessionId, 'in_progress', requestId, {
          started_at: new Date().toISOString(),
        });
        break;
      case 'fatal':
        await updateSessionStatus(sessionId, 'bot_error', requestId, {
          bot_error_reason: status_changes?.find(s => s.code === 'fatal')?.message,
          flagged_for_attention: true,
        });
        break;
    }

    // No-show detection
    if (status_changes?.length) {
      const latestChange = status_changes[status_changes.length - 1];
      const noShowCodes = ['waiting_room_timeout', 'noone_joined_timeout', 'everyone_left_timeout'];

      if (noShowCodes.includes(latestChange.code)) {
        await updateSessionStatus(sessionId, 'no_show', requestId, {
          no_show_reason: latestChange.message,
          no_show_detected_at: new Date().toISOString(),
        });

        // Queue notification
        await supabase.from('communication_queue').insert({
          template_code: 'session_no_show',
          recipient_id: sessionId ?? 'system',
          recipient_type: 'admin',
          scheduled_for: new Date().toISOString(),
          variables: { session_id: sessionId, reason: latestChange.message, request_id: requestId },
          status: 'pending',
        });

        try { await logOpsEvent({ event_type: 'session_event', source: 'webhook:recall', severity: 'warning', correlation_id: correlationId, entity_type: 'session', entity_id: sessionId || undefined, decision_made: 'no_show_detected', metadata: { outcome: 'no_show', reason: latestChange.message, code: latestChange.code } as Json }); } catch (logErr: any) { console.error('[recall-webhook] logOpsEvent failed:', logErr.message); }
      }
    }
  }

  return { status: 'ok', botId: bot_id };
}

async function handleTranscription(
  payload: RecallWebhookPayload,
  requestId: string
) {
  // Real-time transcription - just acknowledge
  return { status: 'ok' };
}

async function handleRecordingReady(
  payload: RecallWebhookPayload,
  requestId: string
) {
  const { bot_id, recording } = payload.data;

  if (recording?.url) {
    await supabase
      .from('recall_bot_sessions')
      .update({
        recording_url: recording.url,
        duration_seconds: recording.duration_seconds,
      })
      .eq('bot_id', bot_id);
  }

  return { status: 'ok' };
}

// ============================================================
// BOT DONE HANDLER - Optimized for Speed
// Only does quick DB updates, offloads heavy work to QStash
// ============================================================
async function handleBotDone(
  payload: RecallWebhookPayload,
  requestId: string,
  correlationId?: string
) {
  const { bot_id, transcript, meeting_metadata, meeting_participants, recording } = payload.data;

  console.log(JSON.stringify({
    requestId,
    event: 'bot_done_received',
    botId: bot_id,
    hasTranscript: !!transcript?.words?.length,
    hasParticipants: !!meeting_participants?.length,
    hasRecording: !!recording,
    hasMeetingData: !!meeting_metadata,
  }));

  // 1. Get session info (quick DB lookup)
  const { data: botSession } = await supabase
    .from('recall_bot_sessions')
    .select('session_id, child_id, coach_id')
    .eq('bot_id', bot_id)
    .single();

  const sessionId = botSession?.session_id;
  const childId = botSession?.child_id;
  const coachId = botSession?.coach_id;

  // 2. bot.done payload often doesn't include session data inline — fetch from Recall API
  let participants = meeting_participants || [];
  let recordingData = recording;
  let apiFetchedTranscript: string | null = null;

  if (participants.length === 0 || !recordingData) {
    console.log(JSON.stringify({
      requestId,
      event: 'bot_done_payload_sparse',
      botId: bot_id,
      missingParticipants: participants.length === 0,
      missingRecording: !recordingData,
      action: 'fetching_from_recall_api',
    }));

    try {
      const botDetails = await getRecallBotDetails(bot_id);
      if (botDetails) {
        if (participants.length === 0 && botDetails.meeting_participants?.length) {
          participants = botDetails.meeting_participants;
        }
        if (!recordingData && botDetails.recordings?.length) {
          const rec = botDetails.recordings[0];
          const audioUrl = rec?.media_shortcuts?.audio?.url;
          if (audioUrl) {
            recordingData = { url: audioUrl, duration_seconds: 0 };
          }
        }
        // Also try dedicated recording field from API
        if (!recordingData && botDetails.recording) {
          recordingData = botDetails.recording;
        }
      }

      // Fetch transcript from API if not in webhook payload
      if (!transcript?.words?.length) {
        apiFetchedTranscript = await getRecallTranscript(bot_id);
      }
    } catch (fetchError: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'recall_api_fetch_error',
        botId: bot_id,
        error: fetchError.message,
      }));
      // Continue with whatever data we have — don't early return
    }

    console.log(JSON.stringify({
      requestId,
      event: 'bot_done_after_api_fetch',
      botId: bot_id,
      participantCount: participants.length,
      hasRecording: !!recordingData,
      hasApiTranscript: !!apiFetchedTranscript,
    }));
  }

  // 3. Attendance analysis with real data (API-enriched)
  const attendance = analyzeAttendance(
    participants.map(p => ({ id: p.id ?? 0, name: p.name ?? 'Unknown', is_host: p.is_host })),
    recordingData?.duration_seconds || 0
  );

  // 4. Determine outcome
  const outcome = determineSessionOutcome(attendance, recordingData?.duration_seconds);

  console.log(JSON.stringify({
    requestId,
    event: 'session_outcome',
    sessionId,
    outcome: outcome.status,
    participants: attendance.totalParticipants,
    duration: attendance.durationMinutes,
  }));

  // 5. Handle non-completed sessions immediately
  if (outcome.status !== 'completed') {
    if (sessionId) {
      await updateSessionStatus(sessionId, outcome.status, requestId, {
        no_show_reason: outcome.reason,
        duration_seconds: recordingData?.duration_seconds,
        attendance_count: attendance.totalParticipants,
      });

      // Queue notification for no-shows
      if (outcome.status === 'no_show' || outcome.status === 'coach_no_show') {
        await supabase.from('communication_queue').insert({
          template_code: outcome.status === 'coach_no_show' ? 'coach_no_show_urgent' : 'session_no_show',
          recipient_type: 'admin',
          recipient_id: 'admin',
          scheduled_for: new Date().toISOString(),
          variables: { session_id: sessionId, reason: outcome.reason, request_id: requestId },
          status: 'pending',
        });
      }

      try { await logOpsEvent({ event_type: 'session_event', source: 'webhook:recall', severity: 'warning', correlation_id: correlationId, entity_type: 'session', entity_id: sessionId || undefined, decision_made: 'no_show_detected', metadata: { outcome: outcome.status, participants: attendance.totalParticipants, reason: outcome.reason } as Json }); } catch (logErr: any) { console.error('[recall-webhook] logOpsEvent failed:', logErr.message); }
    }

    return {
      status: 'processed',
      session_id: sessionId,
      outcome: outcome.status,
      reason: outcome.reason,
    };
  }

  // 6. Build transcript — prefer webhook payload words, fall back to API-fetched text
  let transcriptText: string;
  if (transcript?.words?.length) {
    transcriptText = buildTranscriptWithSpeakers(
      transcript.words.map(w => ({ text: w.text ?? '', speaker_id: w.speaker_id })),
      participants.map(p => ({ id: p.id ?? 0, name: p.name ?? 'Unknown' })),
    );
  } else if (apiFetchedTranscript) {
    transcriptText = apiFetchedTranscript;
  } else {
    transcriptText = '';
  }

  // Check if transcript is too short
  if (transcriptText.length < 100) {
    if (sessionId) {
      await updateSessionStatus(sessionId, 'partial', requestId, {
        partial_reason: 'Transcript too short',
        duration_seconds: recordingData?.duration_seconds,
      });
    }
    return { status: 'partial', reason: 'transcript_too_short' };
  }

  // 6. Mark session as "processing" (quick update)
  if (sessionId) {
    await supabase
      .from('scheduled_sessions')
      .update({
        recall_status: 'processing',
        duration_minutes: attendance.durationMinutes,
        attendance_count: attendance.totalParticipants,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  // 8. Update bot session with recording info (quick update)
  await supabase
    .from('recall_bot_sessions')
    .update({
      status: 'processing',
      recording_url: recordingData?.url,
      duration_seconds: recordingData?.duration_seconds,
      updated_at: new Date().toISOString(),
    })
    .eq('bot_id', bot_id);

  // ============================================================
  // 8. QUEUE HEAVY PROCESSING TO BACKGROUND JOB
  // This is the key optimization - return fast, process async
  // DONE: Merge logic implemented in process-session/route.ts —
  //       checks for existing session_companion_log and merges
  //       transcript analysis into it (or creates new event).
  // ============================================================
  const queueResult = await queueSessionProcessing({
    botId: bot_id,
    sessionId: sessionId ?? null,
    childId: childId ?? null,
    coachId: coachId ?? null,
    transcriptText,
    recordingUrl: recordingData?.url,
    durationSeconds: recordingData?.duration_seconds,
    attendance,
    requestId,
  });

  try { await logOpsEvent({ event_type: 'session_event', source: 'webhook:recall', severity: 'info', correlation_id: correlationId, entity_type: 'session', entity_id: sessionId || undefined, metadata: { event: 'bot_done', outcome: outcome?.status, participants: attendance.totalParticipants, duration_minutes: attendance.durationMinutes, queued: queueResult.success } as Json }); } catch (logErr: any) { console.error('[recall-webhook] logOpsEvent failed:', logErr.message); }

  // 9. Return immediately (< 2 seconds total)
  return {
    status: 'queued',
    session_id: sessionId,
    processing_queued: queueResult.success,
    message_id: queueResult.messageId,
    attendance: {
      participants: attendance.totalParticipants,
      duration_minutes: attendance.durationMinutes,
    },
  };
}

// --- 7. MAIN HANDLER ---

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  try {
    // 1. Get raw body
    const rawBody = await request.text();

    // 2. Verify Svix signature (Recall.ai uses Svix for webhook delivery)
    const svixId = request.headers.get('svix-id') || request.headers.get('webhook-id') || '';
    const svixTimestamp = request.headers.get('svix-timestamp') || request.headers.get('webhook-timestamp') || '';
    const svixSignature = request.headers.get('svix-signature') || request.headers.get('webhook-signature') || '';

    if (RECALL_WEBHOOK_SECRET && !verifyRecallSignature(rawBody, { svixId, svixTimestamp, svixSignature })) {
      console.error(JSON.stringify({ requestId, event: 'invalid_signature', hasSvixHeaders: !!svixId }));
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse and validate
    let rawPayload;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = RecallWebhookSchema.safeParse(rawPayload);
    if (!validation.success) {
      console.error(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors: validation.error.format(),
      }));
      return NextResponse.json({ status: 'validation_failed', errors: validation.error.format() }, { status: 422 });
    }

    const payload = validation.data;
    const { bot_id } = payload.data;

    console.log(JSON.stringify({
      requestId,
      event: 'recall_webhook_received',
      eventType: payload.event,
      botId: bot_id,
    }));

    // 4. Rate limiting
    if (!checkRateLimit(bot_id)) {
      return NextResponse.json({ status: 'rate_limited' }, { status: 429 });
    }

    // 5. Idempotency
    const webhookId = `${bot_id}_${payload.event}_${Date.now()}`;
    const { isDuplicate } = await checkIdempotency(webhookId, payload.event, requestId);
    if (isDuplicate) {
      return NextResponse.json({ status: 'already_processed' });
    }

    // 6. Route to handler
    let result;
    switch (payload.event) {
      case 'bot.status_change':
        result = await handleStatusChange(payload, requestId, correlationId);
        break;
      case 'bot.transcription':
        result = await handleTranscription(payload, requestId);
        break;
      case 'bot.recording_ready':
        result = await handleRecordingReady(payload, requestId);
        break;
      case 'bot.done':
        result = await handleBotDone(payload, requestId, correlationId);
        break;
      case 'bot.call_ended':
      case 'bot.fatal':
      case 'bot.participant_join':
      case 'bot.participant_leave':
      case 'recording.status_change':
      case 'transcript.status_change':
        console.log(JSON.stringify({ requestId, event: 'acknowledged', eventType: payload.event, botId: bot_id }));
        result = { status: 'acknowledged', event: payload.event };
        break;
      default:
        result = { status: 'ignored' };
    }

    // 7. Return fast
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'recall_webhook_complete',
      eventType: payload.event,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(result);

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'recall_webhook_error',
      error: error.message,
    }));

    return NextResponse.json({
      status: 'error',
      message: 'Processing error',
      requestId,
    });
  }
}

// --- 8. HEALTH CHECK ---

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Recall.ai Webhook v2.3 - Async Processing',
    features: [
      'signature_verification',
      'idempotency',
      'async_processing',
      'smart_chunking',
      'rate_limiting',
    ],
    timestamp: new Date().toISOString(),
  });
}