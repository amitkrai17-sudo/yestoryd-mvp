// file: app/api/sessions/parent-checkin/route.ts
// API endpoint for saving parent check-in session data
// Saves to scheduled_sessions + learning_events for RAG

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface ParentCheckinRequest {
  sessionId: string;
  coachId: string;
  childId: string;
  
  // Parent sentiment
  parentSentiment: string;
  parentSeesProgress: string;
  
  // Home practice
  homePracticeFrequency: string;
  homeHelpers: string[];
  
  // Concerns
  concernsRaised: string[];
  concernDetails?: string;
  actionItems?: string;
  
  // Follow-up and renewal
  followUpNeeded: boolean;
  followUpDate?: string;
  escalateToAdmin: boolean;
  renewalLikelihood: string;
  
  // Voice note
  voiceNote?: string;
}

// Transcribe voice note using Gemini
async function transcribeVoiceNote(audioBase64: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const audioData = audioBase64.split(',')[1] || audioBase64;
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioData,
        },
      },
      { text: 'Transcribe this voice note from a reading coach about a parent check-in session. Return only the transcription, no additional text.' },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error('Voice transcription error:', error);
    return '';
  }
}

// Generate AI summary for the check-in
async function generateCheckinSummary(
  childName: string,
  parentName: string,
  data: ParentCheckinRequest,
  voiceTranscript?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = `
You are summarizing a parent check-in call for a children's reading coaching program.

Child: ${childName}
Parent: ${parentName}

Check-in Details:
- Parent Sentiment: ${data.parentSentiment}
- Parent sees improvement: ${data.parentSeesProgress}
- Home practice frequency: ${data.homePracticeFrequency}
- Who helps at home: ${data.homeHelpers.join(', ')}
- Concerns raised: ${data.concernsRaised.join(', ')}
${data.concernDetails ? `- Concern details: ${data.concernDetails}` : ''}
${data.actionItems ? `- Action items: ${data.actionItems}` : ''}
- Renewal likelihood: ${data.renewalLikelihood}
${data.followUpNeeded ? `- Follow-up needed: Yes (by ${data.followUpDate})` : ''}
${data.escalateToAdmin ? '- ESCALATED TO ADMIN' : ''}
${voiceTranscript ? `\nCoach's voice note: "${voiceTranscript}"` : ''}

Write a concise 2-3 sentence summary that captures:
1. Parent's overall satisfaction and perception of progress
2. Key points or concerns discussed
3. Next steps or action items

Be professional and factual. This will be stored for future reference.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Summary generation error:', error);
    // Fallback summary
    return `Parent check-in completed. Sentiment: ${data.parentSentiment}. Progress perceived: ${data.parentSeesProgress}. Home practice: ${data.homePracticeFrequency}. Renewal likelihood: ${data.renewalLikelihood}.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: ParentCheckinRequest = await request.json();

    // Validate required fields
    if (!data.sessionId || !data.coachId || !data.childId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get child and parent info
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('name, parent_name')
      .eq('id', data.childId)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      );
    }

    // Transcribe voice note if provided
    let voiceTranscript = '';
    if (data.voiceNote) {
      voiceTranscript = await transcribeVoiceNote(data.voiceNote);
    }

    // Generate AI summary
    const aiSummary = await generateCheckinSummary(
      child.name,
      child.parent_name || 'Parent',
      data,
      voiceTranscript
    );

    // Update scheduled_sessions with check-in data
    const { error: sessionError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        
        // Parent check-in specific fields
        parent_sentiment: data.parentSentiment,
        parent_sees_progress: data.parentSeesProgress,
        home_practice_frequency: data.homePracticeFrequency,
        home_helpers: data.homeHelpers,
        concerns_raised: data.concernsRaised,
        concern_details: data.concernDetails || null,
        action_items: data.actionItems || null,
        follow_up_needed: data.followUpNeeded,
        follow_up_date: data.followUpDate || null,
        escalate_to_admin: data.escalateToAdmin,
        
        // Voice note
        voice_note_transcript: voiceTranscript || null,
        
        // AI summary (visible to coach/parent)
        tldv_ai_summary: aiSummary,
        
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.sessionId);

    if (sessionError) {
      console.error('Session update error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Create learning_event for RAG
    const eventData = {
      session_type: 'parent_checkin',
      parent_sentiment: data.parentSentiment,
      parent_sees_progress: data.parentSeesProgress,
      home_practice_frequency: data.homePracticeFrequency,
      home_helpers: data.homeHelpers,
      concerns_raised: data.concernsRaised,
      concern_details: data.concernDetails || null,
      action_items: data.actionItems || null,
      renewal_likelihood: data.renewalLikelihood,
      follow_up_needed: data.followUpNeeded,
      escalated: data.escalateToAdmin,
      voice_transcript: voiceTranscript || null,
      ai_summary: aiSummary,
    };

    // Create content for embedding (searchable text)
    const contentForEmbedding = [
      `Parent check-in: ${data.parentSentiment}`,
      `Progress: ${data.parentSeesProgress}`,
      `Home practice: ${data.homePracticeFrequency}`,
      `Concerns: ${data.concernsRaised.join(', ')}`,
      data.concernDetails || '',
      data.actionItems || '',
      voiceTranscript || '',
      aiSummary,
    ].filter(Boolean).join(' ');

    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: data.childId,
        coach_id: data.coachId,
        session_id: data.sessionId,
        event_type: 'session',
        event_subtype: 'parent_checkin',
        event_data: eventData,
        ai_summary: aiSummary,
        voice_note_transcript: voiceTranscript || null,
        content_for_embedding: contentForEmbedding,
        created_at: new Date().toISOString(),
      });

    if (eventError) {
      console.error('Event creation error:', eventError);
      // Don't fail if event creation fails - session is already updated
    }

    // Also create parent_feedback event for easier querying
    const { error: feedbackError } = await supabase
      .from('learning_events')
      .insert({
        child_id: data.childId,
        coach_id: data.coachId,
        session_id: data.sessionId,
        event_type: 'parent_feedback',
        event_data: {
          sentiment: data.parentSentiment,
          sees_progress: data.parentSeesProgress,
          feedback: data.concernDetails || aiSummary,
          concerns: data.concernsRaised,
        },
        content_for_embedding: `Parent feedback: ${data.parentSentiment}. ${data.concernDetails || ''} ${aiSummary}`,
        created_at: new Date().toISOString(),
      });

    if (feedbackError) {
      console.error('Feedback event creation error:', feedbackError);
    }

    // Update child's renewal likelihood
    const { error: childUpdateError } = await supabase
      .from('children')
      .update({
        renewal_likelihood: data.renewalLikelihood,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.childId);

    if (childUpdateError) {
      console.error('Child update error:', childUpdateError);
    }

    // If escalated, could trigger a notification here
    if (data.escalateToAdmin) {
      console.log(`ESCALATION: Parent check-in for ${child.name} requires admin attention`);
      // TODO: Send notification to Rucha via email/WhatsApp
    }

    return NextResponse.json({
      success: true,
      sessionId: data.sessionId,
      summary: aiSummary,
      escalated: data.escalateToAdmin,
    });

  } catch (error) {
    console.error('Parent check-in error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check session status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      *,
      child:children(name, parent_name, parent_email)
    `)
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
