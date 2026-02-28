// ============================================================
// Handler: FAQ - Answer questions with verified site_settings data
// Anti-hallucination: Gemini only formats facts from DB
// ============================================================
//
// Required site_settings keys (populate these in DB for FAQ to work):
//
//   PRICING:
//     pricing_amount          — e.g. "₹6,999"
//     pricing_original_price  — e.g. "₹9,999"
//     pricing_discounted_price — e.g. "₹6,999"
//     pricing_duration_months — e.g. "3"
//     pricing_sessions_included — e.g. "12"
//     pricing_currency        — e.g. "INR"
//     pricing_subtitle        — e.g. "Personalized 1:1 reading coaching"
//
//   PROGRAM:
//     coaching_duration_mins  — e.g. "45"
//     session_format          — e.g. "1:1 on Google Meet"
//     program_age_range       — e.g. "4-12 years"
//     program_description     — e.g. "AI-powered personalized reading program"
//
//   POLICIES:
//     refund_policy           — e.g. "Full refund within 7 days"
//
//   TEAM:
//     coach_info              — e.g. "Certified reading coaches with 5+ years experience"
//
//   CONTENT:
//     assessment_description  — e.g. "Free 3-minute AI reading assessment"
//     hero_title              — e.g. "Transform Your Child's Reading"
//     hero_subtitle           — e.g. "Personalized 1:1 coaching for ages 4-12"
//
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { getSettings } from '@/lib/settings/getSettings';
import { getLeadBotUrls } from '@/lib/whatsapp/urls';
import { getGeminiModel } from '@/lib/gemini-config';
import {
  getPricingConfig,
  getSessionRangeForTier,
  getDurationRange,
  getPerWeekPrice,
} from '@/lib/config/pricing-config';

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

// Dynamic pricing fallback — loads from DB via shared config loader
async function buildPricingFallback(): Promise<string> {
  const config = await getPricingConfig();
  const perWeek = getPerWeekPrice(config);
  const starter = config.tiers.find(t => t.slug === 'starter');
  const continuation = config.tiers.find(t => t.slug === 'continuation');
  const full = config.tiers.find(t => t.slug === 'full_season');
  const starterRange = getSessionRangeForTier(config, 'starter');
  const contRange = getSessionRangeForTier(config, 'continuation');
  const fullRange = getSessionRangeForTier(config, 'full_season');
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
  // 1. Fetch verified facts from site_settings
  const settings = await getSettings(FAQ_SETTING_KEYS);

  const keysFound = Object.keys(settings).filter(k => settings[k] && settings[k].trim().length > 0);
  const keysMissing = FAQ_SETTING_KEYS.filter(k => !settings[k] || settings[k].trim().length === 0);

  console.log(JSON.stringify({
    event: 'faq_settings_loaded',
    keysRequested: FAQ_SETTING_KEYS,
    keysFound,
    keysMissing,
    settingsValues: Object.fromEntries(
      FAQ_SETTING_KEYS.map(k => [k, settings[k] || null])
    ),
  }));

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
    settingsFoundCount: keysFound.length,
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
      responsePreview: responseText.slice(0, 150),
    }));
  } catch (error) {
    console.error('[WA-LeadBot] FAQ Gemini error:', error);
    responseText = '';
  }

  // 3. Fallback logic
  //    - Pricing questions: if response <150 chars, ALWAYS use static fallback (too important to risk)
  //    - Other questions: if response <80 chars, use generic fallback
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
        `Great question! Let me connect you with our team who can give you the best answer.\n\n` +
        `In the meantime, try our free 3-min reading assessment:\n${assessmentUrl}`;
    }
  }

  await sendText(phone, responseText);

  return {
    response: responseText,
    settingsUsed: keysFound,
  };
}
