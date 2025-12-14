import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Feature flag - set to true when tl;dv is enabled
const TLDV_ENABLED = process.env.TLDV_ENABLED === 'true';

interface TldvWebhookPayload {
  event: string;
  meeting_id: string;
  recording_url?: string;
  transcript?: string;
  summary?: string;
  meeting_title?: string;
  participants?: string[];
  duration_minutes?: number;
  started_at?: string;
  ended_at?: string;
}

// Generate embedding for RAG
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Generate AI summary from transcript
async function generateSessionSummary(
  childName: string,
  transcript: string,
  duration: number
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = `Summarize this ${duration}-minute reading coaching session transcript for a parent. Focus on:
1. What the child worked on
2. Progress observed
3. Areas for improvement
4. Any homework or practice suggestions

Child name: ${childName}

Transcript:
${transcript.substring(0, 5000)} // Limit to 5000 chars

Provide a 3-4 sentence summary that is encouraging and informative.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('tl;dv summary generation error:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if tl;dv is enabled
    if (!TLDV_ENABLED) {
      return NextResponse.json({
        success: false,
        message: 'tl;dv integration is not enabled',
      }, { status: 200 }); // Return 200 to prevent webhook retries
    }

    // Verify webhook secret (optional but recommended)
    const webhookSecret = request.headers.get('x-tldv-secret');
    if (process.env.TLDV_WEBHOOK_SECRET && webhookSecret !== process.env.TLDV_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    const payload: TldvWebhookPayload = await request.json();
    
    const {
      event,
      meeting_id,
      recording_url,
      transcript,
      summary,
      meeting_title,
      duration_minutes,
    } = payload;

    // Only process completed recordings
    if (event !== 'recording.completed' && event !== 'transcript.ready') {
      return NextResponse.json({
        success: true,
        message: `Event ${event} acknowledged`,
      });
    }

    // Find the session by meeting ID (Google Meet link or cal booking)
    // Meeting title format expected: "Yestoryd - [Child Name] - Session [N]"
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('*, children(*)')
      .or(`google_meet_link.ilike.%${meeting_id}%,google_event_id.eq.${meeting_id}`)
      .single();

    if (sessionError || !session) {
      console.log('Session not found for meeting:', meeting_id);
      // Try to match by title
      if (meeting_title) {
        // Extract child name from title if possible
        console.log('Meeting title:', meeting_title);
      }
      return NextResponse.json({
        success: true,
        message: 'Session not found, webhook acknowledged',
      });
    }

    const child = session.children;
    const childName = child?.child_name || child?.name || 'Student';

    // Generate AI summary from transcript
    let aiSummary = summary || '';
    if (transcript && !aiSummary) {
      aiSummary = await generateSessionSummary(childName, transcript, duration_minutes || 30);
    }

    // Update session with tl;dv data
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        tldv_recording_url: recording_url || null,
        tldv_transcript: transcript || null,
        ai_summary: aiSummary || session.ai_summary,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Failed to update session with tl;dv data:', updateError);
    }

    // If we have transcript, save to learning_events
    if (transcript && child?.id) {
      const sessionData = {
        session_id: session.id,
        session_title: session.session_title || meeting_title,
        duration: duration_minutes,
        source: 'tldv',
        recording_url,
        transcript_preview: transcript.substring(0, 500),
      };

      const searchableText = `coaching session ${childName} ${aiSummary} ${transcript.substring(0, 1000)}`;
      const embedding = await generateEmbedding(searchableText);

      await supabase
        .from('learning_events')
        .insert({
          child_id: child.id,
          event_type: 'session',
          event_date: new Date().toISOString(),
          data: sessionData,
          ai_summary: aiSummary,
          embedding,
        });
    }

    return NextResponse.json({
      success: true,
      message: 'tl;dv webhook processed',
      sessionId: session.id,
    });

  } catch (error: any) {
    console.error('tl;dv webhook error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET: Health check for webhook
export async function GET() {
  return NextResponse.json({
    status: 'tl;dv webhook endpoint active',
    enabled: TLDV_ENABLED,
    message: TLDV_ENABLED 
      ? 'Ready to receive tl;dv webhooks' 
      : 'tl;dv integration is disabled. Set TLDV_ENABLED=true to enable.',
  });
}
