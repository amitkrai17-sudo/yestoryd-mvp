import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Event types
type EventType = 'assessment' | 'session' | 'quiz' | 'milestone' | 'note' | 'handwritten';

interface LearningEventInput {
  child_id: string;
  event_type: EventType;
  event_date?: string;
  data: Record<string, any>;
  created_by?: string;
}

// Generate embedding for the event
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Generate AI summary for the event
async function generateAISummary(eventType: EventType, data: Record<string, any>): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    let prompt = '';
    switch (eventType) {
      case 'assessment':
        prompt = `Summarize this reading assessment in 1-2 sentences for a parent. Be encouraging but honest.
Score: ${data.score || 'N/A'}/10
Reading Speed: ${data.wpm || 'N/A'} words per minute
Fluency: ${data.fluency || 'N/A'}
Pronunciation: ${data.pronunciation || 'N/A'}
Comprehension: ${data.comprehension || 'N/A'}
Areas to improve: ${data.areas_to_improve || 'N/A'}
Feedback: ${data.feedback || 'None provided'}`;
        break;

      case 'session':
        prompt = `Summarize this coaching session in 1-2 sentences highlighting key progress.
Duration: ${data.duration || 30} minutes
Focus Area: ${data.focus_area || 'General reading'}
Activities: ${data.activities || 'Reading practice'}
Coach Notes: ${data.notes || data.coach_notes || 'No notes'}
Homework: ${data.homework || 'None assigned'}`;
        break;

      case 'quiz':
        prompt = `Summarize this quiz result in 1 sentence.
Topic: ${data.topic || 'Reading'}
Score: ${data.score || 0}/${data.total || 10}
Time Taken: ${data.time_taken || 'N/A'}
Difficult Areas: ${data.difficult_areas || 'None noted'}`;
        break;

      case 'milestone':
        prompt = `Create a celebratory 1-sentence summary of this achievement.
Milestone: ${data.title || data.milestone || 'Achievement'}
Description: ${data.description || ''}`;
        break;

      case 'handwritten':
        prompt = `Summarize this handwritten work evaluation in 1-2 sentences.
Type: ${data.type || 'Writing exercise'}
Grade: ${data.grade || 'N/A'}
Feedback: ${data.feedback || 'No feedback'}
Areas of strength: ${data.strengths || 'N/A'}
Areas to improve: ${data.improvements || 'N/A'}`;
        break;

      case 'note':
        prompt = `Rephrase this note in 1 sentence: ${data.content || data.note || ''}`;
        break;

      default:
        prompt = `Summarize this learning event in 1 sentence: ${JSON.stringify(data)}`;
    }

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('AI summary generation error:', error);
    return '';
  }
}

// Create searchable text from event for embedding
function createSearchableText(eventType: EventType, data: Record<string, any>, aiSummary: string): string {
  const parts: string[] = [eventType];

  // Add all relevant data fields
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'string') {
      parts.push(value);
    } else if (value && typeof value === 'number') {
      parts.push(`${key}: ${value}`);
    }
  });

  // Add AI summary
  if (aiSummary) {
    parts.push(aiSummary);
  }

  return parts.join(' ');
}

// POST: Create a new learning event
export async function POST(request: NextRequest) {
  try {
    const body: LearningEventInput = await request.json();
    const { child_id, event_type, event_date, data, created_by } = body;

    if (!child_id || !event_type || !data) {
      return NextResponse.json(
        { error: 'child_id, event_type, and data are required' },
        { status: 400 }
      );
    }

    // Validate event type
    const validTypes: EventType[] = ['assessment', 'session', 'quiz', 'milestone', 'note', 'handwritten'];
    if (!validTypes.includes(event_type)) {
      return NextResponse.json(
        { error: `Invalid event_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate AI summary
    const aiSummary = await generateAISummary(event_type, data);

    // Create searchable text and generate embedding
    const searchableText = createSearchableText(event_type, data, aiSummary);
    const embedding = await generateEmbedding(searchableText);

    // Insert into database
    const { data: event, error } = await supabase
      .from('learning_events')
      .insert({
        child_id,
        event_type,
        event_date: event_date || new Date().toISOString(),
        data,
        ai_summary: aiSummary,
        embedding,
        created_by,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      event,
      message: 'Learning event created with AI summary and embedding'
    });
  } catch (error: any) {
    console.error('Learning events API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
}

// GET: Retrieve learning events for a child
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!childId) {
      return NextResponse.json({ error: 'childId required' }, { status: 400 });
    }

    let query = supabase
      .from('learning_events')
      .select('*')
      .eq('child_id', childId)
      .order('event_date', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data: events, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('Get events error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get events' },
      { status: 500 }
    );
  }
}
