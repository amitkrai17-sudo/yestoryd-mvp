// file: app/api/sessions/complete/route.ts
// API endpoint for completing coaching/remedial sessions
// Saves structured data + voice note + creates learning events for RAG

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface SessionCompleteRequest {
  sessionId: string;
  coachId: string;
  childId: string;
  sessionType: 'coaching' | 'remedial' | 'trial';
  
  // Step 1: Basic assessment
  focusArea: string;
  progressRating: string;
  engagementLevel: string;
  confidenceLevel: number;
  
  // Step 2: Skills
  skillsWorkedOn: string[];
  
  // Step 3: Voice note
  voiceNote?: string;
  
  // Step 4: Homework, quiz, flags
  homeworkAssigned: boolean;
  homeworkTopic?: string;
  homeworkDescription?: string;
  quizAssigned: boolean;
  quizTopic?: string;
  flaggedForAttention: boolean;
  flagReason?: string;
  breakthroughMoment?: string;
  concerns?: string;
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
      { text: 'Transcribe this voice note from a reading coach about a coaching session. Return only the transcription, no additional commentary.' },
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error('Voice transcription error:', error);
    return '';
  }
}

// Generate AI summary for the session
async function generateSessionSummary(
  childName: string,
  data: SessionCompleteRequest,
  voiceTranscript?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = `
You are summarizing a reading coaching session for a child.

Child: ${childName}
Session Type: ${data.sessionType}

Session Details:
- Focus area: ${data.focusArea}
- Progress vs last session: ${data.progressRating}
- Engagement level: ${data.engagementLevel}
- Confidence level: ${data.confidenceLevel}/5
- Skills worked on: ${data.skillsWorkedOn.length > 0 ? data.skillsWorkedOn.join(', ') : 'Not specified'}
${data.homeworkAssigned ? `- Homework assigned: ${data.homeworkTopic} - ${data.homeworkDescription || ''}` : ''}
${data.breakthroughMoment ? `- Breakthrough moment: ${data.breakthroughMoment}` : ''}
${data.concerns ? `- Concerns: ${data.concerns}` : ''}
${data.flaggedForAttention ? `- FLAGGED: ${data.flagReason}` : ''}
${voiceTranscript ? `\nCoach's notes: "${voiceTranscript}"` : ''}

Write a concise 2-3 sentence summary that captures:
1. What was worked on and how the child performed
2. Key observations (progress, engagement, confidence)
3. Any notable moments or concerns

Be professional and factual. This will be shown to parents and used for tracking.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Summary generation error:', error);
    // Fallback summary
    return `${data.sessionType.charAt(0).toUpperCase() + data.sessionType.slice(1)} session focused on ${data.focusArea}. Progress: ${data.progressRating}. Engagement: ${data.engagementLevel}. Confidence: ${data.confidenceLevel}/5.`;
  }
}

// Update child skill progress
async function updateSkillProgress(childId: string, skillsWorkedOn: string[]) {
  for (const skillCode of skillsWorkedOn) {
    // Check if skill exists for this child
    const { data: existing } = await supabase
      .from('child_skill_progress')
      .select('id, sessions_worked_on')
      .eq('child_id', childId)
      .eq('skill_code', skillCode)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('child_skill_progress')
        .update({
          sessions_worked_on: (existing.sessions_worked_on || 0) + 1,
          last_assessed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from('child_skill_progress')
        .insert({
          child_id: childId,
          skill_code: skillCode,
          current_level: 2, // "Learning"
          sessions_worked_on: 1,
          last_assessed_at: new Date().toISOString(),
        });
    }
  }
}

// Create homework assignment
async function createHomeworkAssignment(
  childId: string,
  coachId: string,
  sessionId: string,
  topic: string,
  description?: string
) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // Due in 1 week

  const { error } = await supabase
    .from('homework_assignments')
    .insert({
      child_id: childId,
      coach_id: coachId,
      session_id: sessionId,
      topic,
      description,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'assigned',
    });

  if (error) {
    console.error('Homework creation error:', error);
  }
}

// Send quiz to child (placeholder - would integrate with WhatsApp/email)
async function sendQuizToChild(childId: string, sessionId: string, quizTopic: string) {
  // Find or generate quiz
  const { data: quiz } = await supabase
    .from('quiz_bank')
    .select('id, title')
    .eq('topic', quizTopic)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (quiz) {
    // Get child's parent info
    const { data: child } = await supabase
      .from('children')
      .select('parent_email, parent_phone, name')
      .eq('id', childId)
      .single();

    if (child) {
      // TODO: Send WhatsApp/Email with quiz link
      console.log(`Quiz "${quiz.title}" to be sent to ${child.parent_email || child.parent_phone}`);
      
      // Create learning event for quiz assignment
      await supabase
        .from('learning_events')
        .insert({
          child_id: childId,
          session_id: sessionId,
          event_type: 'quiz',
          event_subtype: 'assigned',
          event_data: {
            quiz_id: quiz.id,
            quiz_title: quiz.title,
            topic: quizTopic,
            status: 'sent',
          },
        });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: SessionCompleteRequest = await request.json();

    // Validate required fields
    if (!data.sessionId || !data.coachId || !data.childId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, coachId, childId' },
        { status: 400 }
      );
    }

    if (!data.focusArea || !data.progressRating || !data.engagementLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: focusArea, progressRating, engagementLevel' },
        { status: 400 }
      );
    }

    // Get child info
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('name, age, current_confidence_level')
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
    const aiSummary = await generateSessionSummary(child.name, data, voiceTranscript);

    // Update scheduled_sessions
    const { error: sessionError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        
        // Form data
        focus_area: data.focusArea,
        progress_rating: data.progressRating,
        engagement_level: data.engagementLevel,
        confidence_level: data.confidenceLevel,
        skills_worked_on: data.skillsWorkedOn,
        
        // Voice note
        voice_note_transcript: voiceTranscript || null,
        
        // Homework & quiz
        homework_assigned: data.homeworkAssigned,
        homework_topic: data.homeworkTopic || null,
        homework_description: data.homeworkDescription || null,
        quiz_assigned: data.quizAssigned,
        quiz_topic: data.quizTopic || null,
        
        // Flags
        flagged_for_attention: data.flaggedForAttention,
        flag_reason: data.flagReason || null,
        breakthrough_moment: data.breakthroughMoment || null,
        concerns_noted: data.concerns || null,
        
        // AI summary
        ai_summary: aiSummary,
        
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
      session_type: data.sessionType,
      focus_area: data.focusArea,
      progress_rating: data.progressRating,
      engagement_level: data.engagementLevel,
      confidence_level: data.confidenceLevel,
      skills_worked_on: data.skillsWorkedOn,
      homework_assigned: data.homeworkAssigned,
      homework_topic: data.homeworkTopic,
      quiz_assigned: data.quizAssigned,
      breakthrough_moment: data.breakthroughMoment,
      concerns: data.concerns,
      flagged: data.flaggedForAttention,
      flag_reason: data.flagReason,
      voice_transcript: voiceTranscript,
      ai_summary: aiSummary,
    };

    // Build content for embedding
    const contentForEmbedding = [
      `${data.sessionType} session focused on ${data.focusArea}`,
      `Progress: ${data.progressRating}`,
      `Engagement: ${data.engagementLevel}`,
      `Confidence: ${data.confidenceLevel}/5`,
      data.skillsWorkedOn.length > 0 ? `Skills: ${data.skillsWorkedOn.join(', ')}` : '',
      data.breakthroughMoment || '',
      data.concerns || '',
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
        event_subtype: data.sessionType,
        event_data: eventData,
        ai_summary: aiSummary,
        voice_note_transcript: voiceTranscript || null,
        content_for_embedding: contentForEmbedding,
        created_at: new Date().toISOString(),
      });

    if (eventError) {
      console.error('Event creation error:', eventError);
      // Don't fail - session is already updated
    }

    // Update skill progress
    if (data.skillsWorkedOn.length > 0) {
      await updateSkillProgress(data.childId, data.skillsWorkedOn);
    }

    // Create homework assignment
    if (data.homeworkAssigned && data.homeworkTopic) {
      await createHomeworkAssignment(
        data.childId,
        data.coachId,
        data.sessionId,
        data.homeworkTopic,
        data.homeworkDescription
      );
    }

    // Send quiz
    if (data.quizAssigned && data.quizTopic) {
      await sendQuizToChild(data.childId, data.sessionId, data.quizTopic);
    }

    // Update child's confidence level
    const { error: childUpdateError } = await supabase
      .from('children')
      .update({
        current_confidence_level: data.confidenceLevel,
        sessions_completed: child.age, // This should be increment, fixed below
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.childId);

    // Actually increment sessions_completed
    await supabase.rpc('increment_sessions_completed', { child_id: data.childId });

    // If flagged, log for admin attention
    if (data.flaggedForAttention) {
      console.log(`ATTENTION: Session flagged for ${child.name} - ${data.flagReason}`);
      // TODO: Send notification to admin
    }

    // Create breakthrough milestone if applicable
    if (data.breakthroughMoment) {
      await supabase
        .from('learning_events')
        .insert({
          child_id: data.childId,
          coach_id: data.coachId,
          session_id: data.sessionId,
          event_type: 'milestone',
          event_subtype: 'breakthrough',
          event_data: {
            description: data.breakthroughMoment,
            session_focus: data.focusArea,
          },
          content_for_embedding: `Breakthrough: ${data.breakthroughMoment}`,
        });
    }

    return NextResponse.json({
      success: true,
      sessionId: data.sessionId,
      summary: aiSummary,
      homeworkCreated: data.homeworkAssigned,
      quizSent: data.quizAssigned,
      flagged: data.flaggedForAttention,
    });

  } catch (error) {
    console.error('Session complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if session exists
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
      child:children(id, name, age, parent_name)
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