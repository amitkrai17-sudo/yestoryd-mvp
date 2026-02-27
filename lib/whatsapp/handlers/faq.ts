// ============================================================
// Handler: FAQ - Answer questions with verified site_settings data
// Anti-hallucination: Gemini only formats facts from DB
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { getSettings } from '@/lib/settings/getSettings';
import { getLeadBotUrls } from '@/lib/whatsapp/urls';

import { getGeminiModel } from '@/lib/gemini-config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Keys we fetch from site_settings for FAQ context
const FAQ_SETTING_KEYS = [
  'pricing_amount',
  'pricing_original_price',
  'pricing_discounted_price',
  'pricing_duration_months',
  'pricing_sessions_included',
  'pricing_currency',
  'pricing_subtitle',
  'coaching_duration_mins',
  'session_format',
  'program_age_range',
  'program_description',
  'refund_policy',
  'coach_info',
  'assessment_description',
  'hero_title',
  'hero_subtitle',
];

// Static fallback when Gemini fails or returns a stub
const STATIC_PRICING_FALLBACK =
  `Our personalized 1:1 coaching starts at ₹375/week.\n\n` +
  `📦 Starter: ₹1,499 (4 sessions)\n` +
  `📦 Continuation: ₹5,999 (9 sessions)\n` +
  `📦 Full Program: ₹6,999 (12 sessions)\n\n` +
  `Each session is 45 minutes with a certified reading coach on Google Meet.\n\n` +
  `Would you like to book a free discovery call to learn more?`;

export interface FaqResult {
  response: string;
  settingsUsed: string[];
}

export async function handleFaq(
  phone: string,
  question: string,
  collectedData: Record<string, unknown>
): Promise<FaqResult> {
  // 1. Fetch verified facts from site_settings
  const settings = await getSettings(FAQ_SETTING_KEYS);
  const availableFacts = Object.entries(settings)
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const childName = (collectedData.child_name as string) || '';
  const personalization = childName ? `The parent's child is named ${childName}.` : '';

  const isPricingQuestion = /pric|cost|fee|kitna|kharcha|paisa|how\s*much|₹|rs/i.test(question);

  console.log(JSON.stringify({
    event: 'wa_faq_handler_start',
    question: question.slice(0, 80),
    isPricingQuestion,
    settingsFound: Object.keys(settings).filter(k => settings[k] && settings[k].trim().length > 0).length,
    availableFactsLength: availableFacts.length,
  }));

  // 2. Generate natural answer with Gemini (strict anti-hallucination)
  let responseText: string;
  try {
    const model = genAI.getGenerativeModel({
      model: getGeminiModel('content_generation'),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    });

    const prompt = `You are a friendly WhatsApp assistant for Yestoryd, a children's reading program in India.
Answer the parent's question using ONLY the facts below. If the facts don't contain the answer, say "I'll connect you with our team for details on that."

VERIFIED FACTS:
${availableFacts || 'No specific details available in database.'}

${personalization}

RULES:
- 3-5 short sentences (WhatsApp-friendly)
- Warm, encouraging tone
- If the parent writes in Hindi/Hinglish, respond similarly
- NEVER invent pricing, durations, or program details not in the facts
- End with a soft CTA: either take the free assessment or book a call
- Use ₹ for currency, not Rs
- Always give a COMPLETE answer — never cut off mid-sentence

Parent's question: "${question}"`;

    const result = await model.generateContent(prompt);
    responseText = result.response.text().trim();

    console.log(JSON.stringify({
      event: 'wa_faq_gemini_response',
      responseLength: responseText.length,
      responsePreview: responseText.slice(0, 100),
    }));
  } catch (error) {
    console.error('[WA-LeadBot] FAQ Gemini error:', error);
    responseText = '';
  }

  // 3. Fallback: if Gemini returned a stub (<30 chars) or empty, use static response
  if (!responseText || responseText.length < 30) {
    console.log(JSON.stringify({
      event: 'wa_faq_fallback_triggered',
      reason: !responseText ? 'empty_response' : 'too_short',
      originalLength: responseText?.length || 0,
      isPricingQuestion,
    }));

    if (isPricingQuestion) {
      responseText = STATIC_PRICING_FALLBACK;
    } else {
      const { assessmentUrl } = await getLeadBotUrls();
      responseText =
        `Great question! Let me connect you with our team who can give you the best answer.\n\n` +
        `In the meantime, try our free 3-min reading assessment:\n${assessmentUrl}`;
    }
  }

  await sendText(phone, responseText);

  return {
    response: responseText,
    settingsUsed: Object.keys(settings).filter(k => settings[k]),
  };
}
