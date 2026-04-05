// ============================================================
// POST /api/parent/reading-test/analyze
// Receives audio + passage → Gemini analysis → score → store → XP
// Reuses the micro-assessment pipeline and assessment prompts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import { safeParseGeminiJSON } from '@/lib/gemini/safe-parse';
import { getAgeConfig, getAntiHallucinationRules } from '@/lib/gemini/assessment-prompts';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await requireAuth();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { taskId, passageId, passageText, audioBase64, audioDurationSeconds } = await request.json();

    if (!taskId || !passageText || !audioBase64) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get task + child
    const { data: task } = await supabase
      .from('parent_daily_tasks')
      .select('id, child_id')
      .eq('id', taskId)
      .single();

    if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, parent_email, parent_id')
      .eq('id', task.child_id)
      .single();

    if (!child) return NextResponse.json({ success: false, error: 'Child not found' }, { status: 404 });

    // Verify parent
    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase.from('parents').select('id').eq('email', auth.email ?? '').maybeSingle();
      if (!parent || child.parent_id !== parent.id) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const childAge = child.age || 7;
    const childName = child.child_name || 'Child';
    const ageConfig = getAgeConfig(childAge);
    const wordCount = passageText.split(/\s+/).filter(Boolean).length;

    // Build assessment prompt (reuse assessment-prompts pattern)
    const prompt = `You are a reading assessment specialist evaluating a child's oral reading.

CHILD: ${childName}, age ${childAge}
AGE CONTEXT (${ageConfig.level}): ${ageConfig.guidance}

PASSAGE (${wordCount} words):
"${passageText.substring(0, 2000)}"

${getAntiHallucinationRules(childName)}

Listen to the audio and evaluate:
1. Clarity (1-10): How clearly words are pronounced
2. Fluency (1-10): Smoothness of reading (not word-by-word)
3. Speed (1-10): Appropriate pace for age ${childAge}
4. WPM: Estimated words per minute
5. Fluency rating: "Poor" | "Fair" | "Good" | "Excellent"

Respond ONLY with valid JSON:
{
  "clarity_score": 7,
  "fluency_score": 6,
  "speed_score": 7,
  "wpm": 55,
  "fluency_rating": "Good",
  "errors": ["specific words mispronounced"],
  "strengths": ["what they did well"],
  "areas_to_improve": ["what to practice"]
}`;

    // Call Gemini with audio
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('reading_level') });

    let analysisResult: any;
    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
      });

      analysisResult = safeParseGeminiJSON(result.response.text());
    } catch (geminiErr: any) {
      console.error(JSON.stringify({ requestId, event: 'reading_test_gemini_error', error: geminiErr.message }));
      // Fallback
      analysisResult = { clarity_score: 5, fluency_score: 5, speed_score: 5, wpm: 40, fluency_rating: 'Fair', errors: [], strengths: [], areas_to_improve: [] };
    }

    if (!analysisResult) {
      analysisResult = { clarity_score: 5, fluency_score: 5, speed_score: 5, wpm: 40, fluency_rating: 'Fair', errors: [], strengths: [], areas_to_improve: [] };
    }

    // Server-side score: (clarity * 0.35) + (fluency * 0.40) + (speed * 0.25)
    const clarity = Math.min(10, Math.max(1, analysisResult.clarity_score || 5));
    const fluency = Math.min(10, Math.max(1, analysisResult.fluency_score || 5));
    const speed = Math.min(10, Math.max(1, analysisResult.speed_score || 5));
    const overallScore = Math.round((clarity * 0.35 + fluency * 0.40 + speed * 0.25) * 10) / 10;

    // Server-validated WPM
    let wpm = analysisResult.wpm || 0;
    if (audioDurationSeconds && audioDurationSeconds > 5) {
      const serverWpm = Math.round((wordCount / audioDurationSeconds) * 60);
      if (serverWpm >= 5 && serverWpm <= 200) wpm = serverWpm;
    }

    const fluencyRating = ['Poor', 'Fair', 'Good', 'Excellent'].includes(analysisResult.fluency_rating)
      ? analysisResult.fluency_rating : 'Fair';

    // Store in micro_assessments
    const { data: assessment } = await supabase
      .from('micro_assessments')
      .insert({
        child_id: child.id,
        triggered_by: 'homework',
        passage_id: passageId || null,
        passage_text: passageText.substring(0, 5000),
        audio_url: null,
        audio_duration_seconds: audioDurationSeconds || null,
        gemini_analysis: analysisResult,
        estimated_wpm: wpm,
        fluency_rating: fluencyRating,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    // Update children table
    await supabase
      .from('children')
      .update({
        latest_assessment_score: overallScore,
        assessment_completed_at: new Date().toISOString(),
        assessment_wpm: wpm,
      })
      .eq('id', child.id);

    // Get previous score for progress comparison
    const { data: prevTests } = await supabase
      .from('micro_assessments')
      .select('gemini_analysis, created_at')
      .eq('child_id', child.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(1, 1);

    const previousScore = prevTests?.[0]
      ? (() => {
          const prev = prevTests[0].gemini_analysis as any;
          if (!prev) return null;
          const pc = Math.min(10, Math.max(1, prev.clarity_score || 5));
          const pf = Math.min(10, Math.max(1, prev.fluency_score || 5));
          const ps = Math.min(10, Math.max(1, prev.speed_score || 5));
          return Math.round((pc * 0.35 + pf * 0.40 + ps * 0.25) * 10) / 10;
        })()
      : null;

    const improved = previousScore !== null && overallScore > previousScore;
    const xpEarned = 50 + (improved ? 25 : 0);

    // Create learning event
    try {
      await insertLearningEvent({
        childId: child.id,
        eventType: 'micro_assessment',
        eventData: {
          source: 'homework_reading_test',
          overall_score: overallScore,
          clarity, fluency, speed, wpm,
          fluency_rating: fluencyRating,
          improvement: previousScore ? overallScore - previousScore : null,
          errors: analysisResult.errors,
          strengths: analysisResult.strengths,
        },
        contentForEmbedding: `${childName} reading test. Score: ${overallScore}/10 (clarity: ${clarity}, fluency: ${fluency}, speed: ${speed}). WPM: ${wpm}. Rating: ${fluencyRating}.${previousScore ? ` Previous: ${previousScore}/10.` : ''}`,
        signalSource: 'micro_assessment',
        signalConfidence: 'high',
        eventDate: new Date().toISOString().split('T')[0],
      });
    } catch (leErr: any) {
      console.error(JSON.stringify({ requestId, event: 'reading_test_le_error', error: leErr.message }));
    }

    // Auto-complete the task
    await supabase
      .from('parent_daily_tasks')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', taskId);

    return NextResponse.json({
      success: true,
      score: overallScore,
      clarity, fluency, speed, wpm,
      fluency_rating: fluencyRating,
      xp_earned: xpEarned,
      progress: previousScore !== null ? {
        previous_score: previousScore,
        previous_date: prevTests?.[0]?.created_at,
        improvement: Math.round((overallScore - previousScore) * 10) / 10,
      } : null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'reading_test_analyze_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Analysis failed' }, { status: 500 });
  }
}
