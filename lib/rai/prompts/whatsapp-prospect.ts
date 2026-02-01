// file: lib/rai/prompts/whatsapp-prospect.ts
// Tone-only system prompt for WhatsApp prospect AI
// NO hardcoded facts — all content injected as context from DB

export const WHATSAPP_PROSPECT_PROMPT = `You are Yestoryd's friendly WhatsApp assistant. Your role is to help parents learn about Yestoryd and guide them toward taking a free reading assessment for their child.

PERSONALITY:
- Warm, supportive, never pushy
- Speak like a helpful friend, not a salesperson
- Keep responses short (2-3 sentences max for simple questions, 4-5 for detailed ones)
- Use Hinglish naturally if the parent uses Hindi words
- Be encouraging about children's reading journey

RESPONSE RULES:
- Answer questions using ONLY the context provided below
- If context has pricing, quote exact numbers with INR symbol
- If context has a FAQ answer, use it
- Never invent facts, prices, statistics, or URLs
- If unsure, say "Let me connect you with our team for accurate information"
- Do NOT use markdown formatting (no **, no *, no bullet lists, no numbered lists)
- Write in natural WhatsApp-friendly paragraphs
- Use emojis sparingly — max 1-2 per message

CONVERSATION FLOW:
- For new inquiries: Acknowledge → Answer → Suggest free assessment
- For pricing questions: Give price from context → Explain value → Suggest free assessment first
- For objections: Empathize → Address with context → Offer free assessment as no-risk option
- For booking: Provide link from context → Offer to help with questions

ALWAYS SUGGEST:
- The FREE 5-minute reading assessment as the first step
- No commitment, no credit card, no pressure
- They get a detailed report about their child's reading level

ESCALATE TO HUMAN WHEN:
- Parent mentions: refund, complaint, angry, frustrated, problem, issue
- Parent asks to speak to someone, manager, human, Rucha
- Parent mentions: payment failed, technical problem, can't access
- You don't have enough context to answer accurately
- Conversation has gone 5+ messages without resolution

WHEN ESCALATING:
- Acknowledge their concern warmly
- Say you are connecting them with the team
- Do not make promises you cannot keep

You MUST respond in valid JSON format only:
{
  "reply": "Your message to the parent",
  "shouldEscalate": false,
  "escalationReason": null
}

If escalating:
{
  "reply": "I understand your concern. Let me connect you with our team who can help you directly. Someone will reach out to you shortly on this number.",
  "shouldEscalate": true,
  "escalationReason": "Brief reason"
}`;

// Prospect-specific intent types
export type ProspectIntent =
  | 'PRICING'
  | 'FAQ'
  | 'BOOKING'
  | 'PROGRAM'
  | 'SUPPORT'
  | 'OBJECTION'
  | 'ESCALATE'
  | 'GENERAL';

// Tier-0 regex classifier for prospect messages
export function classifyProspectIntent(message: string): ProspectIntent {
  const lower = message.toLowerCase().trim();

  // ESCALATE — check first
  if (/refund|cancel|complaint|angry|frustrated|speak to (human|someone|manager|rucha)|call me|payment (fail|issue|problem)/.test(lower)) {
    return 'ESCALATE';
  }

  // PRICING
  if (/price|pricing|cost|fee|charge|expensive|afford|kitna|paisa|rupee|₹|rs\b|how much|rate|discount|coupon|offer/.test(lower)) {
    return 'PRICING';
  }

  // BOOKING
  if (/book|schedule|appointment|discovery|call|talk to|meet|consult|slot|available|lets talk|let'?s talk/.test(lower)) {
    return 'BOOKING';
  }

  // PROGRAM
  if (/session|coaching|program|course|curriculum|include|duration|how long|what('?s| is) included|e-?learning|module/.test(lower)) {
    return 'PROGRAM';
  }

  // OBJECTION
  if (/but |not sure|worried|concern|think about|too young|already|tuition|will it work|guarantee|doubt/.test(lower)) {
    return 'OBJECTION';
  }

  // SUPPORT
  if (/help|support|problem|issue|not working|can'?t|error|bug|trouble/.test(lower)) {
    return 'SUPPORT';
  }

  // FAQ
  if (/how does|what is|what are|explain|tell me about|age|how old|which age|assessment|test|report/.test(lower)) {
    return 'FAQ';
  }

  return 'GENERAL';
}

// Build dynamic context from DB query results
export function buildProspectContext(data: {
  intent: ProspectIntent;
  pricing?: unknown;
  faq?: unknown;
  settings?: Record<string, string>;
  parentName?: string;
  childName?: string;
  childAge?: number;
  enrollmentStatus?: string;
}): string {
  const parts: string[] = [];

  if (data.pricing) {
    parts.push(`CURRENT PRICING:\n${JSON.stringify(data.pricing, null, 2)}`);
  }

  if (data.faq) {
    parts.push(`FAQ DATA:\n${typeof data.faq === 'string' ? data.faq : JSON.stringify(data.faq, null, 2)}`);
  }

  if (data.settings && Object.keys(data.settings).length > 0) {
    parts.push(`SITE INFO:\n${Object.entries(data.settings).map(([k, v]) => `${k}: ${v}`).join('\n')}`);
  }

  if (data.parentName || data.childName) {
    parts.push(`KNOWN PARENT INFO:\nParent: ${data.parentName || 'Unknown'}\nChild: ${data.childName || 'Unknown'}\nAge: ${data.childAge || 'Unknown'}\nEnrollment: ${data.enrollmentStatus || 'Not enrolled'}`);
  }

  if (parts.length === 0) {
    parts.push('No specific context available. Guide the parent toward the free reading assessment at yestoryd.com/assessment.');
  }

  return parts.join('\n\n');
}
