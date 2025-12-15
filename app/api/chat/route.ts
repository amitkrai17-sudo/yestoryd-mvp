import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  childId?: string;
  userRole: 'parent' | 'coach' | 'admin';
  userEmail: string;
}

// Get child details with coach info
async function getChildDetails(childId: string) {
  const { data: child } = await supabase
    .from('children')
    .select(`
      *,
      coaches (
        id,
        name,
        email,
        phone
      )
    `)
    .eq('id', childId)
    .single();

  return child;
}

// Get relevant learning events using vector similarity (RAG)
async function getRelevantEvents(
  childId: string,
  query: string,
  limit: number = 10
) {
  // First try vector search if embedding exists
  try {
    const { data: events } = await supabase
      .from('learning_events')
      .select('*')
      .eq('child_id', childId)
      .order('event_date', { ascending: false })
      .limit(limit);

    return events || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

// Get session history
async function getSessionHistory(childId: string, limit: number = 10) {
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('child_id', childId)
    .order('scheduled_date', { ascending: false })
    .limit(limit);

  return sessions || [];
}

// Format learning events for context
function formatEventsForContext(events: any[], childName: string): string {
  if (!events || events.length === 0) {
    return 'No learning events recorded yet.';
  }

  const formattedEvents = events.map((event) => {
    const date = new Date(event.event_date || event.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
    const data = event.data || {};

    switch (event.event_type) {
      case 'assessment':
        return `[${date}] ASSESSMENT: Score ${data.score || data.reading_score}/10, WPM: ${data.wpm || 'N/A'}, Fluency: ${data.fluency_rating || 'N/A'}. ${event.ai_summary || ''}`;

      case 'session':
        return `[${date}] SESSION: ${data.session_title || 'Coaching session'}. Coach notes: ${data.coach_notes || event.ai_summary || 'No notes'}`;

      case 'quiz':
        return `[${date}] QUIZ: Score ${data.score}/${data.total_questions}, Topic: ${data.topic || 'General'}`;

      case 'home_practice':
        return `[${date}] HOME PRACTICE: ${data.activity || 'Reading practice'}, Duration: ${data.duration_minutes || 'N/A'} mins`;

      case 'feedback':
        return `[${date}] FEEDBACK: ${data.feedback_type || 'General'} - ${data.content || event.ai_summary || ''}`;

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
- Keep responses to 1-2 short paragraphs maximum
- Lead with specific data (scores, WPM, dates) first
- Then give ONE concrete action tip
- Be warm but concise - no lengthy explanations
- Use Indian English and relatable examples
- If data is not available, say so briefly

Example good response:
"${childName} scored 7/10 in the last assessment with 85 WPM - solid progress! Fluency is improving steadily. Try 10 minutes of paired reading tonight where you read a sentence, then ${childName} repeats it."

Remember: Data first, then one actionable tip!`;
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
- Keep responses to 1-2 paragraphs
- Lead with specific data points
- Provide actionable teaching recommendations
- Reference specific assessment results and session notes
- Suggest evidence-based reading strategies`;
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
- Keep responses concise (1-2 paragraphs)
- Be data-focused
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
        maxOutputTokens: 400, // Reduced from 800 for more concise responses
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