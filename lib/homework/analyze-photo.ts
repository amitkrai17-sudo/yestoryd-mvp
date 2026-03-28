// ============================================================
// FILE: lib/homework/analyze-photo.ts
// PURPOSE: Gemini Vision analysis of homework photos
// ============================================================

import { getGenAI } from '@/lib/gemini/client';
import { getAntiHallucinationRules } from '@/lib/gemini/assessment-prompts';

export interface HomeworkPhotoAnalysis {
  completeness: 'empty' | 'partial' | 'complete';
  effort_level: 'minimal' | 'moderate' | 'strong';
  handwriting_quality: 'developing' | 'fair' | 'good' | 'excellent';
  content_summary: string;
  word_count_estimate: number;
  observations: string[];
}

export async function analyzeHomeworkPhoto(
  photoUrl: string,
  childContext: {
    childName: string;
    age: number;
    taskTitle: string;
    linkedSkill: string | null;
  }
): Promise<HomeworkPhotoAnalysis | null> {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Fetch the image as base64
    const imageResponse = await fetch(photoUrl);
    if (!imageResponse.ok) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    const antiHallucination = getAntiHallucinationRules(childContext.childName);

    const prompt = `You are analyzing a child's homework photo for a reading education platform.

Child context:
- Age: ${childContext.age}
- Assignment: "${childContext.taskTitle}"
- Skill area: ${childContext.linkedSkill || 'general reading'}

Analyze this photo of the child's homework/practice work. Return ONLY valid JSON, no markdown:

{
  "completeness": "empty" | "partial" | "complete",
  "effort_level": "minimal" | "moderate" | "strong",
  "handwriting_quality": "developing" | "fair" | "good" | "excellent",
  "content_summary": "1-2 sentence factual description of what the child wrote/did",
  "word_count_estimate": number,
  "observations": ["max 3 short observations about quality, effort, or areas to note"]
}

Rules:
- Be encouraging and developmental in observations (this is for a child aged ${childContext.age})
- Rate handwriting quality relative to the child's age
- If the photo is unclear or not homework, set completeness to "empty" and note in observations
- content_summary should be factual, not evaluative
- Keep observations under 15 words each
- word_count_estimate: count approximate words visible in the child's handwriting

${antiHallucination}`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64Image, mimeType } },
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as HomeworkPhotoAnalysis;
  } catch (error: any) {
    console.error('Homework photo analysis failed:', error.message);
    return null;
  }
}
