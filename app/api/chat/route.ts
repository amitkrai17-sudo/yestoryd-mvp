// FILE: app/api/chat/route.ts
// PURPOSE: RAG-powered chat API for rAI
// VERSION: v5 - Expanded to handle coach, payment, enrollment, and program queries

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
    .select('*')
    .eq('id', childId)
    .single();

  return child;
}

// Get coach details separately
async function getCoachDetails(coachId: string | null) {
  if (!coachId) return null;
  
  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name, email, phone')
    .eq('id', coachId)
    .single();

  return coach;
}

// Get enrollment details
async function getEnrollmentDetails(childId: string) {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('*')
    .eq('child_id', childId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return enrollment;
}

// Get payment details
async function getPaymentDetails(childId: string) {
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('child_id', childId)
    .eq('status', 'captured')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return payment;
}

// Get relevant learning events
async function getRelevantEvents(childId: string, limit: number = 10) {
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
    .order('scheduled_date', { ascending: true })
    .limit(limit);

  return sessions || [];
}

// Format learning events for context
function formatEventsForContext(events: any[]): string {
  if (!events || events.length === 0) {
    return 'LEARNING_EVENTS: None recorded yet';
  }

  const formattedEvents = events.map((event) => {
    const date = new Date(event.event_date || event.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const data = event.data || {};

    switch (event.event_type) {
      case 'assessment':
        return `ASSESSMENT (${date}): Score=${data.score || data.reading_score}/10, WPM=${data.wpm || 'N/A'}, Fluency=${data.fluency_rating || 'N/A'}`;

      case 'session':
        return `SESSION (${date}): ${data.session_title || 'Coaching'}, Focus=${data.focus_area || 'General'}, Engagement=${data.engagement_level || 'N/A'}`;

      default:
        return `${event.event_type?.toUpperCase()} (${date}): ${event.ai_summary || 'No details'}`;
    }
  });

  return 'LEARNING_EVENTS:\n' + formattedEvents.join('\n');
}

// Format sessions for context
function formatSessionsForContext(sessions: any[]): string {
  if (!sessions || sessions.length === 0) {
    return 'SCHEDULED_SESSIONS: EMPTY (No sessions scheduled)';
  }

  const now = new Date();
  const upcoming = sessions.filter(s => new Date(s.scheduled_date) >= now);
  const completed = sessions.filter(s => new Date(s.scheduled_date) < now).length;

  if (upcoming.length === 0) {
    return `SCHEDULED_SESSIONS: ${completed} completed, 0 upcoming (No future sessions scheduled)`;
  }

  const upcomingList = upcoming.slice(0, 3).map((s) => {
    const date = new Date(s.scheduled_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const time = new Date(s.scheduled_date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `- ${date} at ${time}: ${s.title || s.session_type || 'Session'}`;
  }).join('\n');

  return `SCHEDULED_SESSIONS: ${completed} completed, ${upcoming.length} upcoming\n${upcomingList}`;
}

// Format coach info
function formatCoachInfo(coach: any): string {
  if (!coach) {
    return 'COACH: Not assigned';
  }

  return `COACH_INFO:
- Name: ${coach.name || 'Rucha'}
- Email: ${coach.email || 'rucha@yestoryd.com'}
- WhatsApp: ${coach.phone || '918976287997'}`;
}

// Format enrollment info
function formatEnrollmentInfo(enrollment: any, payment: any): string {
  if (!enrollment) {
    return 'ENROLLMENT: Not found';
  }

  const startDate = enrollment.program_start 
    ? new Date(enrollment.program_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
  const endDate = enrollment.program_end
    ? new Date(enrollment.program_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
  
  const amount = payment?.amount || enrollment?.amount || 'N/A';
  const amountDisplay = amount !== 'N/A' ? `₹${amount}` : 'Not available';

  return `ENROLLMENT_INFO:
- Status: ${enrollment.status || 'active'}
- Program: 3-Month Reading Coaching
- Amount Paid: ${amountDisplay}
- Start Date: ${startDate}
- End Date: ${endDate}
- Sessions Included: 9 (6 coaching + 3 parent check-ins)`;
}

// Static Yestoryd program knowledge (no pricing - comes from database)
const YESTORYD_KNOWLEDGE = `
YESTORYD_PROGRAM_INFO:
- Program: 3-Month 1:1 Reading Coaching for children aged 0-12
- Sessions: 9 total (6 coaching sessions + 3 parent check-ins)
- Session Duration: 30-45 minutes each
- Master Key: Enrolled families get FREE access to e-learning, storytelling workshops, and group classes
- AI Assessment: FREE 5-minute reading assessment available at yestoryd.com
- Platform: Sessions via Google Meet, progress tracked in Parent Dashboard

SUPPORT_INFO:
- WhatsApp Support: 918976287997
- Email: engage@yestoryd.com
- Website: www.yestoryd.com
- Reschedule: Contact coach on WhatsApp or use Sessions page
- Dashboard: Track progress, view sessions, chat with rAI
`;

// Build system prompt
function buildSystemPrompt(
  userRole: 'parent' | 'coach' | 'admin',
  child: any,
  eventsContext: string,
  sessionsContext: string,
  coachInfo: string,
  enrollmentInfo: string,
  hasUpcomingSessions: boolean
): string {
  const childName = child?.child_name || child?.name || 'your child';
  const coachName = child?.coaches?.name || 'Rucha';
  const coachPhone = child?.coaches?.phone || '918976287997';

  if (userRole === 'parent') {
    return `You are rAI AI, the friendly assistant for Yestoryd reading platform. Speaking with parent of ${childName}.

=== DATABASE RECORDS ===
${eventsContext}

${sessionsContext}

${coachInfo}

${enrollmentInfo}

${YESTORYD_KNOWLEDGE}
=== END DATA ===

RULES (MUST FOLLOW):

1. NO MARKDOWN. No ** no * no - lists. Plain text sentences only.

2. MAX 3 sentences for simple questions. MAX 5 for complex.

3. ${hasUpcomingSessions ? 'Use session dates from SCHEDULED_SESSIONS only.' : 'No sessions scheduled. Say: "No sessions scheduled yet. Contact Coach ' + coachName + ' on WhatsApp (' + coachPhone + ') to schedule."'}

4. For coach questions: Give name, WhatsApp number, and email from COACH_INFO.

5. For payment/enrollment questions: Use data from ENROLLMENT_INFO only.

6. For program questions (Master Key, what's included, etc.): Use YESTORYD_PROGRAM_INFO.

7. For support/contact questions: Use SUPPORT_INFO.

8. NEVER invent dates, amounts, or contact details not shown above.

9. Be warm, helpful, and brief.

EXAMPLE RESPONSES:

Q: "Who is my coach?"
A: "Your coach is ${coachName}. You can reach her on WhatsApp at ${coachPhone} or email at ${child?.coaches?.email || 'rucha@yestoryd.com'}."

Q: "How much did I pay?"
A: "You paid [amount from ENROLLMENT_INFO] for the 3-month reading coaching program which includes 9 sessions and Master Key access to all other services."

Q: "What is Master Key?"
A: "Master Key means enrolled families get FREE access to all Yestoryd services including e-learning modules, storytelling workshops, and group classes."

Q: "How do I reschedule?"
A: "You can reschedule by contacting Coach ${coachName} on WhatsApp at ${coachPhone} or through the Sessions page in your dashboard."`;
  }

  if (userRole === 'coach') {
    return `rAI for coach. Student: ${childName}
DATA: ${eventsContext} | ${sessionsContext} | ${enrollmentInfo}
Rules: No markdown, max 4 sentences, only use data shown.`;
  }

  return `rAI for admin. Child: ${childName}
DATA: ${eventsContext} | ${sessionsContext} | ${enrollmentInfo}
Brief, factual responses only.`;
}

// Validate user access
async function validateAccess(
  userEmail: string,
  userRole: string,
  childId: string
): Promise<boolean> {
  if (userRole === 'admin') return true;

  if (userRole === 'parent') {
    const { data: child } = await supabase
      .from('children')
      .select('parent_email')
      .eq('id', childId)
      .single();
    return child?.parent_email === userEmail;
  }

  if (userRole === 'coach') {
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

    let eventsContext = 'LEARNING_EVENTS: None';
    let sessionsContext = 'SCHEDULED_SESSIONS: EMPTY';
    let coachInfo = 'COACH: Not assigned';
    let enrollmentInfo = 'ENROLLMENT: Not found';
    let child = null;
    let hasUpcomingSessions = false;

    if (childId) {
      const hasAccess = await validateAccess(userEmail, userRole, childId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Fetch all data in parallel
      child = await getChildDetails(childId);
      const [events, sessions, enrollment, payment, coach] = await Promise.all([
        getRelevantEvents(childId, 10),
        getSessionHistory(childId, 10),
        getEnrollmentDetails(childId),
        getPaymentDetails(childId),
        getCoachDetails(child?.coach_id),
      ]);

      eventsContext = formatEventsForContext(events);
      
      const now = new Date();
      hasUpcomingSessions = sessions.some(s => new Date(s.scheduled_date) >= now);
      sessionsContext = formatSessionsForContext(sessions);
      
      coachInfo = formatCoachInfo(coach);
      enrollmentInfo = formatEnrollmentInfo(enrollment, payment);
    }

    const systemPrompt = buildSystemPrompt(
      userRole, 
      child, 
      eventsContext, 
      sessionsContext, 
      coachInfo, 
      enrollmentInfo,
      hasUpcomingSessions
    );

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const lastMessage = messages[messages.length - 1].content;

    const result = await model.generateContent({
      contents: [
        { 
          role: 'user', 
          parts: [{ text: `${systemPrompt}\n\nParent asks: ${lastMessage}` }] 
        },
      ],
      generationConfig: {
        maxOutputTokens: 120,
        temperature: 0.2,
      },
    });

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