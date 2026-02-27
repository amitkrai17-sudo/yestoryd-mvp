// ============================================================
// FILE: lib/gemini/audio-analysis.ts
// PURPOSE: Gemini-powered audio analysis for offline sessions
//   - transcribeVoiceNote: coach voice note → text transcript
//   - analyzeChildReading: child reading clip → fluency analysis
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGeminiModel } from '@/lib/gemini-config';
import { getAgeConfig, getAntiHallucinationRules } from '@/lib/gemini/assessment-prompts';

const STORAGE_BUCKET = 'session-audio';

function getGenAI(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Infer MIME type from file extension
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp4: 'audio/mp4',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    mp3: 'audio/mpeg',
    mpeg: 'audio/mpeg',
    wav: 'audio/wav',
  };
  return mimeMap[ext || ''] || 'audio/webm';
}

// Download file from Supabase Storage and return as base64
async function downloadAsBase64(storagePath: string): Promise<{ base64: string; mimeType: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download audio: ${error?.message || 'No data returned'}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    base64: buffer.toString('base64'),
    mimeType: getMimeType(storagePath),
  };
}

// ============================================================
// Voice Note Transcription
// ============================================================

/**
 * Transcribe a coach voice note from Supabase Storage via Gemini.
 * Expects a 1-3 minute audio file with session observations.
 */
export async function transcribeVoiceNote(storagePath: string): Promise<string> {
  const { base64, mimeType } = await downloadAsBase64(storagePath);

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('reading_level') });

  const prompt = `You are transcribing a reading coach's voice note recorded after an in-person coaching session with a child.

The coach is describing what happened during the session: activities completed, how the child performed, any struggles observed, and overall impressions.

INSTRUCTIONS:
- Provide a clean, readable transcript of the spoken content
- Fix filler words and false starts for readability but preserve all factual content
- Use proper punctuation and paragraph breaks
- If the coach mentions specific activities, skills, or observations, preserve those exactly
- If audio quality is poor for a section, note [unclear] but continue
- Do NOT add interpretation or commentary — just transcribe

Return ONLY the transcript text, no JSON wrapping.`;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
  ]);

  const transcript = result.response.text().trim();

  if (!transcript || transcript.length < 10) {
    throw new Error('Gemini returned empty or invalid transcript');
  }

  return transcript;
}

// ============================================================
// Child Reading Clip Analysis
// ============================================================

export interface ReadingAnalysis {
  wpm: number;
  accuracy_percent: number;
  fluency_score: number;
  errors: string[];
  self_corrections: string[];
  hesitations: string[];
  strengths: string[];
  areas_for_improvement: string[];
}

/**
 * Analyze a child's reading clip from Supabase Storage via Gemini.
 * Returns structured fluency data comparable to online session AI analysis.
 */
export async function analyzeChildReading(
  storagePath: string,
  childId: string
): Promise<ReadingAnalysis> {
  const { base64, mimeType } = await downloadAsBase64(storagePath);

  // Fetch child context for age-appropriate analysis
  const supabase = createAdminClient();
  const { data: child } = await supabase
    .from('children')
    .select('child_name, age, learning_profile')
    .eq('id', childId)
    .single();

  const learningProfile = child?.learning_profile as Record<string, unknown> | null;
  const previousWpm = (learningProfile as Record<string, { wpm?: number }> | null)?.reading_level?.wpm;

  const childName = child?.child_name || 'Unknown';
  const childAge = child?.age || 8;
  const ageConfig = getAgeConfig(childAge);

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('reading_level') });

  const prompt = `You are an expert reading assessment analyst. Analyze this child's reading audio clip.

CHILD CONTEXT:
- Name: ${childName}
- Age: ${childAge} years old
${previousWpm ? `- Previous WPM: ${previousWpm}` : '- No previous WPM data'}

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Be ${ageConfig.tone} in your assessment
- WPM expectation: ${ageConfig.expectedWPM} WPM typical

AUDIO: [attached reading clip recorded during an in-person coaching session]

Analyze the reading and provide:

1. WORDS PER MINUTE (WPM) — estimate from audio duration and word count
2. ACCURACY PERCENT — percentage of words read correctly
3. FLUENCY SCORE (1-10) — 1=word-by-word, 5=adequate phrasing, 10=expressive/natural
4. ERRORS — list specific words misread or omitted (max 10)
5. SELF-CORRECTIONS — words the child initially misread but then corrected
6. HESITATIONS — words where the child paused significantly before reading
7. STRENGTHS — what the child did well (3-5 points)
8. AREAS FOR IMPROVEMENT — specific areas to work on (3-5 points)

${getAntiHallucinationRules(childName)}

Return ONLY valid JSON, no markdown:
{
  "wpm": <number>,
  "accuracy_percent": <number 0-100>,
  "fluency_score": <number 1-10>,
  "errors": ["word1", "word2"],
  "self_corrections": ["word1"],
  "hesitations": ["word1"],
  "strengths": ["strength1", "strength2"],
  "areas_for_improvement": ["area1", "area2"]
}`;

  try {
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ]);

    const responseText = result.response.text()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const analysis: ReadingAnalysis = JSON.parse(responseText);

    return {
      wpm: Math.max(0, analysis.wpm || 0),
      accuracy_percent: Math.min(100, Math.max(0, analysis.accuracy_percent || 0)),
      fluency_score: Math.min(10, Math.max(1, analysis.fluency_score || 5)),
      errors: analysis.errors || [],
      self_corrections: analysis.self_corrections || [],
      hesitations: analysis.hesitations || [],
      strengths: analysis.strengths || ['Completed the reading'],
      areas_for_improvement: analysis.areas_for_improvement || ['Continue practicing'],
    };
  } catch (error) {
    console.error('Gemini reading analysis error:', error);

    // Fallback — return neutral analysis so the pipeline doesn't break
    return {
      wpm: 0,
      accuracy_percent: 0,
      fluency_score: 5,
      errors: [],
      self_corrections: [],
      hesitations: [],
      strengths: ['Completed the reading clip'],
      areas_for_improvement: ['Audio analysis unavailable — coach report used instead'],
    };
  }
}
