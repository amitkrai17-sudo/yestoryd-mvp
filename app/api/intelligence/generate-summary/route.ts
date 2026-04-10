// ============================================================
// POST /api/intelligence/generate-summary
// Gemini generates strength/growth summaries + homework suggestion
// from the coach's selected observations, ratings, and voice notes.
// Called when coach reaches the Review card in StructuredCapture.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { safeParseGeminiJSON } from '@/lib/gemini/safe-parse';
import { buildCaptureSummaryPrompt } from '@/lib/gemini/session-prompts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();

    const prompt = buildCaptureSummaryPrompt({
      childName: body.childName,
      childAge: body.childAge,
      skills: body.skills,
      strengthObservations: body.strengthObservations,
      struggleObservations: body.struggleObservations,
      wordsMastered: body.wordsMastered,
      wordsStruggled: body.wordsStruggled,
      voiceSegments: body.voiceSegments,
      engagementLevel: body.engagementLevel,
    });

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('formatting') });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    });

    const text = result.response.text();
    const summary = safeParseGeminiJSON<{
      strengthSummary?: string;
      growthSummary?: string;
      homeworkSuggestion?: string;
    }>(text);

    if (!summary) {
      console.error('[generate-summary] JSON parse failed. Raw:', text.substring(0, 200));
      return NextResponse.json({ success: false, strengthSummary: '', growthSummary: '', homeworkSuggestion: '' });
    }

    return NextResponse.json({
      success: true,
      strengthSummary: summary.strengthSummary || '',
      growthSummary: summary.growthSummary || '',
      homeworkSuggestion: summary.homeworkSuggestion || '',
    });
  } catch (error: any) {
    console.error('[generate-summary] Error:', error.message);
    return NextResponse.json({
      success: false,
      strengthSummary: '',
      growthSummary: '',
      homeworkSuggestion: '',
    });
  }
}
