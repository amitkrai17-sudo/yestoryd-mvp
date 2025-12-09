import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Format events into readable context for AI
function formatEventsForContext(events: any[], childName: string): string {
  if (!events || events.length === 0) {
    return `No learning history available yet for ${childName}.`;
  }

  const formattedEvents = events.map((event) => {
    const date = new Date(event.event_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    switch (event.event_type) {
      case 'assessment':
        return `[${date}] ASSESSMENT: Score ${event.data.score}/10, WPM: ${event.data.wpm}, Fluency: ${event.data.fluency}. ${event.ai_summary || ''}`;
      
      case 'session':
        return `[${date}] COACHING SESSION: ${event.data.duration || 30} mins with ${event.data.coach || 'coach'}. ${event.ai_summary || event.data.notes || ''}`;
      
      case 'handwritten':
        return `[${date}] HANDWRITTEN WORK: Grade ${event.data.grade || 'N/A'}. ${event.ai_summary || event.data.feedback || ''}`;
      
      case 'quiz':
        return `[${date}] QUIZ: Score ${event.data.score}/${event.data.total} on ${event.data.topic || 'reading'}. ${event.ai_summary || ''}`;
      
      case 'milestone':
        return `[${date}] MILESTONE: ${event.data.title || event.ai_summary || 'Achievement unlocked!'}`;
      
      case 'note':
        return `[${date}] NOTE: ${event.data.content || event.ai_summary || ''}`;
      
      default:
        return `[${date}] ${event.event_type.toUpperCase()}: ${event.ai_summary || JSON.stringify(event.data)}`;
    }
  });

  return formattedEvents.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const { messages, childId } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    // Get child info (use demo data if not found)
    let childName = 'your child';
    let childAge = '';
    let coachName = 'the reading coach';
    let context = 'No learning history available yet.';

    if (childId && childId !== 'demo-child-id') {
      try {
        const { data: child } = await supabase
          .from('children')
          .select(`*, coach:coaches(name)`)
          .eq('id', childId)
          .single();

        if (child) {
          childName = child.name;
          childAge = child.age ? `${child.age} year old` : '';
          coachName = child.coach?.name || 'the reading coach';

          const { data: events } = await supabase
            .from('learning_events')
            .select('*')
            .eq('child_id', childId)
            .order('event_date', { ascending: false })
            .limit(50);

          if (events) {
            context = formatEventsForContext(events, childName);
          }
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    } else {
      // Demo data
      childName = 'Demo Child';
      childAge = '8 year old';
      context = `[Today] ASSESSMENT: Score 7/10, WPM: 85, Fluency: Good. Good reading progress! Speed is improving.
[Yesterday] COACHING SESSION: 30 mins with Rucha. Productive session focusing on phonics patterns.`;
    }

    const systemPrompt = `You are Yestoryd's AI assistant helping parents understand their child's reading progress.

Child: ${childName}${childAge ? ` (${childAge})` : ''}
Coach: ${coachName}

Learning History:
${context}

RESPONSE RULES:
- Maximum 3-4 sentences
- Use specific numbers from the data (scores, WPM, dates)
- Give ONE concrete action tip
- No jargon, no lengthy explanations
- Be warm but brief

Example good response:
"${childName} scored 7/10 last week with 85 WPM - that's solid progress! Fluency is improving. Try 10 mins of paired reading tonight where you read a sentence, then they repeat it."`;

    // Build conversation history for Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const chat = model.startChat({
      history: messages.slice(0, -1).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        maxOutputTokens: 1024,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const prompt = messages.length === 1 
      ? `${systemPrompt}\n\nUser: ${lastMessage.content}`
      : lastMessage.content;

    const result = await chat.sendMessage(prompt);
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { status: 500 }
    );
  }
}
