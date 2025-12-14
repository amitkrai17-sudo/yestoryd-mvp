import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Types
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  childId?: string;
  userRole: 'parent' | 'coach' | 'admin';
  userEmail: string;
}

// Generate embedding for semantic search
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Get relevant learning events using vector similarity
async function getRelevantEvents(
  childId: string,
  query: string,
  limit: number = 10
): Promise<any[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Use Supabase's vector similarity search
    const { data: events, error } = await supabase.rpc('match_learning_events', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      filter_child_id: childId,
    });

    if (error) {
      console.error('Vector search error:', error);
      // Fallback to recent events if vector search fails
      return await getRecentEvents(childId, limit);
    }

    return events || [];
  } catch (error) {
    console.error('Embedding error:', error);
    return await getRecentEvents(childId, limit);
  }
}

// Fallback: Get recent events without vector search
async function getRecentEvents(childId: string, limit: number = 20): Promise<any[]> {
  const { data: events, error } = await supabase
    .from('learning_events')
    .select('*')
    .eq('child_id', childId)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Recent events error:', error);
    return [];
  }

  return events || [];
}

// Get child details
async function getChildDetails(childId: string) {
  const { data: child, error } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .single();

  if (error) {
    console.error('Child fetch error:', error);
    return null;
  }

  return child;
}

// Get session history
async function getSessionHistory(childId: string, limit: number = 10) {
  const { data: sessions, error } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('child_id', childId)
    .order('scheduled_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Sessions fetch error:', error);
    return [];
  }

  return sessions || [];
}

// Format events for AI context
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

    const data = event.data || {};

    switch (event.event_type) {
      case 'assessment':
        return `[${date}] ASSESSMENT: Score ${data.score || 'N/A'}/10, WPM: ${data.wpm || 'N/A'}, Fluency: ${data.fluency || 'N/A'}. ${event.ai_summary || ''}`;

      case 'session':
        return `[${date}] COACHING SESSION: ${data.duration || 30} mins. Focus: ${data.focus_area || 'General reading'}. ${event.ai_summary || data.notes || ''}`;

      case 'quiz':
        return `[${date}] QUIZ: Score ${data.score || 0}/${data.total || 10} on ${data.topic || 'reading'}. ${event.ai_summary || ''}`;

      case 'milestone':
        return `[${date}] MILESTONE: ${data.title || event.ai_summary || 'Achievement unlocked!'}`;

      case 'note':
        return `[${date}] NOTE: ${data.content || event.ai_summary || ''}`;

      default:
        return `[${date}] ${event.event_type?.toUpperCase() || 'EVENT'}: ${event.ai_summary || JSON.stringify(data)}`;
    }
  });

  return formattedEvents.join('\n');
}

// Format sessions for context
function formatSessionsForContext(sessions: any[]): string {
  if (!sessions || sessions.length === 0) {
    return 'No session history available.';
  }

  return sessions
    .map((s) => {
      const date = new Date(s.scheduled_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      const status = s.status || 'scheduled';
      const notes = s.session_notes || s.coach_notes || '';
      return `[${date}] ${s.session_title || s.title || 'Session'} - ${status}${notes ? `: ${notes}` : ''}`;
    })
    .join('\n');
}

// Build system prompt based on user role
function buildSystemPrompt(
  userRole: 'parent' | 'coach' | 'admin',
  child: any,
  eventsContext: string,
  sessionsContext: string
): string {
  const childName = child?.child_name || child?.name || 'the child';
  const childAge = child?.age ? `${child.age} years old` : '';
  const coachName = child?.coaches?.name || 'the reading coach';

  const baseContext = `
Child Information:
- Name: ${childName}
- Age: ${childAge}
- Current Score: ${child?.latest_assessment_score || 'N/A'}/10
- Sessions Completed: ${child?.sessions_completed || 0}/${child?.total_sessions || 9}
- Program Status: ${child?.enrollment_status || 'active'}
- Coach: ${coachName}

Learning History (most recent first):
${eventsContext}

Session History:
${sessionsContext}
`;

  if (userRole === 'parent') {
    return `You are a helpful and warm AI assistant for Yestoryd, an AI-powered reading intelligence platform for children in India. You're speaking with the parent of ${childName}${childAge ? `, who is ${childAge}` : ''}.

${baseContext}

Your role:
1. Answer questions about ${childName}'s reading progress with specific data
2. Explain assessment results in simple, parent-friendly terms
3. Suggest practical activities to support reading at home
4. Celebrate achievements and milestones enthusiastically
5. Address concerns with empathy and actionable advice
6. Reference specific events from the history when relevant

Guidelines:
- Be warm, supportive, and encouraging
- Use simple language, avoid educational jargon
- If asked about something not in the history, say so honestly
- Suggest booking a coaching session for detailed discussions
- Keep responses concise but helpful (2-3 paragraphs max)
- Use Indian English and relatable examples

Remember: You're here to help parents support their child's reading journey!`;
  }

  if (userRole === 'coach') {
    return `You are an AI assistant for Yestoryd coaches. You're helping a coach prepare for and understand their student ${childName}'s progress.

${baseContext}

Your role:
1. Provide detailed insights about ${childName}'s learning patterns
2. Suggest specific teaching strategies based on the data
3. Help prepare session agendas
4. Identify areas needing attention
5. Track progress against goals

Guidelines:
- Be professional and data-driven
- Provide actionable teaching recommendations
- Reference specific assessment results and session notes
- Suggest evidence-based reading strategies
- Help identify patterns across sessions`;
  }

  // Admin role
  return `You are an AI assistant for Yestoryd administrators. You have access to ${childName}'s complete learning data.

${baseContext}

Your role:
1. Provide comprehensive data analysis
2. Answer any questions about the child's progress
3. Help with program decisions
4. Support coach assignments and schedule management

Guidelines:
- Be thorough and data-focused
- Provide complete context when needed
- Flag any concerns or anomalies`;
}

// Validate user access to child data
async function validateAccess(
  userEmail: string,
  userRole: string,
  childId: string
): Promise<boolean> {
  if (userRole === 'admin') {
    // Admins can access all children
    return true;
  }

  if (userRole === 'parent') {
    // Parents can only access their own children
    const { data: child } = await supabase
      .from('children')
      .select('parent_email')
      .eq('id', childId)
      .single();

    return child?.parent_email === userEmail;
  }

  if (userRole === 'coach') {
    // Coaches can only access assigned children
    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (!coach) return false;

    const { data: child } = await supabase
      .from('children')
      .select('assigned_coach_id')
      .eq('id', childId)
      .single();

    return child?.assigned_coach_id === coach.id;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, childId, userRole, userEmail } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    if (!userEmail || !userRole) {
      return NextResponse.json({ error: 'User context required' }, { status: 400 });
    }

    // Get the last user message for context retrieval
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

    let eventsContext = 'No specific child selected.';
    let sessionsContext = '';
    let child = null;

    // If childId provided, validate access and get context
    if (childId) {
      const hasAccess = await validateAccess(userEmail, userRole, childId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Get child details
      child = await getChildDetails(childId);

      // Get relevant events using RAG
      const events = await getRelevantEvents(
        childId,
        lastUserMessage?.content || '',
        15
      );
      eventsContext = formatEventsForContext(events, child?.child_name || child?.name || 'the child');

      // Get session history
      const sessions = await getSessionHistory(childId, 10);
      sessionsContext = formatSessionsForContext(sessions);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      userRole,
      child,
      eventsContext,
      sessionsContext
    );

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const chat = model.startChat({
      history: messages.slice(0, -1).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const prompt =
      messages.length === 1
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
