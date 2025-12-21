// file: app/api/webhooks/recall/route.ts
// rAI v2.0 - Recall.ai Webhook with Speaker Diarization & Parent Summary Caching

import { checkAndSendProactiveNotifications } from '@/lib/rai/proactive-notifications';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, buildSessionSearchableContent } from '@/lib/rai/embeddings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const RECALL_WEBHOOK_SECRET = process.env.RECALL_WEBHOOK_SECRET;

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
  // Enhanced triggers v2.1
  concerns_array?: string[] | null;
  safety_flag?: boolean;
  safety_reason?: string | null;
  sentiment_score?: number;
}

export async function POST(request: NextRequest) {
  try {
    if (RECALL_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-recall-signature');
      if (!signature) {
        console.warn('Recall webhook: Missing signature header');
      }
    }

    const payload: RecallWebhookPayload = await request.json();
    console.log('ðŸ“¹ Recall webhook received:', payload.event, payload.data.bot_id);

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

async function handleStatusChange(payload: RecallWebhookPayload) {
  const { bot_id, status, status_changes } = payload.data;
  
  console.log(`Bot ${bot_id} status: ${status}`);
  
  await supabase
    .from('recall_bot_sessions')
    .upsert({
      bot_id,
      status,
      last_status_change: new Date().toISOString(),
      status_history: status_changes,
    }, { onConflict: 'bot_id' });

  return NextResponse.json({ status: 'ok' });
}

async function handleTranscription(payload: RecallWebhookPayload) {
  console.log('Real-time transcription received for bot:', payload.data.bot_id);
  return NextResponse.json({ status: 'ok' });
}

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

async function handleBotDone(payload: RecallWebhookPayload) {
  const { bot_id, transcript, meeting_metadata, meeting_participants, recording } = payload.data;
  
  console.log('ðŸŽ¬ Bot done, processing transcript for:', bot_id);

  const { data: botSession } = await supabase
    .from('recall_bot_sessions')
    .select('session_id, child_id, coach_id')
    .eq('bot_id', bot_id)
    .single();

  const transcriptText = buildTranscriptWithSpeakers(
    transcript?.words || [],
    meeting_participants || []
  );
  
  if (!transcriptText || transcriptText.length < 100) {
    console.log('Transcript too short, skipping analysis');
    return NextResponse.json({ status: 'skipped', reason: 'transcript_too_short' });
  }

  let sessionId = botSession?.session_id;
  let childId = botSession?.child_id;
  let coachId = botSession?.coach_id;

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

  const childContext = childId ? await getChildContext(childId) : null;
  const childName = childContext?.name || 'the child';

  const analysis = await analyzeTranscript(transcriptText, childContext, childName);

  await saveSessionData({
    sessionId,
    childId,
    coachId,
    childName,
    transcriptText,
    analysis,
    recordingUrl: recording?.url,
    durationSeconds: recording?.duration_seconds,
  });

// Proactive Triggers
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
        console.log('ðŸš¨ Proactive notifications sent:', triggerResult.notifications);
      }
    } catch (triggerError) {
      console.error('Proactive trigger error (non-fatal):', triggerError);
    }
  }
  console.log('âœ… Session processed successfully');
  
  return NextResponse.json({ 
    status: 'processed',
    session_id: sessionId,
    child_detected: analysis.child_name,
    parent_summary_cached: !!analysis.parent_summary,
  });
}

function buildTranscriptWithSpeakers(
  words: Array<{ text: string; speaker_id?: number; start_time: number }>,
  participants: Array<{ id: number; name: string }>
): string {
  if (!words.length) return '';

  const speakerMap = new Map(participants.map(p => [p.id, p.name]));
  
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

async function findSessionByMeeting(title: string, startTime: string, participantNames: string[]) {
  const nameMatch = title.match(/Yestoryd\s*[-â€“]\s*(\w+\s*\w*)/i);
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
    .in('status', ['scheduled', 'in_progress', 'completed']);

  const { data: sessions } = await query;

  if (!sessions || sessions.length === 0) return null;

  if (childNameFromTitle) {
    const matched = sessions.find((s) => {
      const child = s.child as { child_name?: string; name?: string } | null;
      return child?.child_name?.toLowerCase().includes(childNameFromTitle.toLowerCase()) ||
             child?.name?.toLowerCase().includes(childNameFromTitle.toLowerCase());
    });
    if (matched) return matched;
  }

  for (const session of sessions) {
    const child = session.child as { child_name?: string; name?: string } | null;
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

async function saveSessionData(data: {
  sessionId?: string | null;
  childId?: string | null;
  coachId?: string | null;
  childName: string;
  transcriptText: string;
  analysis: SessionAnalysis;
  recordingUrl?: string;
  durationSeconds?: number;
}) {
  const { sessionId, childId, coachId, childName, transcriptText, analysis, recordingUrl, durationSeconds } = data;

  if (childId && analysis.parent_summary) {
    await supabase
      .from('children')
      .update({
        last_session_summary: analysis.parent_summary,
        last_session_date: new Date().toISOString(),
        last_session_focus: analysis.focus_area,
      })
      .eq('id', childId);
    
    console.log('ðŸ“¦ Parent summary cached for child:', childId);
  }

  if (sessionId) {
    await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
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
      })
      .eq('id', sessionId);
  }

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
      console.log('ðŸ”¢ Embedding generated for learning event');
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
      },
      ai_summary: analysis.summary,
      content_for_embedding: searchableContent,
      embedding: embedding,
    });
  }

  if (childId) {
    await supabase.rpc('increment_sessions_completed', { child_id_param: childId });
  }

  console.log('ðŸ“š Session data saved to database');
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Recall.ai Webhook v2.0',
    features: ['speaker_diarization', 'parent_summary_cache', 'embeddings'],
    timestamp: new Date().toISOString(),
  });
}



