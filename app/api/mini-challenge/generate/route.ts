// ============================================================
// FILE: app/api/mini-challenge/generate/route.ts
// ============================================================
// Mini Challenge Generate API
// Generates quiz questions + video based on assessment results and goals
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getMiniChallengeSettings, getMiniChallengeVideo, type GoalArea } from '@/lib/mini-challenge';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const GenerateSchema = z.object({
  childId: z.string().uuid('Invalid child ID format'),
  goalArea: z.enum(['reading', 'grammar', 'comprehension', 'creative_writing', 'speaking'] as const, {
    errorMap: () => ({ message: 'Invalid goal area' })
  }),
});

type GenerateInput = z.infer<typeof GenerateSchema>;

// --- AI PROVIDER FALLBACK CHAIN ---
interface AIProvider {
  name: string;
  model: string;
  type: 'gemini' | 'openai';
}

const AI_PROVIDERS: AIProvider[] = [
  { name: 'gemini-flash', model: 'gemini-2.5-flash', type: 'gemini' },
  { name: 'gemini-flash-lite', model: 'gemini-2.5-flash-lite', type: 'gemini' },
  { name: 'openai-gpt4o-mini', model: 'gpt-4o-mini', type: 'openai' },
];

// --- TYPES ---
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number; // 0-based index
  explanation: string;
}

interface GenerateResponse {
  questions: QuizQuestion[];
  video: {
    id: string;
    name: string;
    video_url: string;
    estimated_minutes: number;
  };
  settings: {
    questionsCount: number;
    xpCorrect: number;
    xpIncorrect: number;
    xpVideo: number;
    videoSkipDelay: number;
  };
}

// --- HELPER: Generate quiz questions using AI ---
async function generateQuizQuestions(
  childName: string,
  childAge: number,
  goalArea: GoalArea,
  assessmentData: any,
  questionsCount: number,
  requestId: string
): Promise<QuizQuestion[]> {
  const goalDescriptions: Record<GoalArea, string> = {
    reading: 'phonics, decoding, sight words, and reading fluency',
    grammar: 'sentence structure, parts of speech, punctuation, and grammar rules',
    comprehension: 'understanding stories, finding main ideas, making inferences',
    creative_writing: 'creative storytelling, descriptive writing, and imagination',
    speaking: 'clear pronunciation, expression, and confident speaking',
  };

  const prompt = `
You are a literacy education specialist creating a fun, age-appropriate quiz for ${childName}, age ${childAge}.

GOAL AREA: ${goalArea}
Focus on: ${goalDescriptions[goalArea]}

ASSESSMENT CONTEXT:
${assessmentData ? `
- Reading score: ${assessmentData.latest_assessment_score}/10
- Phonics focus: ${assessmentData.phonics_focus || 'general practice'}
- Struggling phonemes: ${assessmentData.struggling_phonemes?.join(', ') || 'none identified'}
` : 'No prior assessment data available'}

REQUIREMENTS:
1. Create exactly ${questionsCount} multiple-choice questions
2. Make questions FUN and engaging for a ${childAge}-year-old
3. Use simple, clear language appropriate for age ${childAge}
4. Each question should have 3 options (A, B, C)
5. Questions should build on their current level (not too easy, not too hard)
6. Focus on the ${goalArea} skill area
7. Use examples and scenarios kids can relate to

RESPONSE FORMAT - Provide ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "Which word has the 'th' sound like in 'the'?",
      "options": ["cat", "this", "dog"],
      "correct_answer": 1,
      "explanation": "Great! 'This' has the 'th' sound. You can feel your tongue between your teeth!"
    }
  ]
}

CRITICAL RULES:
- Questions must be appropriate for age ${childAge}
- Make it fun and encouraging
- Use simple vocabulary
- Explanations should be positive and educational
- Each explanation should teach WHY the answer is correct

Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.`;

  let questions: QuizQuestion[] | null = null;
  const providerErrors: string[] = [];

  for (const provider of AI_PROVIDERS) {
    try {
      console.log(JSON.stringify({ requestId, event: 'ai_trying_provider', provider: provider.name }));

      let responseText: string;

      if (provider.type === 'gemini') {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: provider.model });
        const result = await model.generateContent([{ text: prompt }]);
        responseText = result.response.text();
      } else {
        // OpenAI fallback
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: 'You are a literacy education specialist. Respond ONLY with valid JSON.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
        const data = await res.json();
        responseText = data.choices[0].message.content;
      }

      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);
      questions = parsed.questions;

      console.log(JSON.stringify({
        requestId,
        event: 'quiz_generated',
        provider: provider.name,
        questionCount: questions?.length || 0,
      }));

      break; // Success
    } catch (providerError) {
      const errMsg = (providerError as Error).message;
      providerErrors.push(`${provider.name}: ${errMsg}`);
      console.error(JSON.stringify({
        requestId,
        event: 'ai_provider_failed',
        provider: provider.name,
        error: errMsg,
      }));
      continue;
    }
  }

  if (!questions || questions.length === 0) {
    throw new Error(`All AI providers failed: ${providerErrors.join('; ')}`);
  }

  return questions;
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  try {
    // 1. Parse and validate input
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = GenerateSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors,
      }));
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { childId, goalArea } = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'mini_challenge_generate_started',
      childId,
      goalArea,
    }));

    // 2. Fetch child data
    const supabase = getServiceSupabase();
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, name, age, parent_goals, latest_assessment_score, phonics_focus, struggling_phonemes, mini_challenge_completed')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      console.error(JSON.stringify({
        requestId,
        event: 'child_not_found',
        childId,
        error: childError?.message,
      }));
      return NextResponse.json(
        { success: false, error: 'Child not found' },
        { status: 404 }
      );
    }

    // 3. Check if already completed
    if (child.mini_challenge_completed) {
      console.log(JSON.stringify({
        requestId,
        event: 'mini_challenge_already_completed',
        childId,
      }));
      return NextResponse.json(
        { success: false, error: 'Mini challenge already completed for this child' },
        { status: 409 }
      );
    }

    // 4. Get settings
    const settings = await getMiniChallengeSettings(child.age);

    if (!settings.enabled) {
      console.log(JSON.stringify({
        requestId,
        event: 'mini_challenge_disabled',
      }));
      return NextResponse.json(
        { success: false, error: 'Mini challenge feature is currently disabled' },
        { status: 503 }
      );
    }

    // 5. Generate quiz questions
    const questions = await generateQuizQuestions(
      child.name,
      child.age,
      goalArea,
      child,
      settings.questionsCount,
      requestId
    );

    // 6. Fetch matching video
    const video = await getMiniChallengeVideo(goalArea, child.age);

    if (!video) {
      console.error(JSON.stringify({
        requestId,
        event: 'no_video_found',
        goalArea,
        childAge: child.age,
      }));
      return NextResponse.json(
        { success: false, error: 'No video content available for this goal area and age' },
        { status: 404 }
      );
    }

    // 7. Return response
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'mini_challenge_generated',
      childId,
      goalArea,
      questionsCount: questions.length,
      videoId: video.id,
      duration: `${duration}ms`,
    }));

    const response: GenerateResponse = {
      questions,
      video: {
        id: video.id,
        name: video.name,
        video_url: video.video_url,
        estimated_minutes: video.estimated_minutes,
      },
      settings: {
        questionsCount: settings.questionsCount,
        xpCorrect: settings.xpCorrect,
        xpIncorrect: settings.xpIncorrect,
        xpVideo: settings.xpVideo,
        videoSkipDelay: settings.videoSkipDelay,
      },
    };

    return NextResponse.json({
      success: true,
      requestId,
      childId,
      childName: child.name,
      goalArea,
      ...response,
    }, {
      headers: { 'X-Request-Id': requestId },
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'mini_challenge_generate_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Failed to generate mini challenge', requestId },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Mini Challenge Generate API v1.0',
    timestamp: new Date().toISOString(),
  });
}
