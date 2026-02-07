// ============================================================
// FILE: app/api/mini-challenge/complete/route.ts
// ============================================================
// Mini Challenge Complete API
// Saves quiz results, calculates XP, generates discovery insights
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getMiniChallengeSettings, type GoalArea } from '@/lib/mini-challenge';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const AnswerSchema = z.object({
  question: z.string(),
  selected_index: z.number().int().min(0),
  correct_index: z.number().int().min(0),
  is_correct: z.boolean(),
  time_seconds: z.number().optional(),
});

const CompleteSchema = z.object({
  childId: z.string().uuid('Invalid child ID format'),
  goal: z.string().min(1, 'Goal is required'),
  answers: z.array(AnswerSchema).min(1, 'At least one answer is required'),
  videoWatched: z.boolean(),
  videoWatchPercent: z.number().min(0).max(100).optional().default(0),
});

type CompleteInput = z.infer<typeof CompleteSchema>;
type AnswerData = z.infer<typeof AnswerSchema>;

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

// --- HELPER: Generate discovery insight using AI ---
async function generateDiscoveryInsight(
  childName: string,
  childAge: number,
  goal: string,
  correctCount: number,
  totalQuestions: number,
  wrongAnswers: string[],
  videoWatched: boolean,
  requestId: string
): Promise<string> {
  const insightPrompt = `
A ${childAge}-year-old named ${childName} completed a mini reading challenge on "${goal}":

- Score: ${correctCount}/${totalQuestions}
- Video watched: ${videoWatched ? 'Yes' : 'No'}
${wrongAnswers.length > 0 ? `- Struggled with: ${wrongAnswers.join('; ')}` : '- Got all questions correct!'}

Generate ONE brief, specific sentence for a reading coach to use as a talking point in a discovery call.
Focus on what the child needs help with OR what they're strong at.
Be encouraging and actionable.

Return ONLY the sentence, no quotes, no explanation.`;

  let insight: string | null = null;
  const providerErrors: string[] = [];

  for (const provider of AI_PROVIDERS) {
    try {
      console.log(JSON.stringify({ requestId, event: 'ai_trying_provider', provider: provider.name }));

      let responseText: string;

      if (provider.type === 'gemini') {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: provider.model });
        const result = await model.generateContent([{ text: insightPrompt }]);
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
              { role: 'system', content: 'You are a reading education specialist. Provide concise, actionable insights.' },
              { role: 'user', content: insightPrompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
        const data = await res.json();
        responseText = data.choices[0].message.content;
      }

      insight = responseText.trim().replace(/^["']|["']$/g, '');

      console.log(JSON.stringify({
        requestId,
        event: 'insight_generated',
        provider: provider.name,
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

  if (!insight) {
    console.error(JSON.stringify({
      requestId,
      event: 'all_ai_providers_failed',
      errors: providerErrors,
    }));
    // Fallback to simple summary
    return `${childName} completed a ${goal} challenge with ${correctCount}/${totalQuestions} correct.`;
  }

  return insight;
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
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

    const validation = CompleteSchema.safeParse(body);

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

    const { childId, goal, answers, videoWatched, videoWatchPercent } = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'mini_challenge_complete_started',
      childId,
      goal,
      answersCount: answers.length,
    }));

    // 2. Get child data
    const supabase = getServiceSupabase();
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, name, age')
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

    // 3. Get settings
    const settings = await getMiniChallengeSettings(child.age);

    // 4. Calculate score and XP
    const correctCount = answers.filter(a => a.is_correct).length;
    const totalQuestions = answers.length;
    const quizXP = correctCount * settings.xpCorrect;
    const videoXP = videoWatched ? settings.xpVideo : 0;
    const totalXP = quizXP + videoXP;

    console.log(JSON.stringify({
      requestId,
      event: 'xp_calculated',
      correctCount,
      totalQuestions,
      quizXP,
      videoXP,
      totalXP,
    }));

    // 5. Generate discovery insight with AI
    const wrongAnswers = answers
      .filter(a => !a.is_correct)
      .map(a => a.question);

    let discoveryInsight = '';
    try {
      discoveryInsight = await generateDiscoveryInsight(
        child.name,
        child.age,
        goal,
        correctCount,
        totalQuestions,
        wrongAnswers,
        videoWatched,
        requestId
      );
    } catch (err) {
      console.error(JSON.stringify({
        requestId,
        event: 'insight_generation_failed',
        error: (err as Error).message,
      }));
      discoveryInsight = `${child.name} completed a ${goal} challenge with ${correctCount}/${totalQuestions} correct.`;
    }

    // 6. Build challenge data
    const challengeData = {
      completed_at: new Date().toISOString(),
      goal,
      quiz_score: correctCount,
      quiz_total: totalQuestions,
      video_watched: videoWatched,
      video_watch_percent: videoWatchPercent,
      xp_earned: totalXP,
      answers,
      discovery_insight: discoveryInsight,
    };

    // 7. Update children table
    const { error: updateError } = await supabase
      .from('children')
      .update({
        mini_challenge_completed: true,
        mini_challenge_data: challengeData,
      })
      .eq('id', childId);

    if (updateError) {
      console.error(JSON.stringify({
        requestId,
        event: 'update_child_failed',
        error: updateError.message,
      }));
      return NextResponse.json(
        { success: false, error: 'Failed to save results' },
        { status: 500 }
      );
    }

    // 8. Log to learning_events
    const { error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'mini_challenge_completed',
        event_date: new Date().toISOString(),
        event_data: challengeData,
      });

    if (eventError) {
      console.error(JSON.stringify({
        requestId,
        event: 'learning_event_failed',
        error: eventError.message,
      }));
      // Don't fail the request, just log
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'mini_challenge_completed',
      childId,
      goal,
      score: `${correctCount}/${totalQuestions}`,
      xp: totalXP,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      score: correctCount,
      total: totalQuestions,
      xp_earned: totalXP,
      video_watched: videoWatched,
      discovery_insight: discoveryInsight,
    }, {
      headers: { 'X-Request-Id': requestId },
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'mini_challenge_complete_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Mini Challenge Complete API v1.0',
    timestamp: new Date().toISOString(),
  });
}
