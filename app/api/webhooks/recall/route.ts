// file: app/api/webhooks/recall/route.ts
// Recall.ai Webhook Handler - Receives meeting recordings/transcripts
// Processes with Gemini for reading coaching analysis
// Auto-saves to database

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-preview-05-20';

// Recall.ai configuration
const RECALL_API_KEY = process.env.RECALL_API_KEY;
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
  session_type: 'coaching' | 'parent_checkin' | 'discovery' | 'remedial';
  child_name: string | null;
  
  // Coaching session fields
  focus_area?: string;
  skills_worked_on?: string[];
  progress_rating?: 'declined' | 'same' | 'improved' | 'significant_improvement';
  engagement_level?: 'low' | 'medium' | 'high';
  confidence_level?: number; // 1-5
  breakthrough_moment?: string;
  concerns_noted?: string;
  homework_assigned?: boolean;
  homework_topic?: string;
  homework_description?: string;
  
  // Parent check-in fields
  parent_sentiment?: 'frustrated' | 'concerned' | 'neutral' | 'happy' | 'very_happy';
  parent_sees_progress?: 'no' | 'somewhat' | 'yes';
  home_practice_frequency?: string;
  concerns_raised?: string[];
  action_items?: string;
  
  // Common
  summary: string;
  key_observations: string[];
  next_session_focus?: string;
  flagged_for_attention?: boolean;
  flag_reason?: string;
}

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    if (RECALL_WEBHOOK_SECRET) {
      const signature = request.headers.get('x-recall-signature');
      // In production, verify HMAC signature
      // For now, just check if header exists
      if (!signature) {
        console.warn('Recall webhook: Missing signature header');
      }
    }

    const payload: RecallWebhookPayload = await request.json();
    console.log('📹 Recall webhook received:', payload.event, payload.data.bot_id);

    // Handle different event types
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
  
  // Log status for debugging
  console.log(`Bot ${bot_id} status: ${status}`);
  
  // Update bot tracking in database if needed
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
  // Real-time transcription - could be used for live features
  // For now, we wait for bot.done to get full transcript
  console.log('Real-time transcription received for bot:', payload.data.bot_id);
  return NextResponse.json({ status: 'ok' });
}

async function handleRecordingReady(payload: RecallWebhookPayload) {
  const { bot_id, recording } = payload.data;
  
  if (recording?.url) {
    // Store recording URL
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

  // 2. Build full transcript text
  const transcriptText = buildTranscriptText(transcript?.words || [], meeting_participants || []);
  
  if (!transcriptText || transcriptText.length < 100) {
    console.log('Transcript too short, skipping analysis');
    return NextResponse.json({ status: 'skipped', reason: 'transcript_too_short' });
  }

  // 3. Find matching session
  let sessionId = botSession?.session_id;
  let childId = botSession?.child_id;
  let coachId = botSession?.coach_id;

  if (!sessionId) {
    // Try to find session by meeting time and title
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

  // 4. Analyze transcript with Gemini
  const analysis = await analyzeTranscript(
    transcriptText,
    childId ? await getChildContext(childId) : null
  );

  // 5. Save to database
  await saveSessionData({
    sessionId,
    childId,
    coachId,
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
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function buildTranscriptText(
  words: Array<{ text: string; speaker_id?: number; start_time: number }>,
  participants: Array<{ id: number; name: string }>
): string {
  if (!words.length) return '';

  // Create speaker map
  const speakerMap = new Map(participants.map(p => [p.id, p.name]));
  
  // Group words by speaker
  let currentSpeaker = -1;
  let transcript = '';
  let currentLine = '';

  for (const word of words) {
    if (word.speaker_id !== currentSpeaker) {
      if (currentLine) {
        const speakerName = speakerMap.get(currentSpeaker) || `Speaker ${currentSpeaker}`;
        transcript += `\n${speakerName}: ${currentLine.trim()}`;
      }
      currentSpeaker = word.speaker_id || 0;
      currentLine = '';
    }
    currentLine += word.text + ' ';
  }

  // Add last line
  if (currentLine) {
    const speakerName = speakerMap.get(currentSpeaker) || `Speaker ${currentSpeaker}`;
    transcript += `\n${speakerName}: ${currentLine.trim()}`;
  }

  return transcript.trim();
}

async function findSessionByMeeting(title: string, startTime: string, participantNames: string[]) {
  // Extract child name from title (format: "Yestoryd - ChildName - Coaching")
  const nameMatch = title.match(/Yestoryd\s*[-–]\s*(\w+\s*\w*)/i);
  const childNameFromTitle = nameMatch ? nameMatch[1].trim() : null;

  // Find session within time window
  const meetingDate = new Date(startTime);
  const dateStr = meetingDate.toISOString().split('T')[0];

  let query = supabase
    .from('scheduled_sessions')
    .select(`
      id, session_type, child_id, coach_id,
      child:children(id, name),
      coach:coaches(id, name, email)
    `)
    .eq('scheduled_date', dateStr)
    .in('status', ['scheduled', 'in_progress', 'completed']);

  const { data: sessions } = await query;

  if (!sessions || sessions.length === 0) return null;

  // Try to match by child name
  if (childNameFromTitle) {
    const matched = sessions.find((s: any) => 
      s.child?.name?.toLowerCase().includes(childNameFromTitle.toLowerCase())
    );
    if (matched) return matched;
  }

  // Try to match by participant name
  for (const session of sessions) {
    const child = (session as any).child;
    if (child?.name && participantNames.some(p => 
      p.toLowerCase().includes(child.name.toLowerCase()) ||
      child.name.toLowerCase().includes(p.toLowerCase())
    )) {
      return session;
    }
  }

  // Return first session of the day if no match
  return sessions[0];
}

async function getChildContext(childId: string): Promise<string> {
  // Get child info
  const { data: child } = await supabase
    .from('children')
    .select('name, age, latest_assessment_score, sessions_completed')
    .eq('id', childId)
    .single();

  if (!child) return '';

  // Get recent sessions
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('focus_area, progress_rating, tldv_ai_summary, scheduled_date')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(3);

  // Get skill progress
  const { data: skills } = await supabase
    .from('child_skill_progress')
    .select('skill_id, current_level, notes')
    .eq('child_id', childId);

  let context = `CHILD CONTEXT:
Name: ${child.name}
Age: ${child.age}
Current Score: ${child.latest_assessment_score}/10
Sessions Completed: ${child.sessions_completed}
`;

  if (sessions?.length) {
    context += '\nRecent Sessions:\n';
    sessions.forEach((s: any, i: number) => {
      context += `- Session ${i + 1}: Focus: ${s.focus_area}, Progress: ${s.progress_rating}\n`;
      if (s.tldv_ai_summary) {
        context += `  Summary: ${s.tldv_ai_summary.substring(0, 200)}...\n`;
      }
    });
  }

  if (skills?.length) {
    context += '\nSkill Levels:\n';
    skills.forEach((s: any) => {
      context += `- ${s.skill_id}: Level ${s.current_level}\n`;
    });
  }

  return context;
}

// ============================================================
// GEMINI ANALYSIS
// ============================================================

async function analyzeTranscript(
  transcript: string,
  childContext: string | null
): Promise<SessionAnalysis> {
  
  const systemPrompt = `You are an AI assistant for Yestoryd, a reading coaching platform for children aged 4-12 in India.

Your task is to analyze a coaching session transcript and extract structured information.

ANALYSIS GUIDELINES:
1. Identify the session type (coaching, parent_checkin, discovery, remedial)
2. Extract the child's name if mentioned
3. For coaching sessions, assess:
   - Focus area (phonics, fluency, comprehension, vocabulary)
   - Skills worked on (use codes: PHO_01=Letter sounds, PHO_02=CVC words, PHO_03=Blends, PHO_04=Digraphs, FLU_01=Sight words, FLU_02=Phrasing, COMP_01=Literal, COMP_02=Inferential)
   - Progress compared to expectations (declined/same/improved/significant_improvement)
   - Engagement level (low/medium/high)
   - Confidence level (1-5)
   - Any breakthrough moments
   - Any concerns to note
   - Homework assigned

4. For parent check-ins, assess:
   - Parent sentiment
   - Whether they see progress
   - Home practice frequency
   - Concerns raised
   - Action items discussed

5. Flag sessions that need attention (child struggling significantly, parent frustrated, safety concerns)

RESPONSE FORMAT:
Respond ONLY with valid JSON matching this structure:
{
  "session_type": "coaching" | "parent_checkin" | "discovery" | "remedial",
  "child_name": "string or null",
  "focus_area": "phonics" | "fluency" | "comprehension" | "vocabulary" | null,
  "skills_worked_on": ["PHO_01", "PHO_02", ...],
  "progress_rating": "declined" | "same" | "improved" | "significant_improvement",
  "engagement_level": "low" | "medium" | "high",
  "confidence_level": 1-5,
  "breakthrough_moment": "string or null",
  "concerns_noted": "string or null",
  "homework_assigned": true | false,
  "homework_topic": "string or null",
  "homework_description": "string or null",
  "parent_sentiment": "frustrated" | "concerned" | "neutral" | "happy" | "very_happy" | null,
  "parent_sees_progress": "no" | "somewhat" | "yes" | null,
  "home_practice_frequency": "string or null",
  "concerns_raised": ["string", ...] | null,
  "action_items": "string or null",
  "summary": "2-3 sentence summary of the session",
  "key_observations": ["observation 1", "observation 2", ...],
  "next_session_focus": "string or null",
  "flagged_for_attention": true | false,
  "flag_reason": "string or null"
}`;

  const userPrompt = `${childContext ? childContext + '\n\n' : ''}TRANSCRIPT:
${transcript}

Analyze this coaching session and provide structured JSON output.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return analysis;
    }

    // Fallback
    return getDefaultAnalysis();
    
  } catch (error) {
    console.error('Gemini analysis error:', error);
    return getDefaultAnalysis();
  }
}

function getDefaultAnalysis(): SessionAnalysis {
  return {
    session_type: 'coaching',
    child_name: null,
    focus_area: 'phonics',
    skills_worked_on: [],
    progress_rating: 'same',
    engagement_level: 'medium',
    confidence_level: 3,
    summary: 'Session completed. Manual review recommended.',
    key_observations: ['Automatic analysis failed - please review manually'],
    flagged_for_attention: true,
    flag_reason: 'Automatic analysis failed',
  };
}

// ============================================================
// DATABASE SAVE
// ============================================================

async function saveSessionData(data: {
  sessionId: string | null;
  childId: string | null;
  coachId: string | null;
  transcriptText: string;
  analysis: SessionAnalysis;
  recordingUrl?: string;
  durationSeconds?: number;
  meetingTitle?: string;
}) {
  const { sessionId, childId, coachId, transcriptText, analysis, recordingUrl, durationSeconds } = data;

  // 1. Update scheduled_session if we have one
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
        tldv_transcript: transcriptText.substring(0, 10000), // Limit size
        flagged_for_attention: analysis.flagged_for_attention,
        flag_reason: analysis.flag_reason,
        // Parent check-in fields
        parent_sentiment: analysis.parent_sentiment,
        parent_sees_progress: analysis.parent_sees_progress,
        home_practice_frequency: analysis.home_practice_frequency,
        concerns_raised: analysis.concerns_raised,
        action_items: analysis.action_items,
      })
      .eq('id', sessionId);
  }

  // 2. Create learning_event
  if (childId && coachId) {
    await supabase.from('learning_events').insert({
      child_id: childId,
      coach_id: coachId,
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
      },
      ai_summary: analysis.summary,
      voice_note_transcript: transcriptText.substring(0, 5000),
      content_for_embedding: `${analysis.session_type} session ${analysis.focus_area || ''} ${analysis.summary} ${analysis.key_observations?.join(' ') || ''}`,
    });
  }

  // 3. Update child skill progress
  if (childId && analysis.skills_worked_on?.length) {
    for (const skillId of analysis.skills_worked_on) {
      // Upsert skill progress
      const { data: existing } = await supabase
        .from('child_skill_progress')
        .select('current_level, practice_count')
        .eq('child_id', childId)
        .eq('skill_id', skillId)
        .single();

      if (existing) {
        // Update existing
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
        // Create new
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

  // 4. Update child session count
  if (childId) {
    await supabase.rpc('increment_sessions_completed', { child_id_param: childId });
  }

  // 5. Create homework assignment if assigned
  if (childId && coachId && analysis.homework_assigned && analysis.homework_topic) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

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
    service: 'Recall.ai Webhook',
    version: '1.0',
    timestamp: new Date().toISOString(),
  });
}
