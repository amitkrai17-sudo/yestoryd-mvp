// ============================================================
// Handler: QUALIFICATION - Conversational lead qualification
// Asks ONE question at a time, extracts structured data
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendText, sendButtons } from '@/lib/whatsapp/cloud-api';
import type { ConversationState } from '@/lib/whatsapp/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL_NAME = 'gemini-2.5-flash';

export interface QualificationResult {
  response: string;
  extracted: {
    child_name?: string;
    child_age?: number;
    reading_concerns?: string;
  };
  nextState: ConversationState;
  leadScore: number;
  allCollected: boolean;
}

/**
 * Calculate lead score based on collected data
 */
function calculateLeadScore(data: Record<string, unknown>): number {
  let score = 0;
  const age = data.child_age as number | undefined;
  if (age && age >= 4 && age <= 12) score += 30;
  if (data.reading_concerns) score += 30;
  // Quick responder bonus: if we have data, they're engaged
  if (data.child_name) score += 20;
  // Completion bonus
  if (data.child_name && data.child_age && data.reading_concerns) score += 20;
  return score;
}

export async function handleQualification(
  phone: string,
  userMessage: string,
  collectedData: Record<string, unknown>,
  entities: Record<string, unknown>
): Promise<QualificationResult> {
  // 1. Merge any entities from intent classification
  const merged = { ...collectedData };
  if (entities.child_name && !merged.child_name) merged.child_name = entities.child_name;
  if (entities.child_age && !merged.child_age) merged.child_age = entities.child_age;
  if (entities.reading_concerns && !merged.reading_concerns) merged.reading_concerns = entities.reading_concerns;
  if (entities.city) merged.city = entities.city;
  if (entities.school) merged.school = entities.school;

  // 2. Use Gemini to extract data and generate conversational response
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 250,
      },
    });

    const alreadyHave = Object.entries(merged)
      .filter(([k, v]) => v && ['child_name', 'child_age', 'reading_concerns'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const stillNeed: string[] = [];
    if (!merged.child_name) stillNeed.push('child_name');
    if (!merged.child_age) stillNeed.push('child_age');
    if (!merged.reading_concerns) stillNeed.push('reading_concerns');

    const prompt = `You are a warm WhatsApp assistant for Yestoryd (children's reading program, India).
You're qualifying a lead by collecting child info. Be conversational, not robotic.

Already collected: ${alreadyHave || 'nothing yet'}
Still need: ${stillNeed.join(', ') || 'ALL COLLECTED'}
User's latest message: "${userMessage}"

TASKS:
1. Extract any new data from the user's message. Return extracted fields.
2. If there's still info needed, ask ONE natural follow-up question for the NEXT missing field.
3. If all collected, congratulate and say you'll share a free reading assessment.

RULES:
- Max 2-3 short sentences
- Warm, friendly, encouraging tone
- Support Hindi/Hinglish naturally
- Ask about child_name first, then child_age, then reading_concerns
- For reading_concerns, ask: "What reading challenges does [child_name] face?" or similar

Respond in JSON only, no markdown:
{"response":"your message","extracted":{"child_name":"...","child_age":5,"reading_concerns":"..."},"all_collected":false}
Only include extracted fields that you found NEW info for. child_age must be a number.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(text);

    // Merge newly extracted data
    if (parsed.extracted?.child_name) merged.child_name = parsed.extracted.child_name;
    if (parsed.extracted?.child_age) merged.child_age = Number(parsed.extracted.child_age);
    if (parsed.extracted?.reading_concerns) merged.reading_concerns = parsed.extracted.reading_concerns;

    const allCollected = !!(merged.child_name && merged.child_age && merged.reading_concerns);
    const leadScore = calculateLeadScore(merged);

    if (allCollected) {
      // Send assessment CTA with buttons
      const childName = merged.child_name as string;
      const assessmentMsg =
        parsed.response ||
        `Thank you! Based on what you've shared about ${childName}, I'd recommend our free 3-minute AI reading assessment to understand their exact level.`;

      await sendButtons(phone, assessmentMsg, [
        { id: 'btn_assessment', title: '📖 Take Assessment' },
        { id: 'btn_book_call', title: '📞 Book a Call' },
        { id: 'btn_more_questions', title: '❓ More Questions' },
      ]);

      return {
        response: assessmentMsg,
        extracted: parsed.extracted || {},
        nextState: 'ASSESSMENT_OFFERED',
        leadScore,
        allCollected: true,
      };
    }

    // Still collecting — send follow-up question
    await sendText(phone, parsed.response);

    return {
      response: parsed.response,
      extracted: parsed.extracted || {},
      nextState: 'QUALIFYING',
      leadScore,
      allCollected: false,
    };
  } catch (error) {
    console.error('[WA-LeadBot] Qualification Gemini error:', error);

    // Fallback: ask for the next missing field
    let fallbackMsg: string;
    if (!merged.child_name) {
      fallbackMsg = "I'd love to help! Could you tell me your child's name?";
    } else if (!merged.child_age) {
      fallbackMsg = `Great! How old is ${merged.child_name}?`;
    } else {
      fallbackMsg = `Thanks! Does ${merged.child_name} face any particular reading challenges?`;
    }

    await sendText(phone, fallbackMsg);

    return {
      response: fallbackMsg,
      extracted: {},
      nextState: 'QUALIFYING',
      leadScore: calculateLeadScore(merged),
      allCollected: false,
    };
  }
}
