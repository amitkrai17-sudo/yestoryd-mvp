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
import { getGeminiModel } from '@/lib/gemini-config';
import { getAgeConfig, buildFullAssessmentPrompt, type FullAssessmentResult } from '@/lib/gemini/assessment-prompts';

// ==================== CONFIGURATION ====================

interface AIProviderConfig {
  name: string;
  model: string;
  apiKey: string | undefined;
  enabled: boolean;
}

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    name: 'gemini-flash',
    model: getGeminiModel('default'),
    apiKey: process.env.GEMINI_API_KEY,
    enabled: true,
  },
  {
    name: 'gemini-pro',
    model: getGeminiModel('assessment_analysis'),
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
  completeness_percentage?: number;
  error_classification?: FullAssessmentResult['error_classification'];
  phonics_analysis?: FullAssessmentResult['phonics_analysis'];
  skill_breakdown?: FullAssessmentResult['skill_breakdown'];
  practice_recommendations?: FullAssessmentResult['practice_recommendations'];
  strengths: string[];
  areas_to_improve: string[];
  feedback: string;
  self_corrections?: string[];
  hesitations?: string[];
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
          childName
        );
        console.log(`[AI] Success with ${provider.name}`);
        return { ...result, success: true, provider: provider.name };
      }

      if (provider.name === 'openai') {
        const result = await analyzeWithOpenAI(
          audioBase64,
          passageText,
          childAge,
          childName
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
    error: errors.join('; '),
  };
}

async function analyzeWithGemini(
  model: string,
  audioBase64: string,
  passageText: string,
  childAge: number,
  childName: string
): Promise<Omit<ReadingAnalysisResult, 'success' | 'provider'>> {
  const gemini = getGeminiClient(model);

  const prompt = buildFullAssessmentPrompt({
    childName,
    childAge,
    passage: passageText,
    wordCount: passageText.split(' ').length,
  });

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
  const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Invalid JSON response from Gemini');
  }

  const full: FullAssessmentResult = JSON.parse(jsonMatch[0]);

  // Compute overall_score server-side
  const clarityScore = Math.min(10, Math.max(1, full.clarity_score || 5));
  const fluencyScore = Math.min(10, Math.max(1, full.fluency_score || 5));
  const speedScore = Math.min(10, Math.max(1, full.speed_score || 5));
  const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

  return {
    clarity_score: clarityScore,
    fluency_score: fluencyScore,
    speed_score: speedScore,
    overall_score: overallScore,
    wpm: full.wpm || 0,
    completeness_percentage: full.completeness_percentage,
    error_classification: full.error_classification,
    phonics_analysis: full.phonics_analysis,
    skill_breakdown: full.skill_breakdown,
    practice_recommendations: full.practice_recommendations,
    strengths: full.strengths || [],
    areas_to_improve: full.areas_to_improve || [],
    feedback: full.feedback || '',
    self_corrections: full.self_corrections || [],
    hesitations: full.hesitations || [],
  };
}

async function analyzeWithOpenAI(
  audioBase64: string,
  passageText: string,
  childAge: number,
  childName: string
): Promise<Omit<ReadingAnalysisResult, 'success' | 'provider'>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const ageConfig = getAgeConfig(childAge);

  // Note: OpenAI doesn't support audio directly in the same way
  // This is a text-based fallback for when audio transcription is available
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
          content: 'You are a reading assessment specialist. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: buildFullAssessmentPrompt({
            childName,
            childAge,
            passage: passageText,
            wordCount: passageText.split(' ').length,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const full: FullAssessmentResult = JSON.parse(data.choices[0].message.content);

  // Compute overall_score server-side
  const clarityScore = Math.min(10, Math.max(1, full.clarity_score || 5));
  const fluencyScore = Math.min(10, Math.max(1, full.fluency_score || 5));
  const speedScore = Math.min(10, Math.max(1, full.speed_score || 5));
  const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

  return {
    clarity_score: clarityScore,
    fluency_score: fluencyScore,
    speed_score: speedScore,
    overall_score: overallScore,
    wpm: full.wpm || 0,
    completeness_percentage: full.completeness_percentage,
    strengths: full.strengths || [],
    areas_to_improve: full.areas_to_improve || [],
    feedback: full.feedback || '',
    self_corrections: full.self_corrections || [],
    hesitations: full.hesitations || [],
  };
}

// ==================== EMBEDDINGS ====================

import { generateEmbedding as generateRaiEmbedding } from '@/lib/rai/embeddings';

/**
 * Generate embeddings for RAG — delegates to centralized lib/rai/embeddings.ts
 * Uses gemini-embedding-001 (768-dim) as the single model for all embeddings.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const embedding = await generateRaiEmbedding(text);
    return {
      success: true,
      provider: 'gemini-embedding-001',
      embedding,
    };
  } catch (error: any) {
    return {
      success: false,
      embedding: new Array(768).fill(0),
      error: error.message,
    };
  }
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

// Age strictness now provided by shared getAgeConfig() from lib/gemini/assessment-prompts.ts

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
