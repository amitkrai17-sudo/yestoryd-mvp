// ============================================================
// FILE: app/api/assessment/retry/route.ts
// ============================================================
// Retries failed assessments from pending_assessments table
// Called by QStash with 5-minute delay after all AI providers fail
// Max 3 retries before marking as permanently failed
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding, buildSearchableContent } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_RETRIES = 3;

// Same provider chain as analyze/route.ts
interface AIProvider {
  name: string;
  model: string;
  type: 'gemini' | 'openai';
}

const AI_PROVIDERS: AIProvider[] = [
  { name: 'gemini-flash-lite', model: 'gemini-2.5-flash-lite', type: 'gemini' },
  { name: 'gemini-flash', model: 'gemini-2.5-flash', type: 'gemini' },
  { name: 'openai-gpt4o-mini', model: 'gpt-4o-mini', type: 'openai' },
];

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const supabase = getServiceSupabase();

  // Verify QStash or internal auth
  const qstashSignature = request.headers.get('upstash-signature');
  const internalKey = request.headers.get('x-internal-api-key');
  if (!qstashSignature && !(process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { pendingAssessmentId } = body;
  if (!pendingAssessmentId) {
    return NextResponse.json({ error: 'Missing pendingAssessmentId' }, { status: 400 });
  }

  // Fetch pending assessment
  const { data: pending, error: fetchError } = await supabase
    .from('pending_assessments')
    .select('*')
    .eq('id', pendingAssessmentId)
    .maybeSingle();

  if (fetchError || !pending) {
    console.error(JSON.stringify({ requestId, event: 'pending_assessment_not_found', pendingAssessmentId }));
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (pending.status === 'completed') {
    return NextResponse.json({ success: true, message: 'Already completed' });
  }

  if (pending.retry_count >= MAX_RETRIES) {
    await supabase.from('pending_assessments').update({
      status: 'failed',
      error_message: `Exceeded max retries (${MAX_RETRIES})`,
      processed_at: new Date().toISOString(),
    }).eq('id', pendingAssessmentId);

    console.error(JSON.stringify({ requestId, event: 'assessment_retry_exhausted', pendingAssessmentId }));
    return NextResponse.json({ success: false, message: 'Max retries exceeded' });
  }

  // Mark as processing
  await supabase.from('pending_assessments').update({
    status: 'processing',
    retry_count: pending.retry_count + 1,
  }).eq('id', pendingAssessmentId);

  console.log(JSON.stringify({
    requestId,
    event: 'assessment_retry_start',
    pendingAssessmentId,
    attempt: pending.retry_count + 1,
  }));

  // Build prompt (same as analyze/route.ts)
  const { child_name: name, child_age: age, passage, audio_data: audioData } = pending;
  const wordCount = passage.split(' ').length;

  const analysisPrompt = buildAnalysisPrompt(name, age, passage, wordCount);

  // Try provider chain
  let analysisResult: any = null;
  let aiProviderUsed = 'none';
  const providerErrors: string[] = [];

  for (const provider of AI_PROVIDERS) {
    try {
      console.log(JSON.stringify({ requestId, event: 'retry_trying_provider', provider: provider.name }));

      let responseText: string;

      if (provider.type === 'gemini') {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: provider.model });
        const result = await model.generateContent([
          { inlineData: { mimeType: 'audio/webm', data: audioData } },
          { text: analysisPrompt },
        ]);
        responseText = result.response.text();
      } else {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: 'You are a reading assessment specialist. Respond ONLY with valid JSON.' },
              { role: 'user', content: analysisPrompt },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
        const data = await res.json();
        responseText = data.choices[0].message.content;
      }

      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
      aiProviderUsed = provider.name;

      console.log(JSON.stringify({ requestId, event: 'retry_provider_success', provider: provider.name }));
      break;
    } catch (err) {
      const errMsg = (err as Error).message;
      providerErrors.push(`${provider.name}: ${errMsg}`);
      console.error(JSON.stringify({ requestId, event: 'retry_provider_failed', provider: provider.name, error: errMsg }));
      continue;
    }
  }

  // Still failed — requeue if under max retries
  if (!analysisResult) {
    const newRetryCount = pending.retry_count + 1;
    await supabase.from('pending_assessments').update({
      status: 'pending',
      error_message: providerErrors.join('; '),
    }).eq('id', pendingAssessmentId);

    if (newRetryCount < MAX_RETRIES) {
      try {
        const { queueAssessmentRetry } = await import('@/lib/qstash');
        await queueAssessmentRetry({ pendingAssessmentId, requestId });
      } catch (qErr) {
        console.error(JSON.stringify({ requestId, event: 'requeue_failed', error: (qErr as Error).message }));
      }
    }

    return NextResponse.json({ success: false, retried: true, attempt: newRetryCount });
  }

  // SUCCESS — Save results to DB and email parent
  const clarityScore = Math.min(10, Math.max(1, analysisResult.clarity_score || 5));
  const fluencyScore = Math.min(10, Math.max(1, analysisResult.fluency_score || 5));
  const speedScore = Math.min(10, Math.max(1, analysisResult.speed_score || 5));
  const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

  // Update pending_assessments as completed
  await supabase.from('pending_assessments').update({
    status: 'completed',
    result: analysisResult,
    ai_provider_used: aiProviderUsed,
    processed_at: new Date().toISOString(),
    error_message: null,
  }).eq('id', pendingAssessmentId);

  // Find or create child record
  let childId: string | null = null;
  try {
    const { data: existingChild } = await supabase
      .from('children')
      .select('id')
      .eq('name', name)
      .eq('parent_email', pending.parent_email)
      .maybeSingle();

    if (existingChild) {
      childId = existingChild.id;
      await supabase.from('children').update({
        latest_assessment_score: overallScore,
        assessment_completed_at: new Date().toISOString(),
        phonics_focus: analysisResult.phonics_analysis?.recommended_focus || null,
        struggling_phonemes: analysisResult.phonics_analysis?.struggling_phonemes || [],
      }).eq('id', childId);
    } else {
      const { data: newChild } = await supabase.from('children').insert({
        name,
        child_name: name,
        age,
        parent_name: pending.parent_name,
        parent_email: pending.parent_email,
        parent_phone: pending.parent_phone,
        lead_status: 'assessed',
        latest_assessment_score: overallScore,
        assessment_completed_at: new Date().toISOString(),
        phonics_focus: analysisResult.phonics_analysis?.recommended_focus || null,
        struggling_phonemes: analysisResult.phonics_analysis?.struggling_phonemes || [],
        lead_source: pending.lead_source || 'yestoryd',
        lead_source_coach_id: pending.lead_source_coach_id || null,
        referral_code_used: pending.referral_code_used || null,
      }).select('id').single();
      childId = newChild?.id || null;
    }
  } catch (dbErr) {
    console.error(JSON.stringify({ requestId, event: 'retry_db_error', error: (dbErr as Error).message }));
  }

  // Save learning event
  if (childId) {
    try {
      const eventData = {
        score: overallScore,
        child_age: age,
        passage_preview: passage.substring(0, 80),
        wpm: analysisResult.wpm,
        completeness: analysisResult.completeness_percentage,
        feedback: analysisResult.feedback,
        errors: analysisResult.errors,
        strengths: analysisResult.strengths,
        areas_to_improve: analysisResult.areas_to_improve,
        clarity_score: clarityScore,
        fluency_score: fluencyScore,
        speed_score: speedScore,
        error_classification: analysisResult.error_classification,
        phonics_analysis: analysisResult.phonics_analysis,
        skill_breakdown: analysisResult.skill_breakdown,
        practice_recommendations: analysisResult.practice_recommendations,
        source: 'retry',
        ai_provider_used: aiProviderUsed,
      };

      const searchableContent = buildSearchableContent('assessment', name, eventData, analysisResult.feedback);
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(searchableContent);
      } catch { /* non-critical */ }

      const fluencyDesc = fluencyScore >= 7 ? 'smooth' : fluencyScore >= 5 ? 'moderate' : 'developing';
      const phonicsFocus = analysisResult.phonics_analysis?.recommended_focus || 'general practice';
      const aiSummary = `${name} scored ${overallScore}/10 with ${fluencyDesc} fluency at ${analysisResult.wpm} WPM. Focus area: ${phonicsFocus}. ${analysisResult.strengths?.[0] || 'Showed good effort'}.`;

      await supabase.from('learning_events').insert({
        child_id: childId,
        event_type: 'assessment',
        event_date: new Date().toISOString(),
        event_data: eventData,
        ai_summary: aiSummary,
        content_for_embedding: searchableContent,
        embedding,
      });
    } catch (eventErr) {
      console.error(JSON.stringify({ requestId, event: 'retry_learning_event_failed', error: (eventErr as Error).message }));
    }
  }

  // Email results to parent
  try {
    await sendResultsEmail(pending.parent_email, pending.parent_name || 'Parent', name, {
      overallScore, clarityScore, fluencyScore, speedScore,
      wpm: analysisResult.wpm,
      feedback: analysisResult.feedback,
      strengths: analysisResult.strengths || [],
      areas_to_improve: analysisResult.areas_to_improve || [],
    });
  } catch (emailErr) {
    console.error(JSON.stringify({ requestId, event: 'retry_email_failed', error: (emailErr as Error).message }));
  }

  console.log(JSON.stringify({
    requestId,
    event: 'assessment_retry_complete',
    pendingAssessmentId,
    aiProviderUsed,
    overallScore,
    childId,
  }));

  return NextResponse.json({ success: true, aiProviderUsed, overallScore, childId });
}

// --- Send results email via SendGrid ---
async function sendResultsEmail(
  parentEmail: string,
  parentName: string,
  childName: string,
  scores: {
    overallScore: number;
    clarityScore: number;
    fluencyScore: number;
    speedScore: number;
    wpm: number;
    feedback: string;
    strengths: string[];
    areas_to_improve: string[];
  }
) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: parentEmail, name: parentName }] }],
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd Academy' },
      subject: `${childName}'s Reading Assessment Results Are Ready!`,
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1e293b;">Reading Assessment Results for ${childName}</h2>
            <p>Hi ${parentName},</p>
            <p>${childName}'s reading assessment has been analyzed. Here are the results:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Overall Score</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${scores.overallScore}/10</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Clarity</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${scores.clarityScore}/10</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Fluency</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${scores.fluencyScore}/10</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Speed</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${scores.speedScore}/10</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">Words/Min</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${scores.wpm}</td></tr>
            </table>
            <p><strong>Feedback:</strong> ${scores.feedback}</p>
            ${scores.strengths.length ? `<p><strong>Strengths:</strong> ${scores.strengths.join(', ')}</p>` : ''}
            ${scores.areas_to_improve.length ? `<p><strong>Areas to Improve:</strong> ${scores.areas_to_improve.join(', ')}</p>` : ''}
            <p style="margin-top:24px;">
              <a href="https://yestoryd.com/lets-talk?source=retry_email" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Talk to a Coach</a>
            </p>
            <p style="color:#64748b;margin-top:16px;">Team Yestoryd</p>
          </div>`,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid error: ${response.status}`);
  }
}

// --- Build analysis prompt (mirrors analyze/route.ts) ---
function buildAnalysisPrompt(name: string, age: number, passage: string, wordCount: number): string {
  let guidance: string;
  if (age <= 5) {
    guidance = `Assessment context: ${age}-year-old (early reader). Expected skills: letter recognition, simple CVC words, basic sight words. Benchmark: Reading 60%+ of age-appropriate passage with support is typical.`;
  } else if (age <= 8) {
    guidance = `Assessment context: ${age}-year-old (developing reader). Expected skills: Blending sounds, common sight words, simple sentences. Benchmark: Reading 70%+ of passage with developing fluency is typical.`;
  } else if (age <= 11) {
    guidance = `Assessment context: ${age}-year-old (intermediate reader). Expected skills: Multi-syllable words, expression, self-correction. Benchmark: Reading 75%+ of passage with reasonable fluency is expected.`;
  } else {
    guidance = `Assessment context: ${age}-year-old (advancing reader). Expected skills: Complex vocabulary, expression, comprehension. Benchmark: Reading 80%+ of passage fluently is expected.`;
  }

  return `
You are a reading assessment specialist. Your task is to ACCURATELY analyze a ${age}-year-old child named ${name} reading aloud.

PASSAGE THE CHILD WAS ASKED TO READ:
"${passage}"
(Word count: ${wordCount} words)

PRIMARY OBJECTIVE: ACCURACY

AGE CONTEXT:
${guidance}

SCORING SCALE (1-10):
- 9-10: Reads fluently with minimal errors
- 7-8: Reads well with occasional errors
- 5-6: Developing reader, noticeable errors
- 3-4: Struggling reader, frequent errors
- 1-2: Early emergent reader

Respond ONLY with valid JSON:
{
    "clarity_score": <integer 1-10>,
    "fluency_score": <integer 1-10>,
    "speed_score": <integer 1-10>,
    "wpm": <integer>,
    "completeness_percentage": <integer 0-100>,
    "error_classification": {
        "substitutions": [{"original": "word", "read_as": "what_said"}],
        "omissions": ["words skipped"],
        "insertions": ["words added"],
        "reversals": [{"original": "was", "read_as": "saw"}],
        "mispronunciations": [{"word": "word", "issue": "description"}]
    },
    "phonics_analysis": {
        "struggling_phonemes": [],
        "phoneme_details": [{"phoneme": "th", "examples": [], "frequency": "frequent"}],
        "strong_phonemes": [],
        "recommended_focus": "Primary area to practice"
    },
    "skill_breakdown": {
        "decoding": {"score": 1, "notes": ""},
        "sight_words": {"score": 1, "notes": ""},
        "blending": {"score": 1, "notes": ""},
        "segmenting": {"score": 1, "notes": ""},
        "expression": {"score": 1, "notes": ""},
        "comprehension_indicators": {"score": 1, "notes": ""}
    },
    "practice_recommendations": {
        "daily_words": [],
        "phonics_focus": "",
        "suggested_activity": ""
    },
    "feedback": "4 sentences about ${name}'s performance",
    "errors": [],
    "strengths": [],
    "areas_to_improve": []
}`;
}
