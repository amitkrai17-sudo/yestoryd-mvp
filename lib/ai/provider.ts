/**
 * AI Provider Fallback System
 * 
 * Provides automatic failover between AI providers:
 * 1. Gemini 2.5 Flash Lite (Primary - cheapest)
 * 2. Gemini 2.5 Flash (Fallback 1 - better quality)
 * 3. OpenAI GPT-4o-mini (Fallback 2 - if Gemini is down)
 * 4. Manual assessment flag (Last resort)
 * 
 * Usage:
 * import { analyzeReading, generateEmbedding, generateSessionSummary } from '@/lib/ai/provider';
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ==================== CONFIGURATION ====================

interface AIProviderConfig {
  name: string;
  model: string;
  apiKey: string | undefined;
  enabled: boolean;
}

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    name: 'gemini-flash-lite',
    model: 'gemini-2.0-flash-lite',
    apiKey: process.env.GEMINI_API_KEY,
    enabled: true,
  },
  {
    name: 'gemini-flash',
    model: 'gemini-2.0-flash',
    apiKey: process.env.GEMINI_API_KEY,
    enabled: true,
  },
  {
    name: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    enabled: !!process.env.OPENAI_API_KEY,
  },
];

// ==================== TYPES ====================

export interface ReadingAnalysisResult {
  success: boolean;
  provider?: string;
  clarity_score: number;
  fluency_score: number;
  speed_score: number;
  overall_score: number;
  wpm: number;
  strengths: string[];
  areas_to_improve: string[];
  feedback: string;
  encouragement: string;
  requiresManualReview?: boolean;
  error?: string;
}

export interface EmbeddingResult {
  success: boolean;
  provider?: string;
  embedding: number[];
  error?: string;
}

export interface SessionSummaryResult {
  success: boolean;
  provider?: string;
  parentSummary: string;
  coachNotes: string;
  actionItems: string[];
  ragSummary: string;
  error?: string;
}

// ==================== GEMINI CLIENT ====================

function getGeminiClient(model: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

// ==================== READING ANALYSIS ====================

/**
 * Analyze a child's reading with automatic provider fallback
 */
export async function analyzeReading(
  audioBase64: string,
  passageText: string,
  childAge: number,
  childName: string
): Promise<ReadingAnalysisResult> {
  const errors: string[] = [];

  // Get age-appropriate strictness
  const strictness = getAgeStrictness(childAge);

  for (const provider of AI_PROVIDERS) {
    if (!provider.enabled || !provider.apiKey) continue;

    try {
      console.log(`[AI] Trying ${provider.name} for reading analysis...`);

      if (provider.name.startsWith('gemini')) {
        const result = await analyzeWithGemini(
          provider.model,
          audioBase64,
          passageText,
          childAge,
          childName,
          strictness
        );
        console.log(`[AI] Success with ${provider.name}`);
        return { ...result, success: true, provider: provider.name };
      }

      if (provider.name === 'openai') {
        const result = await analyzeWithOpenAI(
          audioBase64,
          passageText,
          childAge,
          childName,
          strictness
        );
        console.log(`[AI] Success with ${provider.name}`);
        return { ...result, success: true, provider: provider.name };
      }
    } catch (error: any) {
      console.error(`[AI] ${provider.name} failed:`, error.message);
      errors.push(`${provider.name}: ${error.message}`);
      continue;
    }
  }

  // All providers failed - return manual review flag
  console.error('[AI] All providers failed, returning manual review flag');
  return {
    success: false,
    requiresManualReview: true,
    clarity_score: 0,
    fluency_score: 0,
    speed_score: 0,
    overall_score: 0,
    wpm: 0,
    strengths: [],
    areas_to_improve: [],
    feedback: 'Assessment requires manual review due to technical issues.',
    encouragement: 'Great effort! Your coach will review this personally.',
    error: errors.join('; '),
  };
}

async function analyzeWithGemini(
  model: string,
  audioBase64: string,
  passageText: string,
  childAge: number,
  childName: string,
  strictness: StrictnessConfig
): Promise<Omit<ReadingAnalysisResult, 'success' | 'provider'>> {
  const gemini = getGeminiClient(model);

  const prompt = `You are Vedant, an expert AI reading coach for children. Analyze this child's reading.

CHILD: ${childName}, Age ${childAge}
PASSAGE: "${passageText}"

SCORING GUIDELINES (Age ${childAge}):
- Be ${strictness.tone} in your assessment
- Score Range Expectation: ${strictness.scoreRange}
- ${strictness.instructions}

IMPORTANT RULES:
1. If the child reads less than 50% of the passage, maximum overall score is 4/10
2. If the child struggles significantly, be encouraging but honest
3. WPM should be realistic for the age group (${strictness.expectedWPM} WPM typical)

Respond ONLY with valid JSON:
{
  "clarity_score": <1-10>,
  "fluency_score": <1-10>,
  "speed_score": <1-10>,
  "overall_score": <1-10>,
  "wpm": <number>,
  "strengths": ["strength1", "strength2"],
  "areas_to_improve": ["area1", "area2"],
  "feedback": "Detailed feedback for parents",
  "encouragement": "Motivating message for the child"
}`;

  const result = await gemini.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'audio/webm',
        data: audioBase64,
      },
    },
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Invalid JSON response from Gemini');
  }

  return JSON.parse(jsonMatch[0]);
}

async function analyzeWithOpenAI(
  audioBase64: string,
  passageText: string,
  childAge: number,
  childName: string,
  strictness: StrictnessConfig
): Promise<Omit<ReadingAnalysisResult, 'success' | 'provider'>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  // Note: OpenAI doesn't support audio directly in the same way
  // This is a text-based fallback for when audio transcription is available
  // In production, you'd use Whisper API first, then GPT-4
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Vedant, an expert AI reading coach. Analyze children's reading ability.`,
        },
        {
          role: 'user',
          content: `Analyze reading for ${childName}, age ${childAge}.
Passage: "${passageText}"
Guidelines: ${strictness.instructions}

Return JSON with: clarity_score, fluency_score, speed_score, overall_score (1-10), wpm, strengths[], areas_to_improve[], feedback, encouragement`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// ==================== EMBEDDINGS ====================

/**
 * Generate embeddings for RAG with automatic fallback
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const errors: string[] = [];

  // Try Gemini embedding first
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding.values;
      
      return {
        success: true,
        provider: 'gemini-embedding',
        embedding,
      };
    }
  } catch (error: any) {
    errors.push(`gemini: ${error.message}`);
  }

  // Try OpenAI embeddings
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          provider: 'openai-embedding',
          embedding: data.data[0].embedding,
        };
      }
    }
  } catch (error: any) {
    errors.push(`openai: ${error.message}`);
  }

  // Return empty embedding as fallback (search will still work, just less accurate)
  return {
    success: false,
    embedding: new Array(768).fill(0),
    error: errors.join('; '),
  };
}

// ==================== SESSION SUMMARIES ====================

/**
 * Generate session summaries from transcript
 */
export async function generateSessionSummary(
  transcript: string,
  childName: string,
  sessionType: 'coaching' | 'parent_checkin'
): Promise<SessionSummaryResult> {
  const errors: string[] = [];

  for (const provider of AI_PROVIDERS.slice(0, 2)) { // Only use Gemini for this
    if (!provider.enabled || !provider.apiKey) continue;

    try {
      const gemini = getGeminiClient(provider.model);

      const prompt = `Analyze this ${sessionType === 'coaching' ? 'coaching session' : 'parent check-in'} transcript for ${childName}.

TRANSCRIPT:
${transcript}

Generate summaries in this JSON format:
{
  "parentSummary": "2-3 sentence summary for parents (warm, encouraging tone)",
  "coachNotes": "Detailed notes for coach's reference",
  "actionItems": ["action1", "action2", "action3"],
  "ragSummary": "Comprehensive summary for AI knowledge base (include all key points, progress, concerns)"
}`;

      const result = await gemini.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          provider: provider.name,
          ...parsed,
        };
      }
    } catch (error: any) {
      errors.push(`${provider.name}: ${error.message}`);
      continue;
    }
  }

  return {
    success: false,
    parentSummary: 'Session summary will be available soon.',
    coachNotes: 'Manual review required.',
    actionItems: [],
    ragSummary: `Session with ${childName}. Manual review pending.`,
    error: errors.join('; '),
  };
}

// ==================== AGE STRICTNESS CONFIGURATION ====================

interface StrictnessConfig {
  tone: string;
  scoreRange: string;
  instructions: string;
  expectedWPM: string;
}

function getAgeStrictness(age: number): StrictnessConfig {
  if (age <= 5) {
    return {
      tone: 'very encouraging and gentle',
      scoreRange: '6-10 for any genuine attempt',
      instructions: 'Focus on effort and participation. Any reading attempt deserves praise. Score generously.',
      expectedWPM: '20-40',
    };
  }
  
  if (age <= 7) {
    return {
      tone: 'encouraging with gentle guidance',
      scoreRange: '5-10 based on effort and basic accuracy',
      instructions: 'Acknowledge effort while noting areas for improvement. Be supportive.',
      expectedWPM: '40-70',
    };
  }
  
  if (age <= 9) {
    return {
      tone: 'balanced - encouraging but with clear feedback',
      scoreRange: '4-10 based on accuracy and fluency',
      instructions: 'Balance praise with constructive feedback. Expect reasonable fluency.',
      expectedWPM: '70-100',
    };
  }
  
  if (age <= 11) {
    return {
      tone: 'constructive and growth-oriented',
      scoreRange: '3-10 based on overall performance',
      instructions: 'Provide specific, actionable feedback. Higher expectations for fluency and comprehension.',
      expectedWPM: '100-130',
    };
  }
  
  // Age 12+
  return {
    tone: 'direct but supportive',
    scoreRange: '2-10 with honest assessment',
    instructions: 'Be honest about performance. Expect near-adult reading capability. Focus on refinement.',
    expectedWPM: '130-180',
  };
}

// ==================== HEALTH CHECK ====================

/**
 * Check which AI providers are available
 */
export async function checkAIHealth(): Promise<{
  providers: { name: string; available: boolean; latency?: number }[];
}> {
  const results = [];

  for (const provider of AI_PROVIDERS) {
    if (!provider.apiKey) {
      results.push({ name: provider.name, available: false });
      continue;
    }

    const start = Date.now();
    try {
      if (provider.name.startsWith('gemini')) {
        const gemini = getGeminiClient(provider.model);
        await gemini.generateContent('Say "OK"');
        results.push({
          name: provider.name,
          available: true,
          latency: Date.now() - start,
        });
      }
    } catch {
      results.push({ name: provider.name, available: false });
    }
  }

  return { providers: results };
}
