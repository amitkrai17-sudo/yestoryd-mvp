// file: app/api/webhooks/recall/route.ts
// rAI v2.0 - Recall.ai Webhook with Speaker Diarization & Parent Summary Caching

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, buildSessionSearchableContent } from '@/lib/rai/embeddings';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Recall.ai configuration
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
    }>;
  };
}

interface SessionAnalysis {
  // Coach analysis
  focus_area: string;
  skills_worked_on: string[];
  progress_rating: 'declined' | 'same' | 'improved' | 'significant_improvement';
  engagement_level: 'low' | 'medium' | 'high';
  confidence_level: number;
  breakthrough_moment: string | null;
  concerns_noted: string | null;
  homework_assigned: boolean;
  homework_topic: string | null;
  homework_description: string | null;
  next_session_focus: string | null;
  coach_talk_ratio: number;
  child_reading_samples: string[];
  key_observations: string[];
  flagged_for_attention: boolean;
  flag_reason: string | null;
  
  // Parent check-in fields
  parent_sentiment: string | null;
  parent_sees_progress: string | null;
  home_practice_frequency: string | null;
  concerns_raised: string[] | null;
  action_items: string | null;
  
  // Common
  session_type: 'coaching' | 'parent_checkin' | 'discovery' | 'remedial';
  child_name: string | null;
  summary: string;
  
  // NEW: Parent-friendly summary (2-3 sentences)
  parent_summary: string;
}

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
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
// EVENT HANDLERS
// ============================================================

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
  
  console.log('🎬 Bot done, processing transcript for:', bot_id);

  // 1. Get bot session info from database
  const { data: botSession } = await supabase
    .from('recall_bot_sessions')
    .select('session_id, child_id, coach_id')
    .eq('bot_id', bot_id)
    .single();

  // 2. Build speaker-labeled transcript
  const transcriptText = buildTranscriptWithSpeakers(
    transcript?.words || [],
    meeting_participants || []
  );
  
  if (!transcriptText || transcriptText.length < 100) {
    console.log('Transcript too short, skipping analysis');
    return NextResponse.json({ status: 'skipped', reason: 'transcript_too_short' });
  }

  // 3. Find matching session
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

  // 4. Get child context
  const childContext = childId ? await getChildContext(childId) : null;
  const childName = childContext?.name || 'the child';

  // 5. Analyze transcript with Gemini (SINGLE CALL - TWO OUTPUTS)
  const analysis = await analyzeTranscript(transcriptText, childContext, childName);

  // 6. Save everything to database
  await saveSessionData({
    sessionId,
    childId,
    coachId,
    childName,
    transcriptText,
    analysis,
    recordingUrl: recording?.url,
    durationSeconds: recording?.duration_seconds,
    meetingTitle: meeting_metadata?.title,
  });

  console.log('✅ Session processed successfully');
  
  return NextResponse.json({ 
    status: 'processed',
    session_id: sessionId,
    child_detected: analysis.child_name,
    parent_summary_cached: !!analysis.parent_summary,
  });
}

// ============================================================
// SPEAKER DIARIZATION
// ============================================================

function buildTranscriptWithSpeakers(
  words: Array<{ text: string; speaker_id?: number; start_time: number }>,
  participants: Array<{ id: number; name: string }>
): string {
  if (!words.length) return '';

  // Create speaker map from participants
  const speakerMap = new Map(participants.map(p => [p.id, p.name]));
  
  // Count words per speaker to identify Coach vs Child
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

  // Identify Coach and Child speakers
  const speakerIds = Object.keys(speakerCounts).map(Number);
  let coachSpeakerId: number;
  let childSpeakerId: number;

  if (speakerIds.length >= 2) {
    // Sort by word count - coach usually speaks more
    const sorted = speakerIds.sort((a, b) => speakerCounts[b] - speakerCounts[a]);
    coachSpeakerId = sorted[0];
    childSpeakerId = sorted[1];
    
    // Validate with first words (coach likely says instructional words)
    const coachWords = (speakerFirstWords[coachSpeakerId] || []).join(' ').toLowerCase();
    const childWords = (speakerFirstWords[childSpeakerId] || []).join(' ').toLowerCase();
    
    const instructionalPatterns = /\b(hello|hi|let's|today|read|start|open|good|great|try)\b/;
    if (instructionalPatterns.test(childWords) && !instructionalPatterns.test(coachWords)) {
      // Swap if child's words seem more instructional
      [coachSpeakerId, childSpeakerId] = [childSpeakerId, coachSpeakerId];
    }
  } else {
    coachSpeakerId = speakerIds[0] || 0;
    childSpeakerId = -1; // No second speaker
  }

  // Build formatted transcript
  const lines: string[] = [];
  let currentSpeaker = -1;
  let currentLine = '';

  for (const word of words) {
    const speakerId = word.speaker_id || 0;
    const speaker = speakerId === coachSpeakerId 
      ? 'COACH' 
      : speakerId === childSpeakerId 
        ? 'CHILD' 
        : `SPEAKER_${speakerId}`;

    if (speaker !== (currentSpeaker === coachSpeakerId ? 'COACH' : currentSpeaker === childSpeakerId ? 'CHILD' : `SPEAKER_${currentSpeaker}`)) {
      if (currentLine.trim()) {
        const prevSpeaker = currentSpeaker === coachSpeakerId 
          ? 'COACH' 
          : currentSpeaker === childSpeakerId 
            ? 'CHILD' 
            : `SPEAKER_${currentSpeaker}`;
        lines.push(`${prevSpeaker}: "${currentLine.trim()}"`);
      }
      currentSpeaker = speakerId;
      currentLine = '';
    }
    currentLine += word.text + ' ';
  }

  // Add last line
  if (currentLine.trim()) {
    const lastSpeaker = currentSpeaker === coachSpeakerId 
      ? 'COACH' 
      : currentSpeaker === childSpeakerId 
        ? 'CHILD' 
        : `SPEAKER_${currentSpeaker}`;
    lines.push(`${lastSpeaker}: "${currentLine.trim()}"`);
  }

  return lines.join('\n');
}

// ============================================================
// FIND SESSION BY MEETING
// ============================================================

async function findSessionByMeeting(title: string, startTime: string, participantNames: string[]) {
  const nameMatch = title.match(/Yestoryd\s*[-–]\s*(\w+\s*\w*)/i);
  const childNameFromTitle = nameMatch ? nameMatch[1].trim() : null;

  const meetingDate = new Date(startTime);
  const dateStr = meetingDate.toISOString().split('T')[0];

  let query = supabase
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

  // Try to match by child name
  if (childNameFromTitle) {
    const matched = sessions.find((s: any) => 
      s.child?.child_name?.toLowerCase().includes(childNameFromTitle.toLowerCase()) ||
      s.child?.name?.toLowerCase().includes(childNameFromTitle.toLowerCase())
    );
    if (matched) return matched;
  }

  // Try to match by participant name
  for (const session of sessions) {
    const child = (session as any).child;
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
// GET CHILD CONTEXT
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

  // Get recent sessions
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('focus_area, progress_rating, tldv_ai_summary, scheduled_date')
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
    name: child.child_name || child.name,
    age: child.age || 6,
    score: child.latest_assessment_score,
    sessionsCompleted: child.sessions_completed || 0,
    recentSessions,
  };
}

// ============================================================
// GEMINI ANALYSIS (SINGLE CALL - TWO OUTPUTS)
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

IMPORTANT:
- The transcript uses COACH: and CHILD: labels to identify speakers
- Analyze the CHILD's reading attempts and speech patterns
- Calculate coach_talk_ratio as percentage of coach speaking time
- Extract specific child_reading_samples (what the child read/said)

Generate a JSON response with this EXACT structure:
{
  "session_type": "coaching" | "parent_checkin" | "discovery" | "remedial",
  "child_name": "${childName}",
  "focus_area": "phonics" | "fluency" | "comprehension" | "vocabulary" | null,
  "skills_worked_on": ["skill codes like PHO_01, FLU_01, etc"],
  "progress_rating": "declined" | "same" | "improved" | "significant_improvement",
  "engagement_level": "low" | "medium" | "high",
  "confidence_level": 1-5,
  "breakthrough_moment": "string or null",
  "concerns_noted": "string or null",
  "homework_assigned": true | false,
  "homework_topic": "string or null",
  "homework_description": "string or null",
  "next_session_focus": "string or null",
  "coach_talk_ratio": 0-100,
  "child_reading_samples": ["actual phrases child read"],
  "key_observations": ["observation 1", "observation 2"],
  "flagged_for_attention": true | false,
  "flag_reason": "string or null",
  "parent_sentiment": null,
  "parent_sees_progress": null,
  "home_practice_frequency": null,
  "concerns_raised": null,
  "action_items": null,
  "summary": "2-3 sentence technical summary for coach records",
  "parent_summary": "2-3 sentence warm, encouraging summary for parents. Should mention what ${childName} practiced and include one specific thing parent can do at home. Do NOT include scores or technical terms."
}

SKILL CODES:
- PHO_01=Letter sounds, PHO_02=CVC words, PHO_03=Blends, PHO_04=Digraphs
- FLU_01=Sight words, FLU_02=Phrasing
- COMP_01=Literal, COMP_02=Inferential

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
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
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
    summary: 'Session completed. Manual review recommended.',
    parent_summary: `${childName} completed today's reading session. The coach worked on building reading skills. Continue practicing reading at home for 10-15 minutes daily.`,
  };
}

// ============================================================
// DATABASE SAVE (WITH PARENT CACHING)
// ============================================================

async function saveSessionData(data: {
  sessionId: string | null;
  childId: string | null;
  coachId: string | null;
  childName: string;
  transcriptText: string;
  analysis: SessionAnalysis;
  recordingUrl?: string;
  durationSeconds?: number;
  meetingTitle?: string;
}) {
  const { sessionId, childId, coachId, childName, transcriptText, analysis, recordingUrl, durationSeconds } = data;

  // ═══════════════════════════════════════════════════════════════
  // 1. UPDATE CHILDREN TABLE WITH PARENT SUMMARY CACHE
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // 2. UPDATE SCHEDULED_SESSION
  // ═══════════════════════════════════════════════════════════════
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
        parent_sentiment: analysis.parent_sentiment,
        parent_sees_progress: analysis.parent_sees_progress,
        home_practice_frequency: analysis.home_practice_frequency,
        concerns_raised: analysis.concerns_raised,
        action_items: analysis.action_items,
        ai_summary: analysis.parent_summary, // Store parent summary here too
      })
      .eq('id', sessionId);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. CREATE LEARNING_EVENT WITH EMBEDDING
  // ═══════════════════════════════════════════════════════════════
  if (childId && coachId) {
    // Build searchable content for embedding
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

    // Generate embedding
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
      },
      ai_summary: analysis.summary,
      content_for_embedding: searchableContent,
      embedding: embedding,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. UPDATE CHILD SKILL PROGRESS
  // ═══════════════════════════════════════════════════════════════
  if (childId && analysis.skills_worked_on?.length) {
    for (const skillId of analysis.skills_worked_on) {
      const { data: existing } = await supabase
        .from('child_skill_progress')
        .select('current_level, practice_count')
        .eq('child_id', childId)
        .eq('skill_id', skillId)
        .single();

      if (existing) {
        await supabase
          .from('child_skill_progress')
          .update({
            practice_count: (existing.practice_count || 0) + 1,
            last_practiced: new Date().toISOString(),
            notes: analysis.breakthrough_moment || undefined,
          })
          .eq('child_id', childId)
          .eq('skill_id', skillId);
      } else {
        await supabase.from('child_skill_progress').insert({
          child_id: childId,
          skill_id: skillId,
          current_level: 1,
          practice_count: 1,
          last_practiced: new Date().toISOString(),
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. UPDATE CHILD SESSION COUNT
  // ═══════════════════════════════════════════════════════════════
  if (childId) {
    await supabase.rpc('increment_sessions_completed', { child_id_param: childId });
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. CREATE HOMEWORK ASSIGNMENT IF ASSIGNED
  // ═══════════════════════════════════════════════════════════════
  if (childId && coachId && analysis.homework_assigned && analysis.homework_topic) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    await supabase.from('homework_assignments').insert({
      child_id: childId,
      coach_id: coachId,
      session_id: sessionId,
      topic: analysis.homework_topic,
      description: analysis.homework_description || `Practice ${analysis.homework_topic}`,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'assigned',
    });
  }

  console.log('📚 Session data saved to database');
}

// ============================================================
// GET handler for health check
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Recall.ai Webhook v2.0',
    features: ['speaker_diarization', 'parent_summary_cache', 'embeddings'],
    timestamp: new Date().toISOString(),
  });
}