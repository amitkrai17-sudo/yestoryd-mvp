import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Generate AI summary for an event
async function generateAISummary(eventType: string, data: Record<string, any>): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt = '';
    switch (eventType) {
      case 'assessment':
        prompt = `Summarize this reading assessment in 1-2 sentences for a parent: Score ${data.score}/10, Reading speed ${data.wpm} WPM, Fluency: ${data.fluency}, Pronunciation: ${data.pronunciation}. Feedback: ${data.feedback || 'None'}`;
        break;
      case 'session':
        prompt = `Summarize this coaching session in 1-2 sentences: ${data.duration || 30} minute session. Notes: ${data.notes || 'General reading practice'}`;
        break;
      case 'handwritten':
        prompt = `Summarize this handwritten work evaluation in 1-2 sentences: Grade ${data.grade || 'N/A'}. Feedback: ${data.feedback || 'Good effort'}`;
        break;
      case 'quiz':
        prompt = `Summarize this quiz result in 1 sentence: Score ${data.score}/${data.total} on topic: ${data.topic || 'reading comprehension'}`;
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

// POST - Create a new learning event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { child_id, event_type, data, event_date, created_by } = body;

    if (!child_id || !event_type || !data) {
      return NextResponse.json(
        { error: 'child_id, event_type, and data are required' },
        { status: 400 }
      );
    }

    // Generate AI summary
    const ai_summary = await generateAISummary(event_type, data);

    // Insert the event
    const { data: event, error } = await supabase
      .from('learning_events')
      .insert({
        child_id,
        event_type,
        data,
        ai_summary,
        event_date: event_date || new Date().toISOString(),
        created_by,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Fetch learning events for a child
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!childId) {
      return NextResponse.json(
        { error: 'childId is required' },
        { status: 400 }
      );
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
      console.error('Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
