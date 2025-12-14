import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface SessionCompleteRequest {
  sessionId: string;
  coachId: string;
  // Structured data (mandatory)
  focusArea: string;
  progressRating: string;
  engagementLevel: string;
  // Homework (optional)
  homeworkAssigned: boolean;
  homeworkDescription?: string;
  // Voice note (optional)
  voiceNote?: string; // base64 audio
  // Quiz assignment (optional)
  quizTopic?: string;
  quizId?: string; // from quiz bank
  generateQuiz?: boolean; // AI generate if true
}

// Generate embedding for RAG
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
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
      { text: 'Transcribe this voice note from a reading coach about a tutoring session. Return only the transcription, no additional text.' },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error('Voice transcription error:', error);
    return '';
  }
}

// Generate AI summary from session data
async function generateSessionSummary(
  childName: string,
  focusArea: string,
  progressRating: string,
  engagementLevel: string,
  voiceTranscript?: string,
  homeworkDescription?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = `Summarize this coaching session in 2-3 sentences for a parent:
Child: ${childName}
Focus Area: ${focusArea}
Progress: ${progressRating}
Engagement: ${engagementLevel}
${voiceTranscript ? `Coach Notes: ${voiceTranscript}` : ''}
${homeworkDescription ? `Homework: ${homeworkDescription}` : ''}

Be encouraging and highlight positives while being honest about areas to work on.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Summary generation error:', error);
    return `${childName} had a ${engagementLevel.toLowerCase()} engagement session focusing on ${focusArea.toLowerCase()}. Progress: ${progressRating.toLowerCase()}.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SessionCompleteRequest = await request.json();
    
    const {
      sessionId,
      coachId,
      focusArea,
      progressRating,
      engagementLevel,
      homeworkAssigned,
      homeworkDescription,
      voiceNote,
      quizTopic,
      quizId,
      generateQuiz,
    } = body;

    // Validate required fields
    if (!sessionId || !coachId) {
      return NextResponse.json(
        { success: false, error: 'sessionId and coachId are required' },
        { status: 400 }
      );
    }

    if (!focusArea || !progressRating || !engagementLevel) {
      return NextResponse.json(
        { success: false, error: 'focusArea, progressRating, and engagementLevel are required' },
        { status: 400 }
      );
    }

    // Get session and child details
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('*, children(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const child = session.children;
    const childName = child?.child_name || child?.name || 'Student';

    // Transcribe voice note if provided
    let voiceTranscript = '';
    if (voiceNote) {
      voiceTranscript = await transcribeVoiceNote(voiceNote);
    }

    // Generate AI summary
    const aiSummary = await generateSessionSummary(
      childName,
      focusArea,
      progressRating,
      engagementLevel,
      voiceTranscript,
      homeworkDescription
    );

    // Update session record
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        focus_area: focusArea,
        progress_rating: progressRating,
        engagement_level: engagementLevel,
        homework_assigned: homeworkAssigned,
        homework_description: homeworkDescription || null,
        voice_note_transcript: voiceTranscript || null,
        ai_summary: aiSummary,
        quiz_topic: quizTopic || null,
        quiz_assigned_id: quizId || null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Session update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Prepare data for learning_events
    const sessionData = {
      session_id: sessionId,
      session_title: session.session_title || session.title || 'Coaching Session',
      session_number: session.session_number,
      duration: session.duration_minutes || 30,
      focus_area: focusArea,
      progress_rating: progressRating,
      engagement_level: engagementLevel,
      homework_assigned: homeworkAssigned,
      homework_description: homeworkDescription,
      voice_transcript: voiceTranscript,
      quiz_assigned: quizTopic || null,
    };

    // Create searchable text for embedding
    const searchableText = `coaching session ${focusArea} progress ${progressRating} engagement ${engagementLevel} ${voiceTranscript} ${homeworkDescription || ''} ${aiSummary}`;

    // Generate embedding
    const embedding = await generateEmbedding(searchableText);

    // Save to learning_events
    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: child.id,
        event_type: 'session',
        event_date: new Date().toISOString(),
        data: sessionData,
        ai_summary: aiSummary,
        embedding,
        created_by: coachId,
      });

    if (eventError) {
      console.error('Learning event save error:', eventError);
      // Don't fail the request, just log
    }

    // Update child's sessions_completed count
    await supabase
      .from('children')
      .update({
        sessions_completed: (child.sessions_completed || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', child.id);

    // If quiz assigned, create quiz link for child
    let quizLink = null;
    if (quizTopic && (quizId || generateQuiz)) {
      quizLink = `${process.env.NEXT_PUBLIC_APP_URL}/quiz/${sessionId}`;
      
      // TODO: Send WhatsApp/Email notification to parent with quiz link
    }

    return NextResponse.json({
      success: true,
      message: 'Session completed successfully',
      aiSummary,
      quizLink,
      savedToHistory: !eventError,
    });

  } catch (error: any) {
    console.error('Session complete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to complete session' },
      { status: 500 }
    );
  }
}

// GET: Fetch session details for completion form
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId required' },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select('*, children(id, name, child_name, age)')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
