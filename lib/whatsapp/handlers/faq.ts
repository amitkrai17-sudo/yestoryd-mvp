// ============================================================
// Handler: FAQ — Knowledge-stuffed Gemini answers
// Uses rich knowledge base + Gemini 2.0 Flash Lite for
// intelligent, contextual responses to parent questions.
// Pricing fallback preserved as last resort.
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { getLeadBotUrls } from '@/lib/whatsapp/urls';
import { getLeadBotKnowledge } from '@/lib/whatsapp/knowledge-base';
import {
  getPricingConfig,
  getSessionRangeForTier,
  getDurationRange,
  getPerWeekPrice,
} from '@/lib/config/pricing-config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Gemini 2.0 Flash Lite — cheapest model for knowledge-grounded answers
const FLASH_LITE_MODEL = 'gemini-2.0-flash-lite';

// Dynamic pricing fallback — loads from DB via shared config loader
async function buildPricingFallback(): Promise<string> {
  const config = await getPricingConfig();
  const perWeek = getPerWeekPrice(config);
  const starter = config.tiers.find(t => t.slug === 'starter');
  const continuation = config.tiers.find(t => t.slug === 'continuation');
  const full = config.tiers.find(t => t.slug === 'full');
  const starterRange = getSessionRangeForTier(config, 'starter');
  const contRange = getSessionRangeForTier(config, 'continuation');
  const fullRange = getSessionRangeForTier(config, 'full');
  const durRange = getDurationRange(config);

  const fmtRange = (r: { min: number; max: number }) =>
    r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;

  return (
    `Our personalized 1:1 coaching starts at ₹${perWeek}/week.\n\n` +
    `📦 Starter: ₹${(starter?.discountedPrice ?? 3999).toLocaleString('en-IN')} (${fmtRange(starterRange)} sessions)\n` +
    `📦 Continuation: ₹${(continuation?.discountedPrice ?? 7499).toLocaleString('en-IN')} (${fmtRange(contRange)} sessions)\n` +
    `📦 Full Program: ₹${(full?.discountedPrice ?? 9999).toLocaleString('en-IN')} (${fmtRange(fullRange)} sessions)\n\n` +
    `Each session is ${fmtRange(durRange)} minutes with a certified reading coach on Google Meet.\n\n` +
    `Would you like to book a free discovery call to learn more?`
  );
}

export interface FaqResult {
  response: string;
  settingsUsed: string[];
}

export async function handleFaq(
  phone: string,
  question: string,
  collectedData: Record<string, unknown>
): Promise<FaqResult> {
  const childName = (collectedData.child_name as string) || '';
  const isPricingQuestion = /pric|cost|fee|kitna|kharcha|paisa|how\s*much|₹|rs/i.test(question);

  console.log(JSON.stringify({
    event: 'wa_faq_handler_start',
    question: question.slice(0, 80),
    isPricingQuestion,
  }));

  // 1. Load rich knowledge base (cached 10 min)
  let knowledge: string;
  try {
    knowledge = await getLeadBotKnowledge();
  } catch (err) {
    console.error('[WA-LeadBot] Knowledge base load failed:', err);
    knowledge = '';
  }

  // 2. Build knowledge-stuffed Gemini prompt
  const personalization = childName
    ? `The parent's child is named ${childName}. Use the child's name to personalize your response.`
    : '';

  let responseText = '';
  try {
    const model = genAI.getGenerativeModel({
      model: FLASH_LITE_MODEL,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
      },
    });

    const prompt = `You are Yestoryd's WhatsApp assistant. Answer the parent's question using ONLY the knowledge below. Be warm, concise (3-5 sentences max), and always guide toward the next step (assessment or discovery call).

KNOWLEDGE:
${knowledge}

${personalization}

RULES:
- Never say "I don't know" or "let me connect you with someone"
- If the question is about something not in the knowledge, relate it back to what Yestoryd DOES offer
- Keep responses under 5 sentences
- End with a soft CTA (suggest the free assessment or a discovery call)
- Never use emojis excessively — max 1 per message
- Respond in English by default, match the parent's tone (formal/casual)
- If parent writes in Hindi, respond in simple Hindi
- If parent writes in Hinglish, respond in Hinglish
- Use ₹ for currency, not Rs
- Always give a COMPLETE answer — never cut off mid-sentence

Parent's question: "${question}"`;

    const result = await model.generateContent(prompt);
    responseText = result.response.text().trim();

    console.log(JSON.stringify({
      event: 'wa_faq_gemini_response',
      model: FLASH_LITE_MODEL,
      responseLength: responseText.length,
      responsePreview: responseText.slice(0, 150),
    }));
  } catch (error) {
    console.error('[WA-LeadBot] FAQ Gemini error:', error);
    responseText = '';
  }

  // 3. Fallback logic (last resort)
  //    - Pricing questions: if response <150 chars, use static pricing fallback
  //    - Other questions: if response <80 chars, use generic with assessment link
  const needsFallback =
    !responseText ||
    (isPricingQuestion && responseText.length < 150) ||
    (!isPricingQuestion && responseText.length < 80);

  if (needsFallback) {
    console.log(JSON.stringify({
      event: 'wa_faq_fallback_triggered',
      reason: !responseText ? 'empty_response' : isPricingQuestion ? 'pricing_too_short' : 'too_short',
      originalLength: responseText?.length || 0,
      threshold: isPricingQuestion ? 150 : 80,
      isPricingQuestion,
    }));

    if (isPricingQuestion) {
      responseText = await buildPricingFallback();
    } else {
      const { assessmentUrl } = await getLeadBotUrls();
      responseText =
        `We'd love to help! At Yestoryd, we provide personalized 1:1 reading coaching for children aged 4-12 through live sessions on Google Meet.\n\n` +
        `Try our free 3-min reading assessment to see where your child stands:\n${assessmentUrl}`;
    }
  }

  await sendText(phone, responseText);

  return {
    response: responseText,
    settingsUsed: ['knowledge_base'],
  };
}
