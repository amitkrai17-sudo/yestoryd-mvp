// ============================================================
// Intent Classification Pipeline
// Tier 0 (regex) → Tier 1 (Gemini) fallback
// ============================================================

import { classifyTier0 } from './tier0-regex';
import { classifyTier1 } from './tier1-gemini';
import type { Intent } from './tier0-regex';
import type { ConversationState } from '@/lib/whatsapp/types';

export type { Intent } from './tier0-regex';
export type { GeminiClassification } from './tier1-gemini';

export interface ClassificationResult {
  intent: Intent;
  tier: 0 | 1;
  entities: Record<string, unknown>;
  confidence: number;
}

export async function classifyIntent(
  text: string | null,
  interactiveId: string | null,
  currentState: ConversationState,
  collectedData: Record<string, unknown>
): Promise<ClassificationResult> {
  // Tier 0: Regex (free, instant)
  const tier0 = classifyTier0(text, interactiveId);
  if (tier0) {
    console.log(JSON.stringify({
      event: 'wa_intent_classified',
      tier: 0,
      intent: tier0,
      text: text?.slice(0, 50),
    }));
    return { intent: tier0, tier: 0, entities: {}, confidence: 1.0 };
  }

  // Tier 1: Gemini (if we have text to classify)
  if (text && text.trim().length > 0) {
    const tier1 = await classifyTier1(text, currentState, collectedData);
    console.log(JSON.stringify({
      event: 'wa_intent_classified',
      tier: 1,
      intent: tier1.intent,
      confidence: tier1.confidence,
      entities: Object.keys(tier1.entities),
      text: text.slice(0, 50),
    }));
    return {
      intent: tier1.intent,
      tier: 1,
      entities: tier1.entities,
      confidence: tier1.confidence,
    };
  }

  // No text and no button → GENERAL
  return { intent: 'GENERAL', tier: 0, entities: {}, confidence: 0 };
}
