// app/api/coach-assessment/calculate-score/route.ts
// FIXED: temperature=0 for consistent scores + caching to prevent recalculation
// SECURITY: Validates applicationId exists before expensive Gemini calls

import { getGenAI } from '@/lib/gemini/client';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/utils/rate-limiter';
import { loadCoachConfig } from '@/lib/config/loader';
import { getGeminiModel } from '@/lib/gemini-config';
import { buildCoachAssessmentScorePrompt } from '@/lib/gemini/assessment-prompts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute per IP (expensive Gemini calls)
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`score:${clientId}`, { maxRequests: 5, windowMs: 60000 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  console.log('🎯 Calculate score API called');

  try {
    const { applicationId, forceRecalculate = false } = await request.json();
    
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch application
    const { data: application, error: fetchError } = await supabase
      .from('coach_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (fetchError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    console.log('📝 Application:', application.name);

    // ========== CHECK FOR CACHED SCORE ==========
    // If score already exists and not forcing recalculate, return cached
    if (!forceRecalculate && application.ai_total_score && application.ai_score_breakdown) {
      console.log('📦 Returning CACHED score:', application.ai_total_score);
      const cachedSettings = await loadCoachConfig();
      const breakdown = application.ai_score_breakdown as any;
      return NextResponse.json({
        success: true,
        cached: true,
        applicationId,
        scores: {
          voice: breakdown.voiceScore || 0,
          voiceAnalysis: breakdown.voiceAnalysis || {},
          rai: breakdown.raiScore || 0,
          raiAnalysis: breakdown.raiAnalysis || {},
          combined: application.ai_total_score,
          isQualified: breakdown.isQualified || application.ai_total_score >= cachedSettings.assessmentPassScore,
          threshold: cachedSettings.assessmentPassScore
        }
      });
    }

    console.log('🔄 Calculating NEW score...');
    console.log('📝 Audio duration:', application.audio_duration_seconds, 'seconds');

    // ========== VOICE ANALYSIS WITH GEMINI ==========
    let voiceScore = 0;
    let voiceAnalysis: any = {
      contentRelevance: 0,
      clarity: 0,
      passion: 0,
      professionalism: 0,
      durationPenalty: 0,
      strengths: [],
      concerns: [],
      notes: 'No voice recording'
    };

    const duration = application.audio_duration_seconds || 0;

    if (!application.audio_statement_url) {
      voiceScore = 0;
      voiceAnalysis.notes = 'No voice recording submitted';
    } else if (duration < 20) {
      voiceScore = 1;
      voiceAnalysis.notes = `Recording too short (${duration}s). Minimum 20 seconds required.`;
      voiceAnalysis.durationPenalty = -3;
      voiceAnalysis.concerns = ['Recording too brief to assess properly'];
      console.log('🎤 Voice too short, skipping AI analysis');
    } else {
      console.log('🎤 Analyzing voice with Gemini...');
      
      try {
        const audioResponse = await fetch(application.audio_statement_url);
        
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          const audioBase64 = Buffer.from(audioBuffer).toString('base64');
          const contentType = audioResponse.headers.get('content-type') || 'audio/webm';
          
          const model = getGenAI().getGenerativeModel({
            model: getGeminiModel('assessment_analysis'),
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          });

          const voicePrompt = buildCoachAssessmentScorePrompt({
            type: 'voice',
            durationSeconds: duration,
          });

          // Retry helper: attempt Gemini call, parse JSON, retry once on failure
          const callGeminiVoice = async () => {
            const result = await model.generateContent({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: voicePrompt },
                    { inlineData: { mimeType: contentType, data: audioBase64 } }
                  ]
                }
              ],
            });
            return result.response.text().trim();
          };

          const tryParseVoiceJson = (raw: string): Record<string, any> => {
            let cleanJson = raw;
            // Strip markdown fences
            if (cleanJson.startsWith('```')) {
              cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            // Extract JSON object if surrounded by text
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanJson = jsonMatch[0];
            }
            try {
              return JSON.parse(cleanJson);
            } catch {
              // JSON repair: try fixing common truncation (missing closing braces/brackets)
              let repaired = cleanJson;
              const openBraces = (repaired.match(/\{/g) || []).length;
              const closeBraces = (repaired.match(/\}/g) || []).length;
              const openBrackets = (repaired.match(/\[/g) || []).length;
              const closeBrackets = (repaired.match(/\]/g) || []).length;
              for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
              for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
              // Remove trailing comma before closing brace/bracket
              repaired = repaired.replace(/,\s*([}\]])/g, '$1');
              return JSON.parse(repaired);
            }
          };

          let responseText = '';
          let parsed: Record<string, any> | null = null;

          // Attempt 1
          responseText = await callGeminiVoice();
          console.log('[VoiceAnalysis] Gemini raw response:', responseText);

          try {
            parsed = tryParseVoiceJson(responseText);
          } catch (firstParseErr) {
            console.error('[VoiceAnalysis] Parse attempt 1 failed, retrying Gemini call...');

            // Attempt 2: retry the Gemini call
            try {
              responseText = await callGeminiVoice();
              console.log('[VoiceAnalysis] Retry raw response:', responseText);
              parsed = tryParseVoiceJson(responseText);
            } catch (retryErr) {
              console.error('[VoiceAnalysis] Parse attempt 2 also failed:', retryErr);
              console.error('[VoiceAnalysis] Final raw response:', responseText);
            }
          }

          if (parsed) {
            voiceAnalysis = {
              contentRelevance: parsed.contentRelevance || 1,
              clarity: parsed.clarity || 1,
              passion: parsed.passion || 1,
              professionalism: parsed.professionalism || 1,
              strengths: parsed.strengths || [],
              concerns: parsed.concerns || [],
              notes: parsed.summary || 'Voice analyzed'
            };

            let rawScore = parsed.averageScore ||
              ((voiceAnalysis.contentRelevance + voiceAnalysis.clarity +
                voiceAnalysis.passion + voiceAnalysis.professionalism) / 4);

            let durationPenalty = 0;
            if (duration < 30) durationPenalty = -1;
            else if (duration < 45) durationPenalty = -0.5;

            voiceAnalysis.durationPenalty = durationPenalty;
            voiceScore = Math.max(1, Math.round((rawScore + durationPenalty) * 10) / 10);
          } else {
            // All parsing failed — use conservative middle score, flag for manual review
            voiceScore = 2.5;
            voiceAnalysis.notes = 'Voice analysis pending manual review (AI response unparseable)';
            voiceAnalysis.manualReviewRequired = true;
            voiceAnalysis.contentRelevance = 2.5;
            voiceAnalysis.clarity = 2.5;
            voiceAnalysis.passion = 2.5;
            voiceAnalysis.professionalism = 2.5;
          }
        } else {
          voiceScore = 1;
          voiceAnalysis.notes = 'Could not access audio file';
        }
      } catch (voiceErr) {
        console.error('Voice analysis error:', voiceErr);
        voiceScore = 2;
        voiceAnalysis.notes = 'Voice analysis error';
      }
    }

    console.log(`🎤 Voice Score: ${voiceScore}/5`);
    console.log(`   Content: ${voiceAnalysis.contentRelevance}, Clarity: ${voiceAnalysis.clarity}`);
    console.log(`   Passion: ${voiceAnalysis.passion}, Professional: ${voiceAnalysis.professionalism}`);

    // ========== rAI CHAT ANALYSIS WITH GEMINI ==========
    let raiScore = 0;
    let raiAnalysis: any = {
      q1_empathy: 0,
      q2_communication: 0,
      q3_sensitivity: 0,
      q4_honesty: 0,
      overallAssessment: 'No responses',
      strengths: [],
      concerns: [],
      recommendation: 'NO'
    };

    const responses = application.ai_responses;
    
    if (responses && Array.isArray(responses) && responses.length > 0) {
      console.log('💬 Analyzing chat responses with Gemini...');
      console.log('💬 Total messages:', responses.length);
      
      const userResponses = responses.filter((r: any) => r.role === 'user');
      console.log('💬 User responses:', userResponses.length);
      
      if (userResponses.length === 0) {
        raiScore = 0;
        raiAnalysis.overallAssessment = 'No user responses found';
      } else {
        try {
          let conversationText = '';
          responses.forEach((msg: any) => {
            const role = msg.role === 'assistant' ? 'rAI (Interviewer)' : 'APPLICANT';
            conversationText += `\n[${role}]:\n${msg.content}\n`;
          });

          console.log('💬 Conversation length:', conversationText.length, 'chars');

          const chatModel = getGenAI().getGenerativeModel({
            model: getGeminiModel('assessment_analysis'),
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          });

          const chatPrompt = buildCoachAssessmentScorePrompt({
            type: 'chat',
            conversationText,
          });

          const result = await chatModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: chatPrompt }] }],
          });

          const responseText = result.response.text().trim();
          console.log('💬 Gemini chat response:', responseText.substring(0, 200) + '...');
          
          try {
            let cleanJson = responseText;
            if (cleanJson.startsWith('```')) {
              cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanJson = jsonMatch[0];
            }
            
            const parsed = JSON.parse(cleanJson);
            raiAnalysis = {
              q1_empathy: parsed.q1_empathy || 1,
              q2_communication: parsed.q2_communication || 1,
              q3_sensitivity: parsed.q3_sensitivity || 1,
              q4_honesty: parsed.q4_honesty || 1,
              overallAssessment: parsed.overallAssessment || 'Assessment complete',
              strengths: parsed.strengths || [],
              concerns: parsed.concerns || [],
              recommendation: parsed.recommendation || 'MAYBE'
            };
            
            raiScore = parsed.averageScore || 
              ((raiAnalysis.q1_empathy + raiAnalysis.q2_communication + 
                raiAnalysis.q3_sensitivity + raiAnalysis.q4_honesty) / 4);
            raiScore = Math.round(raiScore * 10) / 10;
            
          } catch (parseErr) {
            console.error('Failed to parse chat analysis:', parseErr);
            console.error('Response was:', responseText.substring(0, 500));
            
            const avgWords = userResponses.reduce((sum: number, r: any) => 
              sum + (r.content?.split(/\s+/).length || 0), 0) / userResponses.length;
            
            raiScore = avgWords >= 30 ? 3 : avgWords >= 15 ? 2.5 : 2;
            raiAnalysis.overallAssessment = `AI parsing failed. Fallback score based on ${Math.round(avgWords)} avg words/response.`;
            raiAnalysis.q1_empathy = raiScore;
            raiAnalysis.q2_communication = raiScore;
            raiAnalysis.q3_sensitivity = raiScore;
            raiAnalysis.q4_honesty = raiScore;
          }
        } catch (chatErr) {
          console.error('Chat analysis error:', chatErr);
          raiScore = 2;
          raiAnalysis.overallAssessment = 'Chat analysis error';
        }
      }
    } else {
      raiScore = 0;
      raiAnalysis.overallAssessment = 'No chat responses to analyze';
      console.log('❌ No AI responses found in application');
    }

    console.log(`💬 rAI Score: ${raiScore}/5`);
    console.log(`   Q1 Empathy: ${raiAnalysis.q1_empathy}`);
    console.log(`   Q2 Communication: ${raiAnalysis.q2_communication}`);
    console.log(`   Q3 Sensitivity: ${raiAnalysis.q3_sensitivity}`);
    console.log(`   Q4 Honesty: ${raiAnalysis.q4_honesty}`);
    console.log(`   Recommendation: ${raiAnalysis.recommendation}`);

    // ========== COMBINED SCORE ==========
    const settings = await loadCoachConfig();
    const combinedScore = Math.round((voiceScore + raiScore) * 10) / 10;

    const isQualified = combinedScore >= settings.assessmentPassScore &&
      raiAnalysis.recommendation !== 'STRONG_NO' &&
      voiceScore >= 2 &&
      raiScore >= 2;

    console.log(`📊 Combined: ${combinedScore}/10 - ${isQualified ? '✅ Qualified' : '❌ Not Qualified'}`);

    // ========== UPDATE DATABASE (Cache the score) ==========
    const updatePayload: any = {
      ai_total_score: combinedScore,
      ai_score_breakdown: {
        voiceScore,
        voiceAnalysis,
        raiScore,
        raiAnalysis,
        combinedScore,
        isQualified,
        calculatedAt: new Date().toISOString(),
        model: getGeminiModel('assessment_analysis')
      },
      updated_at: new Date().toISOString()
    };

    if (['applied', 'ai_assessment_complete', 'started'].includes(application.status)) {
      if (isQualified) {
        updatePayload.status = 'qualified';
      } else if (combinedScore >= (settings.assessmentPassScore - 1) && voiceScore >= 1.5 && raiScore >= 1.5) {
        // Borderline: within 1 point of pass threshold with minimum sub-scores
        updatePayload.status = 'waitlist';
      } else {
        updatePayload.status = 'not_qualified';
      }
    }

    // Extract red flags from AI analysis
    const allConcerns = [
      ...(voiceAnalysis.concerns || []),
      ...(raiAnalysis.concerns || []),
    ].filter(Boolean);

    if (allConcerns.length > 0) {
      updatePayload.has_red_flags = true;
      updatePayload.red_flag_summary = allConcerns;
      // Severity based on recommendation and score
      if (raiAnalysis.recommendation === 'STRONG_NO' || combinedScore < 3) {
        updatePayload.red_flag_severity = 'critical';
      } else if (raiAnalysis.recommendation === 'NO' || combinedScore < 4) {
        updatePayload.red_flag_severity = 'high';
      } else if (allConcerns.length >= 3) {
        updatePayload.red_flag_severity = 'medium';
      } else {
        updatePayload.red_flag_severity = 'low';
      }
    }

    const { error: updateError } = await supabase
      .from('coach_applications')
      .update(updatePayload)
      .eq('id', applicationId);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      await supabase
        .from('coach_applications')
        .update({
          ai_total_score: combinedScore,
          status: updatePayload.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
    } else {
      console.log('✅ Score cached to database');
    }

    return NextResponse.json({
      success: true,
      cached: false,
      applicationId,
      scores: {
        voice: voiceScore,
        voiceAnalysis,
        rai: raiScore,
        raiAnalysis,
        combined: combinedScore,
        isQualified,
        threshold: settings.assessmentPassScore
      }
    });

  } catch (error: any) {
    console.error('💥 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}