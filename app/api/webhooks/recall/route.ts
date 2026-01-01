// file: app/api/webhooks/recall/route.ts
// rAI v2.2 - Session Intelligence: No-show detection, attendance tracking, completion management

import { checkAndSendProactiveNotifications } from '@/lib/rai/proactive-notifications';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, buildSessionSearchableContent } from '@/lib/rai/embeddings';
import { downloadAndStoreAudio } from '@/lib/audio-storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const RECALL_WEBHOOK_SECRET = process.env.RECALL_WEBHOOK_SECRET;

// ============================================================
// TYPES
// ============================================================

interface RecallWebhookPayload {
  event: 'bot.status_change' | 'bot.transcription' | 'bot.recording_ready' | 'bot.done';
  data: {
    bot_id: string;
    status?: string;
    status_changes?: Array<{
      code: string;
      message: string;
      created_at: string;
    }>;
    transcript?: {
      words: Array<{
        text: string;
        start_time: number;
        end_time: number;
        speaker?: string;
        speaker_id?: number;
      }>;
    };
    recording?: {
      url: string;
      duration_seconds: number;
    };
    meeting_metadata?: {
      title: string;
      start_time: string;
      end_time: string;
    };
    meeting_participants?: Array<{
      id: number;
      name: string;
      is_host?: boolean;
      events?: Array<{
        code: string;
        created_at: string;
      }>;
    }>;
  };
}

interface SessionAnalysis {
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
  parent_sentiment?: string | null;
  parent_sees_progress?: string | null;
  home_practice_frequency?: string | null;
  concerns_raised?: string[] | null;
  action_items?: string | null;
  session_type?: string;
  child_name?: string | null;
  summary?: string;
  parent_summary?: string;
  concerns_array?: string[] | null;
  safety_flag?: boolean;
  safety_reason?: string | null;
  sentiment_score?: number;
}

// ============================================================
// SESSION STATUS TYPES (for scheduled_sessions.status)
// ============================================================
type SessionStatus =
  | 'scheduled'      // Initial state
  | 'bot_joining'    // Bot is joining the meeting
  | 'in_progress'    // Session actively happening
  | 'completed'      // Session completed successfully
  | 'no_show'        // No one joined (child/parent didn't show)
  | 'coach_no_show'  // Coach didn't join
  | 'partial'        // Session ended early / incomplete
  | 'cancelled'      // Manually cancelled
  | 'bot_error';     // Technical failure

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    if (RECALL_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-recall-signature');
      if (!signature) {
        console.warn('Recall webhook: Missing signature header');
      }
    }

    const payload: RecallWebhookPayload = await request.json();
    console.log('📹 Recall webhook received:', payload.event, payload.data.bot_id);

    switch (payload.event) {
      case 'bot.status_change':
        return handleStatusChange(payload);

      case 'bot.transcription':
        return handleTranscription(payload);

      case 'bot.recording_ready':
        return handleRecordingReady(payload);

      case 'bot.done':
        return handleBotDone(payload);

      default:
        console.log('Unhandled event type:', payload.event);
        return NextResponse.json({ status: 'ignored' });
    }

  } catch (error) {
    console.error('Recall webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// STATUS CHANGE HANDLER - Session Intelligence Core
// ============================================================

async function handleStatusChange(payload: RecallWebhookPayload) {
  const { bot_id, status, status_changes } = payload.data;

  console.log(`🤖 Bot ${bot_id} status: ${status}`);

  // Get session info
  const { data: botSession } = await supabase
    .from('recall_bot_sessions')
    .select('session_id, child_id, coach_id')
    .eq('bot_id', bot_id)
    .single();

  // Update bot session status
  await supabase
    .from('recall_bot_sessions')
    .upsert({
      bot_id,
      status,
      last_status_change: new Date().toISOString(),
      status_history: status_changes,
    }, { onConflict: 'bot_id' });

  // ============================================================
  // SESSION INTELLIGENCE: Update session status based on bot status
  // ============================================================

  if (botSession?.session_id) {
    const sessionId = botSession.session_id;

    switch (status) {
      case 'joining':
      case 'in_waiting_room':
        // Bot is attempting to join
        await updateSessionStatus(sessionId, 'bot_joining');
        break;

      case 'in_call_not_recording':
      case 'in_call_recording':
        // Session has started
        await updateSessionStatus(sessionId, 'in_progress', {
          started_at: new Date().toISOString(),
        });
        break;

      case 'call_ended':
        // Will be handled more completely in bot.done
        console.log(`📞 Call ended for session ${sessionId}`);
        break;

      case 'fatal':
        // Bot encountered an error
        await handleBotError(sessionId, status_changes);
        break;
    }
  }

  // ============================================================
  // NO-SHOW DETECTION from status_changes
  // ============================================================

  if (status_changes && status_changes.length > 0) {
    const latestChange = status_changes[status_changes.length - 1];

    if (botSession?.session_id) {
      await detectNoShowFromStatusChange(
        botSession.session_id,
        botSession.child_id,
        botSession.coach_id,
        latestChange.code,
        latestChange.message
      );
    }
  }

  return NextResponse.json({ status: 'ok' });
}

// ============================================================
// NO-SHOW DETECTION LOGIC
// ============================================================

async function detectNoShowFromStatusChange(
  sessionId: string,
  childId: string | null,
  coachId: string | null,
  statusCode: string,
  statusMessage: string
) {
  console.log(`🔍 Checking no-show: ${statusCode} - ${statusMessage}`);

  // Recall.ai leave reason codes that indicate no-show
  const noShowCodes = [
    'waiting_room_timeout',    // Bot wasn't let in from waiting room
    'noone_joined_timeout',    // No one joined after bot waited
    'everyone_left_timeout',   // Everyone left early
  ];

  const errorCodes = [
    'fatal_error',
    'bot_kicked',
    'connection_failed',
  ];

  if (noShowCodes.includes(statusCode)) {
    console.log(`⚠️ NO-SHOW detected: ${statusCode}`);

    // Determine who was missing
    const noShowStatus: SessionStatus = 'no_show';
    const noShowReason = statusMessage || statusCode;

    // Update session status
    await updateSessionStatus(sessionId, noShowStatus, {
      no_show_reason: noShowReason,
      no_show_detected_at: new Date().toISOString(),
    });

    // Send no-show notification
    await sendNoShowNotification(sessionId, childId, coachId, noShowReason);

  } else if (errorCodes.includes(statusCode)) {
    console.log(`❌ Bot error: ${statusCode}`);

    await updateSessionStatus(sessionId, 'bot_error', {
      bot_error_reason: statusMessage || statusCode,
      bot_error_at: new Date().toISOString(),
    });
  }
}

// ============================================================
// BOT ERROR HANDLER
// ============================================================

async function handleBotError(sessionId: string, statusChanges?: Array<{ code: string; message: string }>) {
  const errorMessage = statusChanges?.find(s => s.code === 'fatal')?.message || 'Unknown bot error';

  await updateSessionStatus(sessionId, 'bot_error', {
    bot_error_reason: errorMessage,
    bot_error_at: new Date().toISOString(),
    flagged_for_attention: true,
    flag_reason: `Bot error: ${errorMessage}`,
  });

  // Notify admin of bot failure
  await notifyAdminOfBotError(sessionId, errorMessage);
}

// ============================================================
// TRANSCRIPTION HANDLER
// ============================================================

async function handleTranscription(payload: RecallWebhookPayload) {
  console.log('Real-time transcription received for bot:', payload.data.bot_id);
  return NextResponse.json({ status: 'ok' });
}

// ============================================================
// RECORDING READY HANDLER
// ============================================================

async function handleRecordingReady(payload: RecallWebhookPayload) {
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

  return NextResponse.json({ status: 'ok' });
}

// ============================================================
// BOT DONE HANDLER - Main Session Processing
// ============================================================

async function handleBotDone(payload: RecallWebhookPayload) {
  const { bot_id, transcript, meeting_metadata, meeting_participants, recording } = payload.data;

  console.log('🎬 Bot done, processing for:', bot_id);

  // Get session info
  const { data: botSession } = await supabase
    .from('recall_bot_sessions')
    .select('session_id, child_id, coach_id')
    .eq('bot_id', bot_id)
    .single();

  // ============================================================
  // ATTENDANCE TRACKING
  // ============================================================
  const attendance = analyzeAttendance(meeting_participants || [], recording?.duration_seconds || 0);
  console.log('👥 Attendance:', attendance);

  // Build transcript
  const transcriptText = buildTranscriptWithSpeakers(
    transcript?.words || [],
    meeting_participants || []
  );

  // ============================================================
  // DETERMINE SESSION OUTCOME
  // ============================================================

  let sessionId = botSession?.session_id;
  let childId = botSession?.child_id;
  let coachId = botSession?.coach_id;

  // Try to find session if not linked
  if (!sessionId) {
    const session = await findSessionByMeeting(
      meeting_metadata?.title || '',
      meeting_metadata?.start_time || new Date().toISOString(),
      meeting_participants?.map(p => p.name) || []
    );

    if (session) {
      sessionId = session.id;
      childId = session.child_id;
      coachId = session.coach_id;
    }
  }

  // ============================================================
  // SESSION INTELLIGENCE: Determine final status
  // ============================================================

  const sessionOutcome = determineSessionOutcome(attendance, transcriptText, recording?.duration_seconds);
  console.log('📊 Session outcome:', sessionOutcome);

  if (sessionOutcome.status !== 'completed') {
    // Handle non-completed sessions (no-show, partial, etc.)
    if (sessionId) {
      await updateSessionStatus(sessionId, sessionOutcome.status, {
        no_show_reason: sessionOutcome.reason,
        attendance_summary: attendance,
        duration_seconds: recording?.duration_seconds,
      });

      // Send appropriate notifications
      if (sessionOutcome.status === 'no_show') {
        await sendNoShowNotification(sessionId, childId, coachId, sessionOutcome.reason || 'No one joined');
      } else if (sessionOutcome.status === 'coach_no_show') {
        await sendCoachNoShowNotification(sessionId, childId, coachId);
      }
    }

    return NextResponse.json({
      status: 'processed',
      session_id: sessionId,
      outcome: sessionOutcome.status,
      reason: sessionOutcome.reason,
      attendance,
    });
  }

  // ============================================================
  // FULL SESSION PROCESSING (for completed sessions)
  // ============================================================

  // Skip analysis if transcript too short
  if (!transcriptText || transcriptText.length < 100) {
    console.log('Transcript too short, marking as partial');

    if (sessionId) {
      await updateSessionStatus(sessionId, 'partial', {
        partial_reason: 'Transcript too short - session may have been cut short',
        duration_seconds: recording?.duration_seconds,
        attendance_summary: attendance,
      });
    }

    return NextResponse.json({ status: 'partial', reason: 'transcript_too_short' });
  }

  // Get child context
  const childContext = childId ? await getChildContext(childId) : null;
  const childName = childContext?.name || 'the child';

  // Analyze transcript
  const analysis = await analyzeTranscript(transcriptText, childContext, childName);

  // ============================================================
  // AUDIO STORAGE
  // ============================================================
  let audioResult: { success: boolean; storagePath?: string; publicUrl?: string; error?: string } = { success: false };

  if (sessionId && childId) {
    const { data: sessionData } = await supabase
      .from('scheduled_sessions')
      .select('scheduled_date')
      .eq('id', sessionId)
      .single();

    const sessionDate = sessionData?.scheduled_date || new Date().toISOString().split('T')[0];

    console.log('📥 Downloading audio for permanent storage...');
    audioResult = await downloadAndStoreAudio(bot_id, sessionId, childId, sessionDate);

    if (audioResult.success) {
      console.log('✅ Audio stored:', audioResult.storagePath);

      const videoExpiresAt = new Date();
      videoExpiresAt.setDate(videoExpiresAt.getDate() + 7);

      await supabase
        .from('scheduled_sessions')
        .update({
          audio_url: audioResult.publicUrl,
          audio_storage_path: audioResult.storagePath,
          video_url: recording?.url,
          video_expires_at: videoExpiresAt.toISOString(),
          recording_processed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    } else {
      console.error('⚠️ Audio storage failed:', audioResult.error);
    }
  }

  // ============================================================
  // SAVE ALL SESSION DATA
  // ============================================================

  await saveSessionData({
    sessionId,
    childId,
    coachId,
    childName,
    transcriptText,
    analysis,
    recordingUrl: recording?.url,
    durationSeconds: recording?.duration_seconds,
    attendance,
  });

  // ============================================================
  // PROACTIVE NOTIFICATIONS
  // ============================================================

  if (childId && analysis) {
    try {
      const triggerResult = await checkAndSendProactiveNotifications({
        childId,
        childName,
        sessionId,
        coachId,
        analysis,
      });

      if (triggerResult.sent) {
        console.log('🚨 Proactive notifications sent:', triggerResult.notifications);
      }
    } catch (triggerError) {
      console.error('Proactive trigger error (non-fatal):', triggerError);
    }
  }

  // ============================================================
  // SEND PARENT SESSION SUMMARY
  // ============================================================

  if (childId && analysis.parent_summary) {
    await sendParentSessionSummary(sessionId, childId, childName, analysis.parent_summary);
  }

  console.log('✅ Session processed successfully');

  return NextResponse.json({
    status: 'completed',
    session_id: sessionId,
    child_detected: analysis.child_name,
    parent_summary_cached: !!analysis.parent_summary,
    audio_stored: audioResult.success,
    audio_path: audioResult.storagePath,
    attendance,
  });
}

// ============================================================
// ATTENDANCE ANALYSIS
// ============================================================

interface AttendanceInfo {
  totalParticipants: number;
  participantNames: string[];
  coachJoined: boolean;
  childJoined: boolean;
  durationMinutes: number;
  isValidSession: boolean;
}

function analyzeAttendance(
  participants: Array<{ id: number; name: string; is_host?: boolean }>,
  durationSeconds: number
): AttendanceInfo {
  const participantNames = participants.map(p => p.name);
  const durationMinutes = Math.round(durationSeconds / 60);

  // Heuristics to determine who joined
  // Coach usually has longer/professional name or is host
  // Child usually has shorter name or parent's name
  const coachJoined = participants.some(p =>
    p.is_host ||
    p.name.toLowerCase().includes('coach') ||
    p.name.toLowerCase().includes('yestoryd') ||
    p.name.includes('@') // Email-based names are usually coaches
  );

  // If there are 2+ participants and duration > 5 min, likely valid
  const childJoined = participants.length >= 2 && !participants.every(p => p.is_host);

  // Valid session: at least 2 participants and > 10 minutes
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

// ============================================================
// SESSION OUTCOME DETERMINATION
// ============================================================

interface SessionOutcome {
  status: SessionStatus;
  reason?: string;
}

function determineSessionOutcome(
  attendance: AttendanceInfo,
  transcript: string,
  durationSeconds?: number
): SessionOutcome {
  const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : 0;

  // No participants at all
  if (attendance.totalParticipants === 0) {
    return { status: 'no_show', reason: 'No one joined the meeting' };
  }

  // Only 1 participant (likely just the bot or one person)
  if (attendance.totalParticipants === 1) {
    // Check if it was coach waiting alone
    if (attendance.coachJoined && !attendance.childJoined) {
      return { status: 'no_show', reason: 'Child/parent did not join' };
    }
    // Could be child waiting alone
    if (!attendance.coachJoined) {
      return { status: 'coach_no_show', reason: 'Coach did not join' };
    }
    return { status: 'no_show', reason: 'Only one participant joined' };
  }

  // Very short session (< 5 minutes)
  if (durationMinutes < 5) {
    return { status: 'partial', reason: `Session too short (${durationMinutes} min)` };
  }

  // Short session (5-10 minutes) - might be partial
  if (durationMinutes < 10) {
    return { status: 'partial', reason: `Session was brief (${durationMinutes} min)` };
  }

  // Transcript too short despite duration (technical issue?)
  if (transcript.length < 100 && durationMinutes > 10) {
    return { status: 'partial', reason: 'Recording/transcription issue' };
  }

  // Everything looks good
  return { status: 'completed' };
}

// ============================================================
// UPDATE SESSION STATUS HELPER
// ============================================================

async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  additionalData?: Record<string, unknown>
) {
  const updateData: Record<string, unknown> = {
    status,
    recall_status: status,
    updated_at: new Date().toISOString(),
    ...additionalData,
  };

  // Set completed_at for terminal states
  if (['completed', 'no_show', 'coach_no_show', 'partial', 'cancelled', 'bot_error'].includes(status)) {
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from('scheduled_sessions')
    .update(updateData)
    .eq('id', sessionId);

  console.log(`📝 Session ${sessionId} status updated to: ${status}`);
}

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

async function sendNoShowNotification(
  sessionId: string | null,
  childId: string | null,
  coachId: string | null,
  reason: string
) {
  console.log(`📢 Sending no-show notification: ${reason}`);

  // Get session and child details
  if (!sessionId || !childId) return;

  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select(`
      scheduled_date,
      scheduled_time,
      child:children(child_name, parent_phone, parent_name),
      coach:coaches(name, email)
    `)
    .eq('id', sessionId)
    .single();

  if (!session) return;

  // Handle Supabase returning arrays for joins
  const child = Array.isArray(session.child) ? session.child[0] : session.child;
  const coach = Array.isArray(session.coach) ? session.coach[0] : session.coach;

  // Log the no-show
  await supabase.from('communication_log').insert({
    recipient_type: 'admin',
    recipient_id: null,
    channel: 'internal',
    template_name: 'session_no_show',
    message_content: JSON.stringify({
      session_id: sessionId,
      child_name: child?.child_name,
      coach_name: coach?.name,
      scheduled_date: session.scheduled_date,
      scheduled_time: session.scheduled_time,
      reason,
    }),
    status: 'logged',
  });

  // TODO: Send actual WhatsApp/email notifications via AiSensy
  // For now, just log for admin visibility
}

async function sendCoachNoShowNotification(
  sessionId: string | null,
  childId: string | null,
  coachId: string | null
) {
  console.log(`⚠️ COACH NO-SHOW detected for session ${sessionId}`);

  // This is a serious issue - coach didn't show up
  // Send urgent notification to admin

  if (sessionId) {
    // Flag for immediate attention
    await supabase
      .from('scheduled_sessions')
      .update({
        flagged_for_attention: true,
        flag_reason: 'URGENT: Coach did not join scheduled session',
      })
      .eq('id', sessionId);
  }

  // Log for admin
  await supabase.from('communication_log').insert({
    recipient_type: 'admin',
    recipient_id: null,
    channel: 'internal',
    template_name: 'coach_no_show_urgent',
    message_content: JSON.stringify({
      session_id: sessionId,
      child_id: childId,
      coach_id: coachId,
      detected_at: new Date().toISOString(),
    }),
    status: 'urgent',
  });

  // TODO: Send urgent WhatsApp to admin
}

async function notifyAdminOfBotError(sessionId: string, errorMessage: string) {
  console.log(`🔴 Bot error notification: ${errorMessage}`);

  await supabase.from('communication_logs').insert({
    recipient_type: 'admin',
    recipient_id: null,
    channel: 'internal',
    template_name: 'bot_error',
    message_content: JSON.stringify({
      session_id: sessionId,
      error: errorMessage,
      detected_at: new Date().toISOString(),
    }),
    status: 'logged',
  });
}

async function sendParentSessionSummary(
  sessionId: string | null,
  childId: string,
  childName: string,
  summary: string
) {
  console.log(`📨 Sending parent session summary for ${childName}`);

  // Get parent contact info
  const { data: child } = await supabase
    .from('children')
    .select('parent_phone, parent_name, parent_email')
    .eq('id', childId)
    .single();

  if (!child?.parent_phone) {
    console.log('No parent phone found, skipping WhatsApp');
    return;
  }

  // Log the summary message
  await supabase.from('communication_log').insert({
    recipient_type: 'parent',
    recipient_id: childId,
    channel: 'whatsapp',
    template_name: 'session_summary_parent',
    message_content: summary,
    metadata: {
      session_id: sessionId,
      child_name: childName,
    },
    status: 'pending',
  });

  // TODO: Actually send via AiSensy
  // await sendAiSensyMessage(child.parent_phone, 'session_summary', { childName, summary });
}

// ============================================================
// TRANSCRIPT BUILDING (with speaker diarization)
// ============================================================

function buildTranscriptWithSpeakers(
  words: Array<{ text: string; speaker_id?: number; start_time: number }>,
  participants: Array<{ id: number; name: string }>
): string {
  if (!words.length) return '';

  const speakerCounts: Record<number, number> = {};
  const speakerFirstWords: Record<number, string[]> = {};

  for (const word of words) {
    const speakerId = word.speaker_id || 0;
    speakerCounts[speakerId] = (speakerCounts[speakerId] || 0) + 1;
    if (!speakerFirstWords[speakerId]) {
      speakerFirstWords[speakerId] = [];
    }
    if (speakerFirstWords[speakerId].length < 20) {
      speakerFirstWords[speakerId].push(word.text);
    }
  }

  const speakerIds = Object.keys(speakerCounts).map(Number);
  let coachSpeakerId: number;
  let childSpeakerId: number;

  if (speakerIds.length >= 2) {
    const sorted = speakerIds.sort((a, b) => speakerCounts[b] - speakerCounts[a]);
    coachSpeakerId = sorted[0];
    childSpeakerId = sorted[1];

    const coachWords = (speakerFirstWords[coachSpeakerId] || []).join(' ').toLowerCase();
    const childWords = (speakerFirstWords[childSpeakerId] || []).join(' ').toLowerCase();

    const instructionalPatterns = /\b(hello|hi|let's|today|read|start|open|good|great|try)\b/;
    if (instructionalPatterns.test(childWords) && !instructionalPatterns.test(coachWords)) {
      [coachSpeakerId, childSpeakerId] = [childSpeakerId, coachSpeakerId];
    }
  } else {
    coachSpeakerId = speakerIds[0] || 0;
    childSpeakerId = -1;
  }

  const lines: string[] = [];
  let currentSpeaker = -1;
  let currentLine = '';

  for (const word of words) {
    const speakerId = word.speaker_id || 0;

    if (speakerId !== currentSpeaker) {
      if (currentLine.trim()) {
        const prevSpeakerLabel = currentSpeaker === coachSpeakerId ? 'COACH' : currentSpeaker === childSpeakerId ? 'CHILD' : `SPEAKER_${currentSpeaker}`;
        lines.push(`${prevSpeakerLabel}: "${currentLine.trim()}"`);
      }
      currentSpeaker = speakerId;
      currentLine = '';
    }
    currentLine += word.text + ' ';
  }

  if (currentLine.trim()) {
    const lastSpeakerLabel = currentSpeaker === coachSpeakerId ? 'COACH' : currentSpeaker === childSpeakerId ? 'CHILD' : `SPEAKER_${currentSpeaker}`;
    lines.push(`${lastSpeakerLabel}: "${currentLine.trim()}"`);
  }

  return lines.join('\n');
}

// ============================================================
// SESSION LOOKUP
// ============================================================

async function findSessionByMeeting(title: string, startTime: string, participantNames: string[]) {
  const nameMatch = title.match(/Yestoryd\s*[-–]\s*(\w+\s*\w*)/i);
  const childNameFromTitle = nameMatch ? nameMatch[1].trim() : null;

  const meetingDate = new Date(startTime);
  const dateStr = meetingDate.toISOString().split('T')[0];

  const query = supabase
    .from('scheduled_sessions')
    .select(`
      id, session_type, child_id, coach_id,
      child:children(id, name, child_name),
      coach:coaches(id, name, email)
    `)
    .eq('scheduled_date', dateStr)
    .in('status', ['scheduled', 'in_progress', 'bot_joining']);

  const { data: sessions } = await query;

  if (!sessions || sessions.length === 0) return null;

  if (childNameFromTitle) {
    const matched = sessions.find((s) => {
      const child = Array.isArray(s.child) ? s.child[0] : s.child;
      return child?.child_name?.toLowerCase().includes(childNameFromTitle.toLowerCase()) ||
        child?.name?.toLowerCase().includes(childNameFromTitle.toLowerCase());
    });
    if (matched) return matched;
  }

  for (const session of sessions) {
    const child = Array.isArray(session.child) ? session.child[0] : session.child;
    const childName = child?.child_name || child?.name;
    if (childName && participantNames.some(p =>
      p.toLowerCase().includes(childName.toLowerCase()) ||
      childName.toLowerCase().includes(p.toLowerCase())
    )) {
      return session;
    }
  }

  return sessions[0];
}

// ============================================================
// CHILD CONTEXT
// ============================================================

async function getChildContext(childId: string): Promise<{
  name: string;
  age: number;
  score: number | null;
  sessionsCompleted: number;
  recentSessions: string;
} | null> {
  const { data: child } = await supabase
    .from('children')
    .select('name, child_name, age, latest_assessment_score, sessions_completed')
    .eq('id', childId)
    .single();

  if (!child) return null;

  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('focus_area, progress_rating, tldv_ai_summary, scheduled_date')
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
    name: child.child_name || child.name,
    age: child.age || 6,
    score: child.latest_assessment_score,
    sessionsCompleted: child.sessions_completed || 0,
    recentSessions,
  };
}

// ============================================================
// TRANSCRIPT ANALYSIS
// ============================================================

async function analyzeTranscript(
  transcript: string,
  childContext: { name: string; age: number; score: number | null; sessionsCompleted: number; recentSessions: string } | null,
  childName: string
): Promise<SessionAnalysis> {

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
${transcript}

Generate a JSON response with this structure:
{
  "session_type": "coaching",
  "child_name": "${childName}",
  "focus_area": "phonics|fluency|comprehension|vocabulary",
  "skills_worked_on": ["PHO_01", "PHO_02"],
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
  "concerns_array": ["specific concern 1", "specific concern 2"],
  "safety_flag": false,
  "safety_reason": null,
  "sentiment_score": 0.7,
  "summary": "2-3 sentence technical summary for coach records",
  "parent_summary": "2-3 sentence warm, encouraging summary for parents"
}

SAFETY ASSESSMENT:
- Set "safety_flag": true if the child shows signs of distress, anxiety, fear, or mentions anything concerning about home/school.
- Set "safety_reason" to explain the concern if flagged.
- Set "sentiment_score" from 0.0 (very distressed/upset) to 1.0 (happy/engaged). Most sessions should be 0.5-0.8.
- Be vigilant but don't over-flag - only flag genuine concerns.

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
      return analysis;
    }

    return getDefaultAnalysis(childName);

  } catch (error) {
    console.error('Gemini analysis error:', error);
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
    homework_topic: null,
    homework_description: null,
    next_session_focus: null,
    coach_talk_ratio: 50,
    child_reading_samples: [],
    key_observations: ['Automatic analysis failed - please review manually'],
    flagged_for_attention: true,
    flag_reason: 'Automatic analysis failed',
    parent_sentiment: null,
    parent_sees_progress: null,
    home_practice_frequency: null,
    concerns_raised: null,
    action_items: null,
    concerns_array: [],
    safety_flag: false,
    safety_reason: null,
    sentiment_score: 0.5,
    summary: 'Session completed. Manual review recommended.',
    parent_summary: `${childName} completed today's reading session. The coach worked on building reading skills. Continue practicing reading at home for 10-15 minutes daily.`,
  };
}

// ============================================================
// SAVE SESSION DATA
// ============================================================

async function saveSessionData(data: {
  sessionId?: string | null;
  childId?: string | null;
  coachId?: string | null;
  childName: string;
  transcriptText: string;
  analysis: SessionAnalysis;
  recordingUrl?: string;
  durationSeconds?: number;
  attendance?: AttendanceInfo;
}) {
  const { sessionId, childId, coachId, childName, transcriptText, analysis, recordingUrl, durationSeconds, attendance } = data;

  // Cache parent summary
  if (childId && analysis.parent_summary) {
    await supabase
      .from('children')
      .update({
        last_session_summary: analysis.parent_summary,
        last_session_date: new Date().toISOString(),
        last_session_focus: analysis.focus_area,
      })
      .eq('id', childId);

    console.log('📦 Parent summary cached for child:', childId);
  }

  // Update scheduled_session
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
        tldv_ai_summary: analysis.summary,
        tldv_recording_url: recordingUrl,
        tldv_transcript: transcriptText.substring(0, 10000),
        flagged_for_attention: analysis.flagged_for_attention,
        flag_reason: analysis.flag_reason,
        ai_summary: analysis.parent_summary,
        // Session Intelligence fields
        duration_minutes: durationSeconds ? Math.round(durationSeconds / 60) : null,
        attendance_count: attendance?.totalParticipants,
      })
      .eq('id', sessionId);
  }

  // Create learning event
  if (childId && coachId) {
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

    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(searchableContent);
      console.log('🔢 Embedding generated for learning event');
    } catch (error) {
      console.error('Failed to generate embedding:', error);
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
        attendance: attendance,
      },
      ai_summary: analysis.summary,
      content_for_embedding: searchableContent,
      embedding: embedding,
    });
  }

  // Increment sessions completed
  if (childId) {
    await supabase.rpc('increment_sessions_completed', { child_id_param: childId });
  }

  console.log('📚 Session data saved to database');
}

// ============================================================
// GET ENDPOINT (Health Check)
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Recall.ai Webhook v2.2 - Session Intelligence',
    features: [
      'speaker_diarization',
      'parent_summary_cache',
      'embeddings',
      'audio_storage',
      'no_show_detection',
      'attendance_tracking',
      'completion_status',
    ],
    timestamp: new Date().toISOString(),
  });
}