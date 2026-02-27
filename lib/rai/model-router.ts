// file: lib/rai/model-router.ts
// rAI v2.0 - Model selection and tiered fallback

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Complexity, UserRole } from './types';
import { getGeminiModel } from '@/lib/gemini-config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Select the appropriate Gemini model based on role, intent, and complexity.
 * Coach + LEARNING always gets Flash (CoT reasoning needs depth).
 * High complexity always gets Flash.
 * Low complexity gets Flash Lite for everyone.
 */
export function selectModel(
  intent: string,
  complexity: Complexity,
  role: UserRole
): string {
  const flash = getGeminiModel('content_generation');
  const flashLight = getGeminiModel('classification');
  if (role === 'coach' && intent === 'LEARNING') return flash;
  if (complexity === 'high') return flash;
  if (complexity === 'medium' && role === 'parent') return flash;
  if (complexity === 'medium') return flashLight;
  return flashLight;
}

/**
 * Select max output tokens based on role and complexity.
 */
export function selectTokenCap(role: UserRole, complexity: Complexity): number {
  const caps: Record<string, Record<string, number>> = {
    parent: { low: 300, medium: 500, high: 500 },
    coach:  { low: 400, medium: 600, high: 800 },
    admin:  { low: 300, medium: 500, high: 600 },
  };
  return caps[role]?.[complexity] || 400;
}

/**
 * Canned fallback responses when all models fail.
 */
function getCannedFallback(intent: string, role: UserRole): string {
  if (intent === 'SCHEDULE') {
    return role === 'parent'
      ? 'I\'m having trouble looking that up right now. Please check your dashboard for session details, or contact your coach on WhatsApp.'
      : 'I\'m having trouble looking that up right now. Please check your dashboard for session details.';
  }
  if (role === 'parent') {
    return 'I\'m sorry, I\'m having a little trouble right now. Please try again in a moment, or contact your coach directly on WhatsApp for immediate help.';
  }
  if (role === 'coach') {
    return 'I\'m sorry, I\'m having a little trouble right now. Please try again in a moment, or check the student\'s profile directly for their latest data.';
  }
  return 'I\'m sorry, I\'m temporarily unable to process that. Please try again in a moment.';
}

/**
 * Generate a response with tiered fallback:
 *   Tier 1: Primary model (streaming)
 *   Tier 2: Flash Lite fallback (streaming)
 *   Tier 3: Canned response
 *
 * Yields text chunks as they arrive.
 */
export async function* generateWithFallback(
  primaryModel: string,
  prompt: string,
  maxTokens: number,
  intent: string,
  role: UserRole
): AsyncGenerator<string> {
  // Tier 1: Primary model
  try {
    const model = genAI.getGenerativeModel({
      model: primaryModel,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
    });
    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
    return;
  } catch (e) {
    console.error(`Primary model ${primaryModel} failed:`, e instanceof Error ? e.message : e);
  }

  // Tier 2: Flash fallback (only if primary wasn't already the fallback model)
  const fallbackModel = getGeminiModel('default');
  if (primaryModel !== fallbackModel) {
    try {
      const fallback = genAI.getGenerativeModel({
        model: fallbackModel,
        generationConfig: { maxOutputTokens: Math.min(maxTokens, 400), temperature: 0.3 },
      });
      const result = await fallback.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
      return;
    } catch (e) {
      console.error('Fallback model failed:', e instanceof Error ? e.message : e);
    }
  }

  // Tier 3: Canned response
  yield getCannedFallback(intent, role);
}
