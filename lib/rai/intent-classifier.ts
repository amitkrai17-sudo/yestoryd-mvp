// file: lib/rai/intent-classifier.ts
// rAI v2.0 - Two-tier intent classification

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Complexity, Intent, IntentClassification, UserRole } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================
// TIER 0: REGEX ROUTER (Zero latency, Zero cost)
// ============================================================

export function tier0Router(message: string): Intent | null {
  const lowerMessage = message.toLowerCase().trim();
  
  // CAPABILITIES patterns (what can you do)
  const capabilitiesPatterns = [
    /what can you (do|help|answer|assist)/,
    /what (do you|can you) (know|help with)/,
    /how can you help/,
    /what are you (for|able to)/,
    /what.*your (purpose|capabilities)/,
    /^help$/,
  ];
  
  if (capabilitiesPatterns.some(p => p.test(lowerMessage))) {
    return 'OPERATIONAL'; // Will be handled by handleOperational with 'what_can_help' response
  }
  
  // SCHEDULE patterns
  const schedulePatterns = [
    /when is (my|the|our) (next|upcoming) (session|class|meeting)/,
    /what('?s| is) (my|the|today'?s?) schedule/,
    /what time is/,
    /show me my (calendar|sessions)/,
    /do i have (any )?(sessions?|classes?) (today|tomorrow|this week)/,
    /next (session|class|meeting)/,
    /upcoming (session|class|meeting)/,
    /schedule for (today|tomorrow|this week)/,
    /my sessions? (today|tomorrow|this week)/,
  ];
  
  if (schedulePatterns.some(p => p.test(lowerMessage))) {
    return 'SCHEDULE';
  }
  
  // OPERATIONAL patterns
  const operationalPatterns = [
    /how many (children|students|kids) do i have/,
    /how many sessions? (have i|did i|completed)/,
    /who is my coach/,
    /my coach('?s)? (name|email|phone|number|contact)/,
    /what('?s| is| did) (the )?(program )?(cost|price|fee)/,
    /how (long|many months) is the program/,
    /how many sessions (are )?(included|in the program)/,
    /is my (enrollment|payment) (active|complete)/,
    /payment status/,
    /enrollment status/,
    /what is master key/,
    /what('?s| is) included/,
    /how (do i|can i) reschedule/,
    /contact (support|help)/,
    /support (number|email|contact)/,
  ];
  
  if (operationalPatterns.some(p => p.test(lowerMessage))) {
    return 'OPERATIONAL';
  }
  
  // OFF_LIMITS patterns
  const offLimitsPatterns = [
    /what are my earnings/,
    /how much (have i|did i) (earn|make)/,
    /show me (my )?payout/,
    /(my|the) (revenue|income)/,
    /other (children|students|coaches)/,
    /platform (revenue|stats|metrics)/,
    /how much does (the )?coach (earn|make)/,
    /total (revenue|earnings|income)/,
    /payout (history|details|info)/,
  ];
  
  if (offLimitsPatterns.some(p => p.test(lowerMessage))) {
    return 'OFF_LIMITS';
  }
  
  return null;
}

// ============================================================
// TIER 1: LLM CLASSIFIER
// ============================================================

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for Yestoryd, a children's reading education platform.

Classify the query into exactly ONE category:

LEARNING: Questions about child progress, development, teaching strategies, session summaries, recommendations, what to work on next, how the child is doing, reading skills, phonics, fluency, comprehension.

OPERATIONAL: Counts, coach info, program info, payment status, enrollment status, what's included, pricing, Master Key benefits, reschedule info, contact info.

SCHEDULE: Session times, calendar, when is next session, schedule today/week, upcoming sessions.

OFF_LIMITS: Earnings, payouts, other users' data, platform revenue metrics, financial information.

Also rate the complexity:
- "low": Single fact, simple lookup, basic greeting or question
- "medium": Requires some context, 1-2 data points, session summary
- "high": Requires multiple data points, trend analysis, pedagogical reasoning, comparison across sessions, or detailed recommendations

User role: {role}
Query: "{message}"

Respond ONLY with JSON (no markdown, no backticks):
{"intent": "LEARNING|OPERATIONAL|SCHEDULE|OFF_LIMITS", "complexity": "low|medium|high", "entities": ["extracted names or topics"], "confidence": 0.0-1.0}`;

export async function tier1Classifier(
  message: string,
  userRole: UserRole
): Promise<IntentClassification> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = INTENT_CLASSIFICATION_PROMPT
      .replace('{role}', userRole)
      .replace('{message}', message);
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
      },
    });
    
    const responseText = result.response.text().trim();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const complexity = (['low', 'medium', 'high'].includes(parsed.complexity) ? parsed.complexity : 'medium') as Complexity;
      return {
        intent: parsed.intent as Intent,
        entities: parsed.entities || [],
        confidence: parsed.confidence || 0.8,
        complexity,
      };
    }

    return { intent: 'LEARNING', entities: [], confidence: 0.5, complexity: 'medium' };

  } catch (error) {
    console.error('Intent classification error:', error);
    return { intent: 'LEARNING', entities: [], confidence: 0.5, complexity: 'medium' };
  }
}

// ============================================================
// COMBINED CLASSIFIER
// ============================================================

export async function classifyIntent(
  message: string,
  userRole: UserRole
): Promise<{ intent: Intent; entities: string[]; tier0Match: boolean; complexity: Complexity }> {
  const tier0Intent = tier0Router(message);

  if (tier0Intent) {
    return {
      intent: tier0Intent,
      entities: [],
      tier0Match: true,
      complexity: 'low', // Tier 0 matches are always simple/canned
    };
  }

  const tier1Result = await tier1Classifier(message, userRole);

  return {
    intent: tier1Result.intent,
    entities: tier1Result.entities,
    tier0Match: false,
    complexity: tier1Result.complexity,
  };
}

// ============================================================
// RECENT SESSION QUERY DETECTOR
// ============================================================

export function isRecentSessionQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Patterns that indicate asking about RECENT SESSION specifically
  const patterns = [
    /how did (it|the session|today'?s? session|the last session) go/,
    /what happened (today|in the session|in today'?s session|in the last session)/,
    /how was (the|today'?s?|the last) (session|class)/,
    /tell me about (the )?(last|recent|today'?s?) session/,
    /session (summary|update|recap)/,
    /latest session/,
    /last session/,
    /recent session/,
    /update on today/,
  ];
  
  // Patterns that indicate a PROGRESS query (should NOT hit cache)
  const progressPatterns = [
    /progress/,
    /phonics/,
    /fluency/,
    /reading level/,
    /improve/,
    /learn/,
    /skill/,
    /over(all| time)/,
    /generally/,
    /in general/,
  ];
  
  // If it matches a progress pattern, don't use cache
  if (progressPatterns.some(p => p.test(lowerMessage))) {
    return false;
  }
  
  // Simple "How is [child] doing?" without specifics -> cache is fine
  if (/^how('?s| is) \w+ doing\??$/.test(lowerMessage)) {
    return true;
  }
  
  return patterns.some(p => p.test(lowerMessage));
}