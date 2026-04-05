// ============================================================
// POST /api/intelligence/extract-voice
// Extracts structured fields from coach's guided voice segments via Gemini
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
    const { childName, segments } = await request.json();

    if (!segments) {
      return NextResponse.json({ data: null, error: 'No segments provided' });
    }

    const prompt = `You are analyzing a coach's verbal observations about a child named ${childName || 'the child'} in a reading/literacy session.

The coach answered 4 guided questions. Extract structured data from their responses.

COACH'S RESPONSES:
Q: What skills were covered?
A: ${segments.skills || 'Not answered'}

Q: What went well?
A: ${segments.strengths || 'Not answered'}

Q: What did they struggle with?
A: ${segments.struggles || 'Not answered'}

Q: Words/activities for home practice?
A: ${segments.homework || 'Not answered'}

EXTRACT (respond in JSON only, no markdown):
{
  "skillNames": ["list of skill names mentioned"],
  "strengthNotes": "2-3 sentence summary of strengths observed",
  "struggleNotes": "2-3 sentence summary of struggles observed",
  "wordsMastered": ["specific words the child got right"],
  "wordsStruggled": ["specific words the child struggled with"],
  "engagementLevel": "low or medium or high",
  "homeworkSuggestion": "what to practice at home"
}

RULES:
- Extract ONLY what the coach actually said. Do not infer or add.
- If a section was not answered, leave its field as empty string or empty array.
- wordsMastered and wordsStruggled: only include specific words explicitly mentioned.
- engagementLevel: infer from tone. Enthusiastic = high, neutral = medium, concerned = low.

Respond ONLY with valid JSON. No markdown, no backticks, no explanation.`;

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('formatting') });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
    });

    const text = result.response.text();
    const extracted = safeParseGeminiJSON(text);

    if (!extracted) {
      console.error('[extract-voice] JSON parse failed. Raw:', text.substring(0, 200));
      return NextResponse.json({ data: null, error: 'Parse failed' });
    }

    return NextResponse.json({ data: extracted });
  } catch (error: any) {
    console.error('[extract-voice] Gemini extraction failed:', error.message);
    return NextResponse.json({ data: null, error: 'Extraction failed' });
  }
}
