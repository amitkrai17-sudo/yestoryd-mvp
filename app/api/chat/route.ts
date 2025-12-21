// file: app/api/chat/route.ts
// rAI v2.0 - Intelligent Chat API

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import {
  ChatResponse,
  UserRole,
  ChildWithCache,
  Coach,
} from '@/lib/rai/types';
import {
  classifyIntent,
  isRecentSessionQuery,
} from '@/lib/rai/intent-classifier';
import {
  hybridSearch,
  getSessionCache,
  formatCachedSummary,
  formatEventsForContext,
} from '@/lib/rai/hybrid-search';
import {
  getSystemPrompt,
  OPERATIONAL_RESPONSES,
  OFF_LIMITS_RESPONSES,
} from '@/lib/rai/prompts';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatRequestBody {
  message: string;
  userRole: UserRole;
  userId?: string;
  userEmail: string;
  childId?: string;
  chatHistory?: Array<{ role: string; content: string }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ChatRequestBody = await request.json();
    const { message, userRole, userEmail, childId, chatHistory } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    if (!userEmail || !userRole) {
      return NextResponse.json({ error: 'User context required' }, { status: 400 });
    }

    const { intent, tier0Match } = await classifyIntent(message, userRole);
    
    console.log(`🎯 Intent: ${intent} (Tier ${tier0Match ? '0' : '1'})`);

    let response: ChatResponse;

    switch (intent) {
      case 'LEARNING':
        response = await handleLearning(message, userRole, userEmail, childId, chatHistory);
        break;
        
      case 'OPERATIONAL':
        response = await handleOperational(message, userRole, userEmail);
        break;
        
      case 'SCHEDULE':
        response = await handleSchedule(message, userRole, userEmail);
        break;
        
      case 'OFF_LIMITS':
        response = handleOffLimits(userRole);
        break;
        
      default:
        response = await handleLearning(message, userRole, userEmail, childId, chatHistory);
    }

    response.intent = intent;
    response.debug = {
      ...response.debug,
      tier0Match,
      latencyMs: Date.now() - startTime,
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('rAI Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function handleLearning(
  message: string,
  userRole: UserRole,
  userEmail: string,
  childId?: string,
  chatHistory?: Array<{ role: string; content: string }>
): Promise<ChatResponse> {
  
  let child: ChildWithCache | null = null;
  let coach: Coach | null = null;
  let children: { id: string; name: string }[] = [];

  if (userRole === 'parent') {
    const { data: parentChildren } = await supabase
      .from('children')
      .select('id, name, child_name, age, parent_email, assigned_coach_id, last_session_summary, last_session_date, last_session_focus, sessions_completed, total_sessions, latest_assessment_score')
      .eq('parent_email', userEmail)
      .in('status', ['enrolled', 'assessment_complete']);

    if (!parentChildren || parentChildren.length === 0) {
      return {
        response: "I don't see any enrolled children for your account. If you've recently enrolled, it may take a few minutes to update. For help, contact support at 918976287997.",
        intent: 'LEARNING',
        source: 'sql',
      };
    }

    children = parentChildren.map(c => ({ id: c.id, name: c.child_name || c.name }));

    if (childId) {
      const found = parentChildren.find(c => c.id === childId);
      child = found ? (found as ChildWithCache) : null;
      if (!child) {
        return {
          response: "I don't have access to that child's information.",
          intent: 'LEARNING',
          source: 'redirect',
        };
      }
    } else if (parentChildren.length === 1) {
      child = parentChildren[0] as ChildWithCache;
    } else {
      return {
        response: `I see you have ${parentChildren.length} children enrolled: ${children.map(c => c.name).join(' and ')}. Which child are you asking about?`,
        intent: 'LEARNING',
        source: 'sql',
        needsChildSelection: true,
        children,
      };
    }

    if (child?.assigned_coach_id) {
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id, name, email, phone')
        .eq('id', child.assigned_coach_id)
        .single();
      coach = coachData as Coach | null;
    }
  } else if (userRole === 'coach') {
    if (childId) {
      const { data: childData } = await supabase
        .from('children')
        .select('id, name, child_name, age, parent_email, assigned_coach_id, last_session_summary, last_session_date, last_session_focus, sessions_completed, total_sessions, latest_assessment_score')
        .eq('id', childId)
        .single();
      
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (childData?.assigned_coach_id !== coachData?.id) {
        return {
          response: "I can only provide information about students assigned to you.",
          intent: 'LEARNING',
          source: 'redirect',
        };
      }

      child = childData as ChildWithCache;
    }
  }

  const childName = child?.child_name || child?.name || 'your child';

  if (userRole === 'parent' && child && isRecentSessionQuery(message)) {
    const cache = await getSessionCache(child.id);
    
    if (cache.isFresh && cache.summary && cache.date) {
      console.log('📦 Cache hit! Returning cached summary');
      return {
        response: formatCachedSummary(cache.summary, cache.date, childName),
        intent: 'LEARNING',
        source: 'cache',
        debug: { cacheHit: true, eventsRetrieved: 0 },
      };
    }
  }

  const searchResult = await hybridSearch({
    query: message,
    childId: child?.id,
    coachId: userRole === 'coach' ? await getCoachId(userEmail) : null,
    userRole,
    limit: 15,
  });

  const eventsContext = formatEventsForContext(searchResult.events);

  const systemPrompt = getSystemPrompt(
    userRole,
    childName,
    eventsContext,
    coach ? { name: coach.name, phone: coach.phone || '918976287997', email: coach.email } : null
  );

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  const conversationContext = chatHistory?.slice(-6).map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n') || '';

  const prompt = conversationContext 
    ? `${systemPrompt}\n\nConversation so far:\n${conversationContext}\n\nUser: ${message}`
    : `${systemPrompt}\n\nUser: ${message}`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: userRole === 'coach' ? 400 : 200,
      temperature: 0.3,
    },
  });

  const responseText = result.response.text();

  return {
    response: responseText,
    intent: 'LEARNING',
    source: 'rag',
    debug: {
      cacheHit: false,
      eventsRetrieved: searchResult.events.length,
    },
  };
}

async function handleOperational(
  message: string,
  userRole: UserRole,
  userEmail: string
): Promise<ChatResponse> {
  const lowerMessage = message.toLowerCase();

  if (/what is master key|master key/i.test(lowerMessage)) {
    return {
      response: OPERATIONAL_RESPONSES.master_key,
      intent: 'OPERATIONAL',
      source: 'sql',
    };
  }

  if (/program|what('?s| is) included|how many sessions/i.test(lowerMessage)) {
    return {
      response: OPERATIONAL_RESPONSES.program_info,
      intent: 'OPERATIONAL',
      source: 'sql',
    };
  }

  if (/reschedule|change.*session|move.*session/i.test(lowerMessage)) {
    const coach = await getCoachForParent(userEmail);
    return {
      response: OPERATIONAL_RESPONSES.reschedule(coach?.name || 'your coach', coach?.phone || '918976287997'),
      intent: 'OPERATIONAL',
      source: 'sql',
    };
  }

  if (/support|contact|help.*number|whatsapp/i.test(lowerMessage)) {
    return {
      response: OPERATIONAL_RESPONSES.support,
      intent: 'OPERATIONAL',
      source: 'sql',
    };
  }

  if (/who is my coach|coach('?s)? (name|email|phone|contact)/i.test(lowerMessage)) {
    const coach = await getCoachForParent(userEmail);
    if (coach) {
      return {
        response: `Your coach is ${coach.name}. You can reach ${coach.name.split(' ')[0]} on WhatsApp at ${coach.phone || '918976287997'} or email at ${coach.email}.`,
        intent: 'OPERATIONAL',
        source: 'sql',
      };
    } else {
      return {
        response: "I couldn't find your assigned coach. Please contact support at 918976287997 for assistance.",
        intent: 'OPERATIONAL',
        source: 'sql',
      };
    }
  }

  if (userRole === 'coach' && /how many (children|students|kids)/i.test(lowerMessage)) {
    const coachId = await getCoachId(userEmail);
    const { count } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_coach_id', coachId)
      .eq('status', 'enrolled');
    
    return {
      response: `You currently have ${count || 0} active student${count !== 1 ? 's' : ''} enrolled.`,
      intent: 'OPERATIONAL',
      source: 'sql',
    };
  }

  if (/payment|enrollment|subscription/i.test(lowerMessage)) {
    const { data: children } = await supabase
      .from('children')
      .select('child_name, status, enrolled_at, sessions_completed, total_sessions')
      .eq('parent_email', userEmail)
      .eq('status', 'enrolled');

    if (children && children.length > 0) {
      const child = children[0];
      const enrolledDate = child.enrolled_at 
        ? new Date(child.enrolled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'recently';
      
      return {
        response: `${child.child_name}'s enrollment is active. Enrolled on ${enrolledDate}. Progress: ${child.sessions_completed || 0}/${child.total_sessions || 9} sessions completed. You have Master Key access to all Yestoryd services.`,
        intent: 'OPERATIONAL',
        source: 'sql',
      };
    } else {
      return {
        response: "I couldn't find an active enrollment for your account. If you've recently paid, it may take a few minutes to update. Contact support at 918976287997 if you need help.",
        intent: 'OPERATIONAL',
        source: 'sql',
      };
    }
  }

  return {
    response: "I'm not sure about that. For program information, pricing, or support, please contact us on WhatsApp at 918976287997.",
    intent: 'OPERATIONAL',
    source: 'sql',
  };
}

async function handleSchedule(
  message: string,
  userRole: UserRole,
  userEmail: string
): Promise<ChatResponse> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (userRole === 'parent') {
    const { data: children } = await supabase
      .from('children')
      .select('id, child_name')
      .eq('parent_email', userEmail)
      .eq('status', 'enrolled');

    if (!children || children.length === 0) {
      return {
        response: "I don't see any enrolled children for your account.",
        intent: 'SCHEDULE',
        source: 'sql',
      };
    }

    const childIds = children.map(c => c.id);

    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        scheduled_date,
        scheduled_time,
        session_type,
        google_meet_link,
        child_id,
        coach:coaches(name)
      `)
      .in('child_id', childIds)
      .gte('scheduled_date', today)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(5);

    if (!sessions || sessions.length === 0) {
      const coach = await getCoachForParent(userEmail);
      return {
        response: `No upcoming sessions scheduled yet. To book a session, contact Coach ${coach?.name || 'your coach'} on WhatsApp at ${coach?.phone || '918976287997'}.`,
        intent: 'SCHEDULE',
        source: 'sql',
      };
    }

    const nextSession = sessions[0];
    const child = children.find(c => c.id === nextSession.child_id);
    const sessionDate = new Date(nextSession.scheduled_date).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
    
    const coachData = nextSession.coach as { name: string } | { name: string }[] | null;
    const coachName = Array.isArray(coachData) ? coachData[0]?.name : coachData?.name;
    let responseText = `${child?.child_name}'s next session is on ${sessionDate} at ${formatTime(nextSession.scheduled_time)} with Coach ${coachName || 'your coach'}.`;
    
    if (nextSession.google_meet_link) {
      responseText += ` Meeting link: ${nextSession.google_meet_link}`;
    }

    if (sessions.length > 1) {
      responseText += ` You have ${sessions.length - 1} more session${sessions.length > 2 ? 's' : ''} scheduled after that.`;
    }

    return {
      response: responseText,
      intent: 'SCHEDULE',
      source: 'sql',
    };

  } else if (userRole === 'coach') {
    const coachId = await getCoachId(userEmail);

    if (/today/i.test(message)) {
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select(`
          scheduled_time,
          session_type,
          google_meet_link,
          child:children(child_name)
        `)
        .eq('coach_id', coachId)
        .eq('scheduled_date', today)
        .eq('status', 'scheduled')
        .order('scheduled_time', { ascending: true });

      if (!sessions || sessions.length === 0) {
        return {
          response: "You don't have any sessions scheduled for today.",
          intent: 'SCHEDULE',
          source: 'sql',
        };
      }

      const sessionList = sessions.map(s => {
        const childData = s.child as { child_name: string } | { child_name: string }[] | null;
        const childName = Array.isArray(childData) ? childData[0]?.child_name : childData?.child_name;
        return `${formatTime(s.scheduled_time)} - ${childName || 'Student'} (${s.session_type})`;
      }).join(', ');

      return {
        response: `Today you have ${sessions.length} session${sessions.length > 1 ? 's' : ''}: ${sessionList}`,
        intent: 'SCHEDULE',
        source: 'sql',
      };
    }

    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        scheduled_date,
        scheduled_time,
        session_type,
        google_meet_link,
        child:children(child_name)
      `)
      .eq('coach_id', coachId)
      .gte('scheduled_date', today)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(5);

    if (!sessions || sessions.length === 0) {
      return {
        response: "You don't have any upcoming sessions scheduled.",
        intent: 'SCHEDULE',
        source: 'sql',
      };
    }

    const next = sessions[0];
    const sessionDate = new Date(next.scheduled_date).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });

    const childData = next.child as { child_name: string } | { child_name: string }[] | null;
    const childName = Array.isArray(childData) ? childData[0]?.child_name : childData?.child_name;

    return {
      response: `Your next session is with ${childName || 'a student'} on ${sessionDate} at ${formatTime(next.scheduled_time)}. You have ${sessions.length} total upcoming session${sessions.length > 1 ? 's' : ''}.`,
      intent: 'SCHEDULE',
      source: 'sql',
    };
  }

  return {
    response: "I couldn't find schedule information. Please try again.",
    intent: 'SCHEDULE',
    source: 'sql',
  };
}

function handleOffLimits(userRole: UserRole): ChatResponse {
  let responseText: string;

  if (userRole === 'coach') {
    responseText = OFF_LIMITS_RESPONSES.earnings_coach;
  } else if (userRole === 'admin') {
    responseText = OFF_LIMITS_RESPONSES.earnings_admin;
  } else {
    responseText = OFF_LIMITS_RESPONSES.unknown;
  }

  return {
    response: responseText,
    intent: 'OFF_LIMITS',
    source: 'redirect',
  };
}

async function getCoachId(email: string): Promise<string | null> {
  const { data } = await supabase
    .from('coaches')
    .select('id')
    .eq('email', email)
    .single();
  return data?.id || null;
}

async function getCoachForParent(parentEmail: string): Promise<Coach | null> {
  const { data: child } = await supabase
    .from('children')
    .select('assigned_coach_id')
    .eq('parent_email', parentEmail)
    .eq('status', 'enrolled')
    .limit(1)
    .single();

  if (!child?.assigned_coach_id) return null;

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name, email, phone')
    .eq('id', child.assigned_coach_id)
    .single();

  return coach as Coach | null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}