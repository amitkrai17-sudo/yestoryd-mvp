// ============================================================
// POST /api/intelligence/interpret-segment
// Lightweight Gemini interpretation of a single voice segment.
// Called after each question in VoiceCapture for real-time feedback.
// Must be FAST (< 2 seconds).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { safeParseGeminiJSON } from '@/lib/gemini/safe-parse';

export const dynamic = 'force-dynamic';

const SEGMENT_PROMPTS: Record<string, string> = {
  skills: `Extract skill names from the coach's description. Return: { "interpretation": "Phonics (CVC), Fluency detected", "skills": ["phonics", "fluency"] }`,
  strengths: `Extract strengths from the coach's observation. Return: { "interpretation": "Brief summary of what went well", "words": ["any specific words mentioned as mastered"] }`,
  struggles: `Extract struggles from the coach's observation. Return: { "interpretation": "Brief summary of difficulties", "words": ["any specific words mentioned as struggled"] }`,
  homework: `Extract homework suggestion. Return: { "interpretation": "Brief practice suggestion for parent", "suggestion": "the homework text" }`,
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { questionType, text, childName } = await request.json();

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ interpretation: '', extracted: {} });
    }

    const segmentPrompt = SEGMENT_PROMPTS[questionType] || SEGMENT_PROMPTS.skills;

    const prompt = `Coach said about ${childName || 'the child'}: "${text}"

${segmentPrompt}

Respond ONLY with valid JSON. No markdown, no backticks.`;

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('formatting') });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
    });

    const parsed = safeParseGeminiJSON(result.response.text());

    return NextResponse.json({
      interpretation: parsed?.interpretation || '',
      extracted: parsed || {},
    });
  } catch (error: any) {
    console.error('[interpret-segment] Error:', error.message);
    return NextResponse.json({ interpretation: '', extracted: {} });
  }
}
