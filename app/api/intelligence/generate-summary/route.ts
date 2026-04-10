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

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      childName, childAge,
      skills, // [{ name, rating }]
      strengthObservations, // string[]
      struggleObservations, // string[]
      wordsMastered, // string[]
      wordsStruggled, // string[]
      voiceSegments, // { skills, strengths, struggles, homework } | null
      engagementLevel, // string | null
    } = body;

    const prompt = `You are a reading coach assistant for Yestoryd. Generate a concise session summary.

CHILD: ${childName || 'the child'}, age ${childAge || 7}

SESSION DATA:
Skills worked on: ${(skills || []).map((s: any) => `${s.name} (${s.rating})`).join(', ') || 'Not specified'}
Strength observations: ${(strengthObservations || []).join('; ') || 'None selected'}
Struggle observations: ${(struggleObservations || []).join('; ') || 'None selected'}
Words mastered: ${(wordsMastered || []).join(', ') || 'None'}
Words struggled: ${(wordsStruggled || []).join(', ') || 'None'}
${voiceSegments ? `Coach voice notes:\n- Skills: ${voiceSegments.skills || ''}\n- Strengths: ${voiceSegments.strengths || ''}\n- Struggles: ${voiceSegments.struggles || ''}\n- Practice: ${voiceSegments.homework || ''}` : ''}
Engagement: ${engagementLevel || 'Not rated'}

Generate (respond in JSON only, no markdown):
{
  "strengthSummary": "2-3 sentences on what went well. Be specific, reference actual observations.",
  "growthSummary": "2-3 sentences on areas for development. Actionable, not generic.",
  "homeworkSuggestion": "1-2 specific practice activities for home. Parent-friendly language, include specific words/skills."
}

RULES:
- Use the child's name naturally.
- Reference actual observations and words, not generic statements.
- Homework should be doable in 10-15 minutes.
- If data is sparse, keep summaries brief (1 sentence each).

Respond ONLY with valid JSON. No markdown, no backticks, no explanation.`;

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
