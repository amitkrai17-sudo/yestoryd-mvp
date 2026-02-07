// ============================================================
// Handler: FAQ - Answer questions with verified site_settings data
// Anti-hallucination: Gemini only formats facts from DB
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendText } from '@/lib/whatsapp/cloud-api';
import { getSettings } from '@/lib/settings/getSettings';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = 'gemini-2.5-flash';

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

  // 2. Generate natural answer with Gemini (strict anti-hallucination)
  let responseText: string;
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
      },
    });

    const prompt = `You are a friendly WhatsApp assistant for Yestoryd, a children's reading program in India.
Answer the parent's question using ONLY the facts below. If the facts don't contain the answer, say "I'll connect you with our team for details on that."

VERIFIED FACTS:
${availableFacts || 'No specific details available in database.'}

${personalization}

RULES:
- Max 3 short sentences (WhatsApp-friendly)
- Warm, encouraging tone
- If the parent writes in Hindi/Hinglish, respond similarly
- NEVER invent pricing, durations, or program details not in the facts
- End with a soft CTA: either take the free assessment or book a call
- Use ₹ for currency, not Rs

Parent's question: "${question}"`;

    const result = await model.generateContent(prompt);
    responseText = result.response.text().trim();
  } catch (error) {
    console.error('[WA-LeadBot] FAQ Gemini error:', error);
    responseText = `Great question! Let me connect you with our team who can give you the best answer.\n\nIn the meantime, try our free 3-min reading assessment:\nhttps://www.yestoryd.com/assessment`;
  }

  await sendText(phone, responseText);

  return {
    response: responseText,
    settingsUsed: Object.keys(settings).filter(k => settings[k]),
  };
}
