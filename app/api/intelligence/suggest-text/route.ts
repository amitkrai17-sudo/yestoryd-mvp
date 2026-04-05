// ============================================================
// POST /api/intelligence/suggest-text
// Returns 3 autocomplete suggestions for coach's partial text
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { childName, fieldType, partialText } = await request.json();

    if (!partialText || partialText.length < 10) {
      return NextResponse.json({ suggestions: [] });
    }

    const prompt = `A reading coach is writing a ${fieldType || 'observation'} note for a child named ${childName || 'the child'}.
They have typed: "${partialText}"

Suggest 3 natural completions of this sentence. Each should be:
- Specific to reading/literacy (not generic)
- 10-20 words completing the thought
- Pedagogically accurate

Return ONLY a JSON array of 3 strings. No markdown.`;

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('formatting') });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const suggestions = JSON.parse(cleaned);

    return NextResponse.json({
      suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [],
    });
  } catch (error: any) {
    console.error('[suggest-text] Error:', error.message);
    return NextResponse.json({ suggestions: [] });
  }
}
