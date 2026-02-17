// ============================================================
// FILE: app/api/chat/route.ts
// ============================================================
// HARDENED VERSION - rAI v2.0 Intelligent Chat API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Session-based authentication (NOT client-provided)
// - Role verification from session (NOT trusted from client)
// - Rate limiting per user (prevent AI cost abuse)
// - Request tracing
// - Usage tracking for cost monitoring
// - Lazy initialization
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { chatRateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getOptionalAuth, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
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
  searchContentUnits,
  formatContentUnitsForContext,
} from '@/lib/rai/hybrid-search';
import {
  getSystemPrompt,
  OPERATIONAL_RESPONSES,
  OFF_LIMITS_RESPONSES,
} from '@/lib/rai/prompts';
import { handleAdminInsightQuery } from '@/lib/rai/admin-insights';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const getSupabase = createAdminClient;

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  admin: { max: 100, windowMs: 60 * 1000 },    // 100/min for admins
  coach: { max: 50, windowMs: 60 * 1000 },     // 50/min for coaches
  parent: { max: 20, windowMs: 60 * 1000 },    // 20/min for parents
  default: { max: 5, windowMs: 60 * 1000 },    // 5/min fallback
};

function checkRateLimit(
  identifier: string,
  role: string
): { success: boolean; remaining: number } {
  const now = Date.now();
  const limits = RATE_LIMITS[role] || RATE_LIMITS.default;
  const key = `chat_${identifier}`;

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + limits.windowMs });
    return { success: true, remaining: limits.max - 1 };
  }

  if (record.count >= limits.max) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limits.max - record.count };
}

// --- USAGE TRACKING ---
async function trackAIUsage(
  requestId: string,
  userEmail: string,
  userRole: string,
  intent: string,
  source: string,
  latencyMs: number,
  tokensEstimate?: number
) {
  try {
    const supabase = getSupabase();
    await supabase.from('activity_log').insert({
      user_email: userEmail,
      user_type: 'admin',
      action: 'rai_chat',
      metadata: {
        request_id: requestId,
        intent,
        source,
        user_role: userRole,
        latency_ms: latencyMs,
        tokens_estimate: tokensEstimate,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to track AI usage:', err);
  }
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

    // ??? RATE LIMITING - Protect Gemini API from abuse (IP-based)
    const clientIP = getClientIP(request);
    const { success, limit, remaining, reset } = await chatRateLimiter.limit(clientIP);
    
    if (!success) {
      console.log(JSON.stringify({ requestId, event: 'rate_limit_ip', ip: clientIP }));
      return rateLimitResponse(limit, remaining, reset);
    }

  try {
    // 1. AUTHENTICATE - Try NextAuth first, then Supabase auth fallback
    const session = await getOptionalAuth();
    const supabase = getSupabase();
    
    let userEmail: string;
    let userRole: UserRole;
    let coachId: string | undefined;
    let parentId: string | undefined;

    if (session?.email) {
      // NextAuth session (admin)
      userEmail = session.email!;
      const sessionRole = session.role as string;
      coachId = session.coachId as string | undefined;
      parentId = session.parentId as string | undefined;

      if (sessionRole === 'admin') {
        userRole = 'admin';
      } else if (sessionRole === 'coach') {
        userRole = 'coach';
      } else if (sessionRole === 'parent') {
        userRole = 'parent';
      } else {
        return NextResponse.json({ error: 'Invalid user role' }, { status: 403 });
      }
    } else {
      // Supabase auth fallback (coach/parent dashboards)
      const body = await request.clone().json();
      const requestEmail = body.userEmail;
      const requestRole = body.userRole;

      if (!requestEmail || !requestRole) {
        console.log(JSON.stringify({ requestId, event: 'auth_failed', error: 'No session or credentials' }));
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Verify email exists in appropriate table
      if (requestRole === 'coach') {
        const { data: coach } = await supabase.from('coaches').select('id').eq('email', requestEmail).single();
        if (!coach) {
          return NextResponse.json({ error: 'Coach not found' }, { status: 401 });
        }
        coachId = coach.id;
        userRole = 'coach';
      } else if (requestRole === 'parent') {
        const { data: parent } = await supabase.from('parents').select('id').eq('email', requestEmail).single();
        if (!parent) {
          const { data: child } = await supabase.from('children').select('id').eq('parent_email', requestEmail).limit(1).single();
          if (!child) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 401 });
          }
        } else {
          parentId = parent.id;
        }
        userRole = 'parent';
      } else {
        return NextResponse.json({ error: 'Invalid role for fallback auth' }, { status: 403 });
      }
      
      userEmail = requestEmail;
      console.log(JSON.stringify({ requestId, event: 'supabase_auth_fallback', email: userEmail, role: userRole }));
    }

    // 3. RATE LIMITING
    const rateLimit = checkRateLimit(userEmail, userRole);

    if (!rateLimit.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        userEmail,
        userRole,
      }));

      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          },
        }
      );
    }

    // 4. PARSE BODY (only message and childId from client)
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { message, childId, chatHistory } = body;

    // Debug: Log received childId
    console.log('=== CHAT API REQUEST ===');
    console.log('Received childId:', childId);
    console.log('User role:', userRole);
    console.log('Coach ID from session:', coachId);

    // 5. VALIDATE MESSAGE
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // 6. VALIDATE CHAT HISTORY (with token budget)
    const MAX_HISTORY_CHARS = 6000; // ~1500 tokens
    let validChatHistory: Array<{ role: string; content: string }> = [];
    
    if (Array.isArray(chatHistory)) {
      let totalChars = 0;
      // Process from newest to oldest, keep within budget
      const reversedHistory = [...chatHistory]
        .filter((msg): msg is { role: string; content: string } =>
          typeof msg === 'object' &&
          typeof msg.role === 'string' &&
          typeof msg.content === 'string'
        )
        .slice(-6)
        .reverse();
      
      for (const msg of reversedHistory) {
        const msgChars = msg.content.length;
        if (totalChars + msgChars > MAX_HISTORY_CHARS) {
          break; // Stop adding older messages
        }
        validChatHistory.unshift(msg); // Add to front (oldest first)
        totalChars += msgChars;
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'chat_request',
      userEmail,
      userRole,
      messageLength: message.length,
      hasChildId: !!childId,
    }));

    // 7. CLASSIFY INTENT
    const { intent, tier0Match } = await classifyIntent(message, userRole);
    console.log(`?? Intent: ${intent} (Tier ${tier0Match ? '0' : '1'})`);

    // 8. ADMIN INSIGHT CHECK (fast path)
    if (userRole === 'admin') {
      const insightResponse = await handleAdminInsightQuery(message);
      if (insightResponse) {
        const latency = Date.now() - startTime;
        await trackAIUsage(requestId, userEmail, userRole, 'ADMIN_INSIGHT', 'cached_insight', latency);

        return NextResponse.json({
          response: insightResponse,
          intent: 'ADMIN_INSIGHT',
          source: 'cached_insight',
          requestId,
          debug: {
            tier0Match: false,
            latencyMs: latency,
          },
        }, {
          headers: {
            'X-Request-Id': requestId,
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          },
        });
      }
    }

    // 9. HANDLE INTENT
    let response: ChatResponse;
    switch (intent) {
      case 'LEARNING':
        response = await handleLearning(message, userRole, userEmail, childId, validChatHistory, coachId);
        break;

      case 'OPERATIONAL':
        response = await handleOperational(message, userRole, userEmail);
        break;

      case 'SCHEDULE':
        response = await handleSchedule(message, userRole, userEmail, coachId);
        break;

      case 'OFF_LIMITS':
        response = handleOffLimits(userRole);
        break;

      default:
        response = await handleLearning(message, userRole, userEmail, childId, validChatHistory, coachId);
    }

    response.intent = intent;
    const latency = Date.now() - startTime;
    response.debug = {
      ...response.debug,
      tier0Match,
      latencyMs: latency,
    };

    // 10. TRACK USAGE
    await trackAIUsage(requestId, userEmail, userRole, intent, response.source || 'unknown', latency);

    console.log(JSON.stringify({
      requestId,
      event: 'chat_complete',
      intent,
      source: response.source,
      latencyMs: latency,
    }));

    return NextResponse.json({
      ...response,
      requestId,
    }, {
      headers: {
        'X-Request-Id': requestId,
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });

  } catch (error: unknown) {
    const latency = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'chat_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: latency,
    }));

    return NextResponse.json(
      { error: 'Chat service temporarily unavailable', requestId },
      { status: 500 }
    );
  }
}

// ============================================================
// INTENT HANDLERS
// ============================================================

async function handleLearning(
  message: string,
  userRole: UserRole,
  userEmail: string,
  childId?: string,
  chatHistory?: Array<{ role: string; content: string }>,
  sessionCoachId?: string
): Promise<ChatResponse> {
  const supabase = getSupabase();

  let child: ChildWithCache | null = null;
  let coach: Coach | null = null;
  let children: { id: string; name: string }[] = [];

  if (userRole === 'parent') {
    const { data: parentChildren } = await supabase
      .from('children')
      .select('id, name, child_name, age, parent_email, coach_id, last_session_summary, last_session_date, last_session_focus, sessions_completed, total_sessions, latest_assessment_score')
      .eq('parent_email', userEmail)
      .in('status', ['enrolled', 'assessment_complete']);

    if (!parentChildren || parentChildren.length === 0) {
      return {
        response: "I don't see any enrolled children for your account. If you've recently enrolled, it may take a few minutes to update. For help, contact support at 918976287997.",
        intent: 'LEARNING',
        source: 'sql',
      };
    }

    children = parentChildren.map(c => ({ id: c.id, name: c.child_name || c.name || 'Child' }));

    if (parentChildren.length === 1) {
      child = parentChildren[0] as ChildWithCache;
    } else if (childId) {
      const found = parentChildren.find(c => c.id === childId);
      child = found ? (found as ChildWithCache) : null;
      if (!child) {
        return {
          response: `I see you have ${parentChildren.length} children enrolled: ${children.map(c => c.name).join(' and ')}. Which child are you asking about?`,
          intent: 'LEARNING',
          source: 'sql',
          needsChildSelection: true,
          children,
        };
      }
    } else {
      return {
        response: `I see you have ${parentChildren.length} children enrolled: ${children.map(c => c.name).join(' and ')}. Which child are you asking about?`,
        intent: 'LEARNING',
        source: 'sql',
        needsChildSelection: true,
        children,
      };
    }

    if (child?.coach_id) {
      const { data: coachData } = await supabase
        .from('coaches')
        .select('id, name, email, phone')
        .eq('id', child.coach_id)
        .single();
      coach = coachData as Coach | null;
    }
  } else if (userRole === 'coach') {
    console.log('=== COACH CHILD LOOKUP ===');
    console.log('childId provided:', childId);
    console.log('sessionCoachId:', sessionCoachId);

    if (childId) {
      // SECURITY: Verify coach has access via active enrollment (single source of truth)
      const hasAccess = await validateCoachChildAccess(supabase, sessionCoachId || '', childId);
      console.log('Coach has access:', hasAccess);

      if (!hasAccess) {
        console.log('Coach access denied:', { coachId: sessionCoachId, childId });
        return {
          response: "I can only provide information about students enrolled with you. Please select one of your students.",
          intent: 'LEARNING',
          source: 'redirect',
        };
      }

      const { data: childData } = await supabase
        .from('children')
        .select('id, name, child_name, age, parent_email, coach_id, last_session_summary, last_session_date, last_session_focus, sessions_completed, total_sessions, latest_assessment_score')
        .eq('id', childId)
        .single();

      console.log('Fetched child:', childData?.child_name || childData?.name);
      child = childData as ChildWithCache;
    } else {
      console.log('No childId provided - will return generic response');
    }
  }

  const childName = child?.child_name || child?.name || 'your child';

  // Cache check for recent session queries
  if (userRole === 'parent' && child && isRecentSessionQuery(message)) {
    const cache = await getSessionCache(child.id);

    if (cache.isFresh && cache.summary && cache.date) {
      console.log('?? Cache hit! Returning cached summary');
      return {
        response: formatCachedSummary(cache.summary, cache.date, childName),
        intent: 'LEARNING',
        source: 'cache',
        debug: { cacheHit: true, eventsRetrieved: 0 },
      };
    }
  }

  // Hybrid search for context
  console.log('=== HYBRID SEARCH PARAMS ===');
  console.log('Child set?', !!child);
  console.log('Child ID for search:', child?.id);
  console.log('Original childId from request:', childId);
  console.log('Child name:', childName);

  const searchResult = await hybridSearch({
    query: message,
    childId: child?.id,
    coachId: userRole === 'coach' ? sessionCoachId : null,
    userRole,
    limit: 15,
  });

  const eventsContext = formatEventsForContext(searchResult.events);

  // Content unit search — find relevant activities from content library
  let contentContext = '';
  try {
    const contentUnits = await searchContentUnits({
      query: message,
      childAge: child?.age || null,
      limit: 3,
      threshold: 0.3,
    });
    if (contentUnits.length > 0) {
      contentContext = '\n\n' + formatContentUnitsForContext(contentUnits);
    }
  } catch (err) {
    console.warn('Content unit search failed (non-blocking):', err);
  }

  const systemPrompt = getSystemPrompt(
    userRole,
    childName,
    eventsContext,
    coach ? { name: coach.name, phone: coach.phone || '918976287997', email: coach.email } : null
  );

  // Generate AI response
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const conversationContext = chatHistory?.slice(-6).map(msg =>
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n') || '';

  const fullSystemPrompt = contentContext
    ? `${systemPrompt}${contentContext}`
    : systemPrompt;

  const prompt = conversationContext
    ? `${fullSystemPrompt}\n\nConversation so far:\n${conversationContext}\n\nUser: ${message}`
    : `${fullSystemPrompt}\n\nUser: ${message}`;

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
  const supabase = getSupabase();
  const lowerMessage = message.toLowerCase();

  if (/what can you (do|help|answer|assist)|how can you help|what are you (for|able)|what.*your (purpose|capabilities)|^help$/i.test(lowerMessage)) {
    return {
      response: OPERATIONAL_RESPONSES.what_can_help,
      intent: 'OPERATIONAL',
      source: 'sql',
    };
  }

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

    if (!coachId) {
      return {
        response: "I couldn't find your coach profile. Please contact support.",
        intent: 'OPERATIONAL',
        source: 'sql',
      };
    }

    const { count } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
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
    response: OPERATIONAL_RESPONSES.out_of_scope,
    intent: 'OPERATIONAL',
    source: 'sql',
  };
}

async function handleSchedule(
  message: string,
  userRole: UserRole,
  userEmail: string,
  sessionCoachId?: string
): Promise<ChatResponse> {
  const supabase = getSupabase();
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
    const coachId = sessionCoachId || await getCoachId(userEmail);

    if (!coachId) {
      return {
        response: "I couldn't find your coach profile. Please contact support.",
        intent: 'OPERATIONAL',
        source: 'sql',
      };
    }

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

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validate coach has access to child via active enrollment
 * Uses enrollments.coach_id as single source of truth (NOT children.coach_id)
 */
async function validateCoachChildAccess(
  supabase: ReturnType<typeof getSupabase>,
  coachId: string,
  childId: string
): Promise<boolean> {
  if (!coachId || !childId) return false;

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('coach_id', coachId)
    .eq('child_id', childId)
    .eq('status', 'active')
    .maybeSingle();

  return !!enrollment;
}

async function getCoachId(email: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('coaches')
    .select('id')
    .eq('email', email)
    .single();
  return data?.id || null;
}

async function getCoachForParent(parentEmail: string): Promise<Coach | null> {
  const supabase = getSupabase();
  const { data: child } = await supabase
    .from('children')
    .select('coach_id')
    .eq('parent_email', parentEmail)
    .eq('status', 'enrolled')
    .limit(1)
    .single();

  if (!child?.coach_id) return null;

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name, email, phone')
    .eq('id', child.coach_id)
    .single();

  return coach as Coach | null;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

// ============================================================
// HEALTH CHECK
// ============================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'rAI Chat API v2.0 (Hardened)',
    features: ['authentication', 'rate_limiting', 'usage_tracking'],
    rateLimits: RATE_LIMITS,
    timestamp: new Date().toISOString(),
  });
}
