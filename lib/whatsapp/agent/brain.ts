// ============================================================
// Agent 2: Brain — Decision Engine
// Pre-decision shortcuts (zero cost) → Gemini for everything else
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AgentContext,
  AgentDecision,
  AgentAction,
  QualificationExtracted,
} from './types';
import { isValidAgentAction } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = 'gemini-2.5-flash-lite';

// ============================================================
// Main entry point
// ============================================================

export async function makeDecision(context: AgentContext): Promise<AgentDecision> {
  // --- Pre-decision shortcuts (zero Gemini cost) ---
  const shortcut = tryShortcut(context);
  if (shortcut) return shortcut;

  // --- Full Gemini decision ---
  return callGemini(context);
}

// ============================================================
// Pre-decision shortcuts
// ============================================================

function tryShortcut(ctx: AgentContext): AgentDecision | null {
  const { recentMessages, currentMessage, messageType } = ctx;

  // 1. First message in conversation → GREETING
  // recentMessages includes the current inbound message, so check if this
  // is the only one (no prior bot/user messages in history)
  const priorMessages = recentMessages.filter(m => m.direction === 'outbound');
  if (priorMessages.length === 0) {
    return buildGreetingDecision(ctx);
  }

  // 2. Button clicks → direct mapping
  if (messageType === 'interactive' || messageType === 'button') {
    const buttonDecision = mapButtonClick(ctx, currentMessage);
    if (buttonDecision) return buttonDecision;
  }

  // 3. Affirmative reply in offer states
  const state = ctx.lifecycle?.current_state || ctx.conversation.current_state;
  const affirmatives = /^(yes|yeah|yep|ok|okay|sure|book|interested|haan|ha|ji|call karo|book karo|theek hai)$/i;
  if (
    affirmatives.test(currentMessage.trim()) &&
    (state === 'assessed' || state === 'qualified' ||
     ctx.conversation.current_state === 'ASSESSMENT_OFFERED' ||
     ctx.conversation.current_state === 'DISCOVERY_OFFERED')
  ) {
    return {
      action: 'OFFER_SLOTS',
      responseMessage: '',  // Will be populated by the handler in process route
      responseType: 'buttons',
      stateTransition: 'slot_offered',
      confidence: 0.95,
      reasoning: 'Affirmative reply in offer state — offer slots',
      escalate: false,
      qualificationExtracted: {},
      scheduleFollowup: null,
    };
  }

  return null;
}

function buildGreetingDecision(ctx: AgentContext): AgentDecision {
  const contactName = ctx.waLead.parent_name
    || (ctx.conversation as any).collected_data?.contact_name
    || '';
  const greeting = contactName
    ? `Hi ${contactName}! Welcome to Yestoryd 👋`
    : `Hi there! Welcome to Yestoryd 👋`;

  const body =
    `${greeting}\n\n` +
    `We help children aged 4-12 become confident readers through personalized 1:1 coaching.\n\n` +
    `How can I help you today?`;

  return {
    action: 'GREETING',
    responseMessage: body,
    responseType: 'buttons',
    buttons: [
      { id: 'btn_assessment', title: '📖 Free Assessment' },
      { id: 'btn_book_call', title: '📞 Book a Call' },
      { id: 'btn_more_questions', title: '❓ Ask a Question' },
    ],
    stateTransition: 'engaging',
    confidence: 1.0,
    reasoning: 'First message — send welcome greeting with options',
    escalate: false,
    qualificationExtracted: {},
    scheduleFollowup: null,
  };
}

function mapButtonClick(ctx: AgentContext, message: string): AgentDecision | null {
  const buttonId = message.toLowerCase().trim();

  switch (buttonId) {
    case 'btn_assessment':
      return {
        action: 'SEND_ASSESSMENT',
        responseMessage: '', // Populated by handler
        responseType: 'buttons',
        stateTransition: 'assessed',
        confidence: 1.0,
        reasoning: 'Button click: assessment',
        escalate: false,
        qualificationExtracted: {},
        scheduleFollowup: null,
      };

    case 'btn_book_call':
      return {
        action: 'BOOK_DISCOVERY',
        responseMessage: '', // Populated by handler
        responseType: 'buttons',
        stateTransition: 'booked',
        confidence: 1.0,
        reasoning: 'Button click: book call',
        escalate: false,
        qualificationExtracted: {},
        scheduleFollowup: null,
      };

    case 'btn_pricing':
      return {
        action: 'SHARE_PRICING',
        responseMessage: '', // Populated by handler
        responseType: 'text',
        stateTransition: null,
        confidence: 1.0,
        reasoning: 'Button click: pricing',
        escalate: false,
        qualificationExtracted: {},
        scheduleFollowup: null,
      };

    case 'btn_human':
    case 'btn_talk_to_human':
      return {
        action: 'ESCALATE_HOT',
        responseMessage: '', // Populated by handler
        responseType: 'text',
        stateTransition: 'escalated',
        confidence: 1.0,
        reasoning: 'Button click: request human',
        escalate: true,
        escalationReason: 'Parent requested human agent',
        qualificationExtracted: {},
        scheduleFollowup: null,
      };

    case 'btn_more_questions':
      // Don't shortcut — let Gemini handle the question that follows
      return null;

    default:
      return null;
  }
}

// ============================================================
// Gemini Decision Engine
// ============================================================

async function callGemini(ctx: AgentContext): Promise<AgentDecision> {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    });

    const systemPrompt = buildSystemPrompt(ctx);
    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text().trim();

    return parseGeminiResponse(responseText);
  } catch (error) {
    console.error(JSON.stringify({
      event: 'agent2_brain_gemini_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    return buildFallbackDecision(ctx);
  }
}

function buildSystemPrompt(ctx: AgentContext): string {
  const { waLead, conversation, recentMessages, lifecycle, assessmentData, currentMessage } = ctx;
  const collectedData = (conversation as any).collected_data || {};

  // Format conversation history
  const history = [...recentMessages]
    .reverse()
    .map(m => {
      const role = m.direction === 'inbound' ? 'Parent' : 'Bot';
      const time = new Date(m.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      return `[${time}] ${role}: ${m.content}`;
    })
    .join('\n');

  return `You are the Lead Response Agent for Yestoryd, a children's reading intelligence platform for ages 4-12 in India. Your job is to convert leads into discovery call bookings through intelligent WhatsApp conversation.

## Your Personality
- Warm, knowledgeable, parent-friendly
- You understand Indian parents' concerns about reading and education
- You speak naturally in English (with Hindi words where appropriate)
- You're helpful but never pushy — you guide, not sell
- You acknowledge the parent's specific concern before offering solutions

## Current Lead Context
- Lead State: ${lifecycle?.current_state || 'new'}
- Lead Score: ${waLead.lead_score}/100
- Child Name: ${collectedData.child_name || waLead.child_name || 'unknown'}
- Child Age: ${collectedData.child_age || waLead.child_age || 'unknown'}
- Assessment Done: ${assessmentData ? 'Yes' : 'No'}
- Assessment Score: ${assessmentData?.latest_assessment_score ?? 'N/A'}
- Parent Concerns: ${collectedData.reading_concerns || waLead.reading_concerns || 'unknown'}
- Messages Exchanged: ${recentMessages.length}
- Conversation State: ${conversation.current_state}

## Conversation History (last 10 messages)
${history || '(no prior messages)'}

## Latest Message
"${currentMessage}"

## Decision Framework

If state is 'new' or 'engaging' (early conversation):
- If we don't know child age → ask warmly (ONE question only)
- If we know age but not concern → ask about reading concern
- After age + concern known → suggest free assessment
- Action: RESPOND_QUALIFY

If state is 'qualifying' (collecting info):
- If missing child_age or reading_concerns → ask for the missing piece
- If both known → enthusiastically recommend assessment
- Action: RESPOND_QUALIFY or SEND_ASSESSMENT

If state is 'assessed' (assessment done):
- Reference specific assessment findings
- Connect findings to how coaching helps
- Proactively offer discovery call booking
- Action: OFFER_DISCOVERY or OFFER_SLOTS

If parent asks about pricing:
- Frame as investment: "Starting at ₹375/week for personalized 1:1 coaching"
- Mention free discovery call first — no commitment
- Never dump raw pricing, always connect to value
- Action: SHARE_PRICING then OFFER_DISCOVERY

If parent shows hesitation:
- "Too expensive" → "₹375/week — less than most tuition classes, but 1:1 personalized"
- "Need to think" → "Totally understand! The discovery call is free and no commitment"
- "My child is too young/old" → "We work with ages 4-12 with age-appropriate methods"
- "Is it online?" → "Yes, 1:1 on Google Meet, 45-minute sessions"
- Complex objection → ESCALATE_OBJECTION

If parent wants to cancel or reschedule:
- Acknowledge warmly — never make them feel bad about cancelling
- Action: RESCHEDULE
- This applies when they mention: cancel, reschedule, change time, can't make it, different time

Escalation triggers (ALWAYS escalate):
- Parent mentions learning disability, dyslexia, or special needs
- Lead asks for school/bulk pricing
- Lead is a coach asking about partnership
- Conversation becomes confrontational
- Lead explicitly asks to speak to a human
- You are unsure how to respond

## Response Rules
- Keep responses under 150 words (WhatsApp attention span)
- Use line breaks for readability (\\n between paragraphs)
- End with ONE clear CTA (question or next step)
- Never send more than 1 link per message
- Use emojis sparingly (max 2 per message)
- If parent writes in Hindi, respond in Hindi. If English, respond in English. If Hinglish, respond in Hinglish.

## Valid Actions
GREETING, FAQ, RESPOND_QUALIFY, SEND_ASSESSMENT, OFFER_DISCOVERY, OFFER_SLOTS, BOOK_DISCOVERY, RESCHEDULE, SHARE_PRICING, SEND_TESTIMONIAL, ENTER_NURTURE, ESCALATE_HOT, ESCALATE_OBJECTION, CLOSE_COLD

Respond ONLY with valid JSON (no markdown, no backticks):
{"action":"<AgentAction>","response_message":"<WhatsApp message to send>","state_transition":"<new lifecycle state or null>","confidence":0.0,"reasoning":"<1-line explanation>","escalate":false,"escalation_reason":null,"qualification_extracted":{"child_name":null,"child_age":null,"parent_concerns":null,"urgency_signal":"medium","budget_signal":"unknown"},"schedule_followup":null}`;
}

// ============================================================
// Response parsing
// ============================================================

interface GeminiRawResponse {
  action: string;
  response_message: string;
  state_transition: string | null;
  confidence: number;
  reasoning: string;
  escalate: boolean;
  escalation_reason?: string | null;
  qualification_extracted?: {
    child_name?: string | null;
    child_age?: number | null;
    parent_concerns?: string[] | null;
    urgency_signal?: string | null;
    budget_signal?: string | null;
  };
  schedule_followup?: {
    action: string;
    delay_hours: number;
  } | null;
}

function parseGeminiResponse(responseText: string): AgentDecision {
  let parsed: GeminiRawResponse;

  // Try direct parse
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Strip markdown fences and retry
    const stripped = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      console.error(JSON.stringify({
        event: 'agent2_brain_parse_error',
        responseText: responseText.slice(0, 200),
      }));
      return buildGenericFallback();
    }
  }

  // Validate action
  const action: AgentAction = isValidAgentAction(parsed.action)
    ? parsed.action
    : 'FAQ';

  // Clamp confidence
  let confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.5;

  // Force escalation on low confidence
  let escalate = !!parsed.escalate;
  let escalationReason = parsed.escalation_reason || undefined;
  if (confidence < 0.3) {
    escalate = true;
    escalationReason = escalationReason || 'low_confidence';
  }

  // Build qualification extracted
  const qe = parsed.qualification_extracted || {};
  const qualificationExtracted: QualificationExtracted = {};
  if (qe.child_name) qualificationExtracted.child_name = qe.child_name;
  if (typeof qe.child_age === 'number') qualificationExtracted.child_age = qe.child_age;
  if (Array.isArray(qe.parent_concerns) && qe.parent_concerns.length > 0) {
    qualificationExtracted.parent_concerns = qe.parent_concerns;
  }
  if (qe.urgency_signal && ['high', 'medium', 'low'].includes(qe.urgency_signal)) {
    qualificationExtracted.urgency_signal = qe.urgency_signal as 'high' | 'medium' | 'low';
  }
  if (qe.budget_signal && ['ready_to_pay', 'value_focused', 'price_sensitive', 'unknown'].includes(qe.budget_signal)) {
    qualificationExtracted.budget_signal = qe.budget_signal as QualificationExtracted['budget_signal'];
  }

  // Determine response type from action
  const responseType = getResponseType(action);

  // Build followup schedule
  const scheduleFollowup = parsed.schedule_followup
    ? { action: parsed.schedule_followup.action, delayHours: parsed.schedule_followup.delay_hours }
    : null;

  return {
    action,
    responseMessage: parsed.response_message || '',
    responseType,
    stateTransition: parsed.state_transition || null,
    confidence,
    reasoning: parsed.reasoning || 'Gemini decision',
    escalate,
    escalationReason,
    qualificationExtracted,
    scheduleFollowup,
  };
}

function getResponseType(action: AgentAction): 'text' | 'buttons' | 'list' {
  switch (action) {
    case 'GREETING':
    case 'SEND_ASSESSMENT':
    case 'OFFER_DISCOVERY':
    case 'OFFER_SLOTS':
    case 'BOOK_DISCOVERY':
      return 'buttons';
    case 'RESCHEDULE':
      return 'list';
    default:
      return 'text';
  }
}

// ============================================================
// Fallback decisions
// ============================================================

function buildFallbackDecision(ctx: AgentContext): AgentDecision {
  // Use context to build a sensible fallback
  const collectedData = (ctx.conversation as any).collected_data || {};
  const hasAge = !!collectedData.child_age || !!ctx.waLead.child_age;
  const hasConcerns = !!collectedData.reading_concerns || !!ctx.waLead.reading_concerns;

  if (!hasAge) {
    return {
      action: 'RESPOND_QUALIFY',
      responseMessage: `Thanks for reaching out! I'd love to help.\n\nCould you tell me how old your child is? We work with children aged 4-12.`,
      responseType: 'text',
      stateTransition: 'qualifying',
      confidence: 0.6,
      reasoning: 'Gemini failed — fallback to qualification (missing age)',
      escalate: false,
      qualificationExtracted: {},
      scheduleFollowup: null,
    };
  }

  if (!hasConcerns) {
    const childName = collectedData.child_name || ctx.waLead.child_name || 'your child';
    return {
      action: 'RESPOND_QUALIFY',
      responseMessage: `Thanks! What reading challenges does ${childName} face? For example, difficulty with pronunciation, speed, or comprehension?`,
      responseType: 'text',
      stateTransition: 'qualifying',
      confidence: 0.6,
      reasoning: 'Gemini failed — fallback to qualification (missing concerns)',
      escalate: false,
      qualificationExtracted: {},
      scheduleFollowup: null,
    };
  }

  // All data collected — offer assessment
  return {
    action: 'SEND_ASSESSMENT',
    responseMessage: '', // Populated by handler
    responseType: 'buttons',
    stateTransition: 'assessed',
    confidence: 0.5,
    reasoning: 'Gemini failed — fallback to assessment offer',
    escalate: false,
    qualificationExtracted: {},
    scheduleFollowup: null,
  };
}

function buildGenericFallback(): AgentDecision {
  return {
    action: 'FAQ',
    responseMessage: `Thanks for your message! I'd be happy to help.\n\nWould you like to try our free 3-minute reading assessment, or shall I book a free call with our reading experts?`,
    responseType: 'buttons',
    buttons: [
      { id: 'btn_assessment', title: '📖 Free Assessment' },
      { id: 'btn_book_call', title: '📞 Book a Call' },
      { id: 'btn_more_questions', title: '❓ Ask a Question' },
    ],
    stateTransition: null,
    confidence: 0.3,
    reasoning: 'Gemini response unparseable — generic fallback',
    escalate: false,
    qualificationExtracted: {},
    scheduleFollowup: null,
  };
}
