// ============================================================
// Tier 1 Intent Classifier - Gemini 2.5 Flash
// Used when Tier 0 regex doesn't match
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Intent } from './tier0-regex';
import type { ConversationState } from '@/lib/whatsapp/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = 'gemini-2.5-flash';

export interface GeminiClassification {
  intent: Intent;
  entities: {
    child_name?: string;
    child_age?: number;
    city?: string;
    school?: string;
    reading_concerns?: string;
  };
  confidence: number;
}

const SYSTEM_PROMPT = `You are an intent classifier for Yestoryd, an AI-powered children's reading program in India.

Classify the user message into exactly ONE intent:
- GREETING: Hello, hi, greetings
- FAQ: Questions about pricing, program details, duration, format, coaches, refund policy
- QUALIFICATION: User sharing info about their child (name, age, concerns, school, city)
- ASSESSMENT_CTA: Wanting to test/assess their child's reading level
- BOOKING: Wanting to book a call or meeting
- RESCHEDULE: Wanting to cancel, reschedule, change time, or can't make an existing booking
- ESCALATE: Wanting to talk to a real person, complaints, frustration
- GENERAL: Anything that doesn't fit above (thank you, ok, yes, no, random)

Also extract any entities found in the message:
- child_name: Name of the child mentioned
- child_age: Age of the child (number only)
- city: City or location mentioned
- school: School name mentioned
- reading_concerns: Any reading/learning concerns described

The user may write in English, Hindi, or Hinglish (mixed). Understand all three.

Respond in JSON only, no markdown:
{"intent":"...","entities":{},"confidence":0.0}`;

export async function classifyTier1(
  text: string,
  currentState: ConversationState,
  collectedData: Record<string, unknown>
): Promise<GeminiClassification> {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150,
      },
    });

    const contextHint = currentState === 'QUALIFYING'
      ? `\nContext: Bot is currently qualifying this lead. Already collected: ${JSON.stringify(collectedData)}`
      : '';

    const result = await model.generateContent(
      `${SYSTEM_PROMPT}${contextHint}\n\nUser message: "${text}"`
    );

    const responseText = result.response.text()
      .replace(/```json\n?|```\n?/g, '')
      .trim();

    const parsed = JSON.parse(responseText) as GeminiClassification;

    // Validate intent is one of the known types
    const validIntents: Intent[] = ['GREETING', 'FAQ', 'QUALIFICATION', 'ASSESSMENT_CTA', 'BOOKING', 'RESCHEDULE', 'ESCALATE', 'SLOT_SELECT', 'GENERAL'];
    if (!validIntents.includes(parsed.intent)) {
      parsed.intent = 'GENERAL';
    }

    return {
      intent: parsed.intent,
      entities: parsed.entities || {},
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (error) {
    console.error('[WA-LeadBot] Tier 1 classification failed:', error);
    // Fallback: if qualifying, assume they're sharing info; otherwise GENERAL
    return {
      intent: currentState === 'QUALIFYING' ? 'QUALIFICATION' : 'GENERAL',
      entities: {},
      confidence: 0.1,
    };
  }
}
