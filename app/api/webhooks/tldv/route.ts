// file: app/api/webhooks/tldv/route.ts
// tl;dv Webhook Handler - Receives meeting transcripts and processes them
// IMPORTANT: tl;dv is disabled by default. Set TLDV_ENABLED=true to enable.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Check if tl;dv integration is enabled
const TLDV_ENABLED = process.env.TLDV_ENABLED === 'true';
const TLDV_WEBHOOK_SECRET = process.env.TLDV_WEBHOOK_SECRET;

interface TldvWebhookPayload {
  event: string; // 'meeting.transcript_ready', 'meeting.recording_ready', etc.
  meeting_id: string;
  meeting_title: string;
  meeting_url?: string;
  recording_url?: string;
  transcript?: {
    text: string;
    segments?: Array<{
      speaker: string;
      text: string;
      start_time: number;
      end_time: number;
    }>;
  };
  participants?: string[];
  duration_minutes?: number;
  created_at: string;
}

// Extract session ID from meeting title or URL
// Meeting title format: "Yestoryd - {ChildName} - Session {N}" or similar
function extractSessionInfo(meetingTitle: string): { childName?: string; sessionType?: string } {
  const result: { childName?: string; sessionType?: string } = {};
  
  // Try to extract child name
  const nameMatch = meetingTitle.match(/Yestoryd\s*[-–]\s*(\w+)/i);
  if (nameMatch) {
    result.childName = nameMatch[1];
  }
  
  // Detect session type
  if (meetingTitle.toLowerCase().includes('parent') || meetingTitle.toLowerCase().includes('check-in')) {
    result.sessionType = 'parent_checkin';
  } else if (meetingTitle.toLowerCase().includes('remedial')) {
    result.sessionType = 'remedial';
  } else if (meetingTitle.toLowerCase().includes('discovery')) {
    result.sessionType = 'discovery';
  } else {
    result.sessionType = 'coaching';
  }
  
  return result;
}

// Find the session in database based on meeting time and participants
async function findSession(meetingTitle: string, meetingTime: string, participants: string[]) {
  // Try to find by meeting title match
  const sessionInfo = extractSessionInfo(meetingTitle);
  
  // Look for session around this time
  const meetingDate = new Date(meetingTime);
  const windowStart = new Date(meetingDate.getTime() - 60 * 60 * 1000); // 1 hour before
  const windowEnd = new Date(meetingDate.getTime() + 60 * 60 * 1000); // 1 hour after
  
  let query = supabase
    .from('scheduled_sessions')
    .select(`
      id, session_type, child_id, coach_id, scheduled_date,
      child:children(name),
      coach:coaches(email)
    `)
    .gte('scheduled_date', windowStart.toISOString().split('T')[0])
    .lte('scheduled_date', windowEnd.toISOString().split('T')[0])
    .in('status', ['scheduled', 'in_progress', 'completed']);

  // If we have a child name, filter by it
  if (sessionInfo.childName) {
    query = query.ilike('child.name', `%${sessionInfo.childName}%`);
  }

  const { data: sessions, error } = await query;
  
  if (error || !sessions || sessions.length === 0) {
    return null;
  }
  
  // If multiple matches, try to match by participant email
  if (sessions.length > 1 && participants.length > 0) {
    for (const session of sessions) {
      const coach = session.coach as any;
      if (coach?.email && participants.some(p => p.toLowerCase().includes(coach.email.toLowerCase()))) {
        return session;
      }
    }
  }
  
  // Return first match
  return sessions[0];
}

// Generate AI summary from transcript
async function generateTranscriptSummary(
  transcript: string,
  sessionType: string,
  childName: string
): Promise<{ summary: string; keyPoints: string[]; actionItems: string[] }> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = `
You are analyzing a transcript from a children's reading coaching session.

Session Type: ${sessionType}
Child: ${childName}

Transcript:
${transcript.substring(0, 8000)} ${transcript.length > 8000 ? '...[truncated]' : ''}

Provide a JSON response with:
1. "summary": A 2-3 sentence professional summary of what happened in the session
2. "keyPoints": Array of 3-5 key observations or progress notes
3. "actionItems": Array of any action items or follow-ups mentioned

Focus on:
- Reading progress and areas of focus
- Child's engagement and confidence
- Any concerns or breakthroughs
- Parent feedback (if parent check-in)
- Next steps discussed

Respond with ONLY valid JSON, no markdown or explanation.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Parse JSON response
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    return {
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      actionItems: parsed.actionItems || [],
    };
  } catch (error) {
    console.error('Transcript summary error:', error);
    return {
      summary: 'Session completed. Transcript available for review.',
      keyPoints: [],
      actionItems: [],
    };
  }
}

export async function POST(request: NextRequest) {
  // Check if tl;dv is enabled
  if (!TLDV_ENABLED) {
    return NextResponse.json({
      status: 'tl;dv integration is disabled',
      message: 'Set TLDV_ENABLED=true to enable',
    });
  }

  try {
    // Verify webhook secret if configured
    if (TLDV_WEBHOOK_SECRET) {
      const authHeader = request.headers.get('x-tldv-signature') || 
                         request.headers.get('authorization');
      if (authHeader !== TLDV_WEBHOOK_SECRET && authHeader !== `Bearer ${TLDV_WEBHOOK_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const payload: TldvWebhookPayload = await request.json();
    console.log('tl;dv webhook received:', payload.event, payload.meeting_id);

    // Only process transcript_ready events
    if (payload.event !== 'meeting.transcript_ready') {
      return NextResponse.json({
        status: 'ignored',
        reason: `Event type ${payload.event} not processed`,
      });
    }

    // Check if we have transcript
    if (!payload.transcript?.text) {
      return NextResponse.json({
        status: 'ignored',
        reason: 'No transcript in payload',
      });
    }

    // Find the corresponding session
    const session = await findSession(
      payload.meeting_title,
      payload.created_at,
      payload.participants || []
    );

    if (!session) {
      console.log('No matching session found for:', payload.meeting_title);
      return NextResponse.json({
        status: 'no_match',
        reason: 'Could not match to a session',
        meeting_title: payload.meeting_title,
      });
    }

    const child = session.child as any;
    const childName = child?.name || 'Unknown';

    // Generate AI summary
    const { summary, keyPoints, actionItems } = await generateTranscriptSummary(
      payload.transcript.text,
      session.session_type,
      childName
    );

    // Update the session with tl;dv data
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        tldv_meeting_id: payload.meeting_id,
        tldv_recording_url: payload.recording_url || null,
        tldv_transcript: payload.transcript.text, // Full transcript (internal)
        tldv_ai_summary: summary, // AI summary (visible to coach/parent)
        tldv_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Session update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Create learning_event with transcript data for RAG
    const eventData = {
      session_type: session.session_type,
      tldv_meeting_id: payload.meeting_id,
      duration_minutes: payload.duration_minutes || null,
      key_points: keyPoints,
      action_items: actionItems,
      participant_count: payload.participants?.length || 0,
    };

    // Content for semantic search (don't include full transcript to save embedding costs)
    const contentForEmbedding = [
      summary,
      ...keyPoints,
      ...actionItems,
    ].join(' ');

    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: session.child_id,
        coach_id: session.coach_id,
        session_id: session.id,
        event_type: 'tldv_transcript',
        event_subtype: session.session_type,
        event_data: eventData,
        tldv_recording_url: payload.recording_url || null,
        tldv_transcript: payload.transcript.text,
        ai_summary: summary,
        content_for_embedding: contentForEmbedding,
        created_at: new Date().toISOString(),
      });

    if (eventError) {
      console.error('Event creation error:', eventError);
      // Don't fail - session already updated
    }

    // Also store the main session event if not already created
    const { data: existingEvent } = await supabase
      .from('learning_events')
      .select('id')
      .eq('session_id', session.id)
      .eq('event_type', 'session')
      .single();

    if (!existingEvent) {
      // Create session event (coach form may not have been filled yet)
      await supabase
        .from('learning_events')
        .insert({
          child_id: session.child_id,
          coach_id: session.coach_id,
          session_id: session.id,
          event_type: 'session',
          event_subtype: session.session_type,
          event_data: {
            auto_created: true,
            from_tldv: true,
          },
          ai_summary: summary,
          content_for_embedding: contentForEmbedding,
          created_at: new Date().toISOString(),
        });
    }

    console.log(`tl;dv processed for session ${session.id} (${childName})`);

    return NextResponse.json({
      status: 'processed',
      session_id: session.id,
      child_name: childName,
      summary: summary,
      key_points_count: keyPoints.length,
      action_items_count: actionItems.length,
    });

  } catch (error) {
    console.error('tl;dv webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for health check and status
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'tl;dv webhook endpoint active',
    enabled: TLDV_ENABLED,
    webhook_url: '/api/webhooks/tldv',
    supported_events: ['meeting.transcript_ready'],
    configuration: {
      has_secret: !!TLDV_WEBHOOK_SECRET,
      has_gemini_key: !!process.env.GEMINI_API_KEY,
    },
  });
}