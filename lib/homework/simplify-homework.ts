// ============================================================
// FILE: lib/homework/simplify-homework.ts
// PURPOSE: Gemini rewrites coach homework text into parent-friendly language
// Coach's original text preserved as coach_notes for SmartPractice later
// ============================================================

import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';

const SIMPLIFY_PROMPT = `You are a friendly children's reading coach assistant.

A coach has written homework instructions for a parent and child. The coach's language may be technical (mentioning Lexile levels, phonemic awareness, CVC words, etc.) or overly long.

Rewrite the homework into EXACTLY 1-2 simple sentences that:
- A parent with no teaching background can understand immediately
- Tell the child exactly what to DO (action-oriented)
- Are warm and encouraging
- Are appropriate for a child aged {age}
- Never use technical terms (no Lexile, no phonemic, no CVC, no blending, no fluency scores)
- Keep it under 120 characters if possible
- Use the child's first name naturally

COACH WROTE:
{coachText}

CHILD'S NAME: {childName}
CHILD'S AGE: {age}

Respond with ONLY the simplified text. No quotes, no explanation, no preamble.`;

/**
 * Simplifies coach homework text into parent-friendly language via Gemini Flash.
 * Returns both simplified and original text. Never throws — falls back to generic text.
 */
export async function simplifyHomework(
  coachText: string,
  childName: string,
  age: number,
): Promise<{ simplified: string; original: string }> {
  const firstName = childName.split(' ')[0] || 'your child';

  // Short, simple text doesn't need simplification
  if (coachText.length < 80 && !/lexile|phonem|cvc|blend|fluency|decod|digraph|trigraph/i.test(coachText)) {
    return { simplified: coachText, original: coachText };
  }

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('formatting') });

    const prompt = SIMPLIFY_PROMPT
      .replace('{coachText}', coachText)
      .replace('{childName}', firstName)
      .replace(/\{age\}/g, String(age));

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
    });

    const simplified = result.response.text().trim();

    if (!simplified || simplified.length > 200 || simplified.length < 10) {
      return {
        simplified: `Practice time, ${firstName}! Your coach has a special activity for you today.`,
        original: coachText,
      };
    }

    return { simplified, original: coachText };
  } catch (error: any) {
    console.error('[simplify-homework] Gemini failed, using fallback:', error.message);
    return {
      simplified: `Practice time, ${firstName}! Your coach has a special activity for you today.`,
      original: coachText,
    };
  }
}
