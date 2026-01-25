// app/api/coach-assessment/calculate-score/route.ts
// FIXED: temperature=0 for consistent scores + caching to prevent recalculation

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  console.log('🎯 Calculate score API called');
  
  try {
    const { applicationId, forceRecalculate = false } = await request.json();
    
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
      const breakdown = application.ai_score_breakdown;
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
          isQualified: breakdown.isQualified || application.ai_total_score >= 6,
          threshold: 6
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
          
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          
          const voicePrompt = `You are evaluating a voice statement from someone applying to be a children's reading coach at Yestoryd.

THE QUESTION THEY WERE ASKED:
"Please record a 1-2 minute audio introducing yourself. Tell us why you want to become a reading coach for children, what experience you have with kids, and what makes you passionate about helping children read better."

RECORDING DURATION: ${duration} seconds

Listen to this audio and evaluate:

1. CONTENT RELEVANCE (1-5): Did they actually answer the question?
   - Did they explain WHY they want to be a reading coach?
   - Did they mention experience with children?
   - Did they express passion for helping children read?
   5 = Addressed all 3 points thoroughly
   3 = Addressed 1-2 points
   1 = Didn't address the question at all

2. CLARITY & ARTICULATION (1-5): Can you understand them clearly?
   5 = Crystal clear, excellent pronunciation
   3 = Understandable with some issues
   1 = Hard to understand

3. PASSION & ENTHUSIASM (1-5): Do they sound genuinely excited about teaching children?
   5 = Clearly passionate, engaging, warm
   3 = Neutral, professional but not excited
   1 = Sounds bored or disinterested

4. PROFESSIONALISM (1-5): Overall impression
   5 = Would trust this person with my child immediately
   3 = Acceptable, needs some improvement
   1 = Concerning, wouldn't hire

DURATION ASSESSMENT:
- 60-120 seconds: Ideal (no penalty)
- 45-60 seconds: Acceptable (no penalty)
- 30-45 seconds: Slightly brief (-0.5 penalty)
- 20-30 seconds: Too brief (-1 penalty)
- >120 seconds: Long but okay if relevant (no penalty)

IMPORTANT: Be strict. A short, vague recording should NOT score above 2.
If they just said "hello" or gave a one-liner, score 1 for content.

Return ONLY valid JSON (no markdown, no explanation):
{"contentRelevance": X, "clarity": X, "passion": X, "professionalism": X, "averageScore": X.X, "strengths": ["str1"], "concerns": ["con1"], "summary": "1-2 sentence assessment"}`;

          // KEY FIX: Add temperature: 0 for consistent output
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
            generationConfig: {
              temperature: 0,  // CRITICAL: Zero temperature for deterministic output
              maxOutputTokens: 500
            }
          });

          const responseText = result.response.text().trim();
          console.log('🎤 Gemini voice response:', responseText);
          
          try {
            let cleanJson = responseText;
            if (cleanJson.startsWith('```')) {
              cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            
            const parsed = JSON.parse(cleanJson);
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
            
          } catch (parseErr) {
            console.error('Failed to parse voice analysis:', parseErr);
            voiceScore = duration >= 45 ? 2.5 : 1.5;
            voiceAnalysis.notes = 'AI analysis failed';
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

          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          
          const chatPrompt = `You are evaluating a coaching applicant's responses. They want to become a children's reading coach at Yestoryd.

Here is the COMPLETE conversation between rAI (interviewer) and the Applicant:

===== CONVERSATION START =====
${conversationText}
===== CONVERSATION END =====

Based on the applicant's responses, rate them on these 4 behavioral scenarios (1-5 each):

Q1 - EMPATHY (handling frustrated child):
Look for: Understanding, encouragement, patience, child-centric approach
Red flags: Criticism, blame, adult-centric, dismissive
Score: 5=Excellent empathy, 3=Generic response, 1=Poor/concerning

Q2 - COMMUNICATION (handling disappointed parent):
Look for: Professional, accountable, solution-focused, collaborative
Red flags: Defensive, blaming, dismissive of concerns
Score: 5=Excellent communication, 3=Acceptable, 1=Poor

Q3 - SENSITIVITY (handling withdrawn child):
Look for: Observant, patient, creates safe space, respects child's pace
Red flags: Pushy, ignores emotional state, forces participation
Score: 5=Highly sensitive, 3=Average, 1=Insensitive

Q4 - HONESTY (handling guarantee request):
Look for: Realistic expectations, honest about outcomes, no over-promising
Red flags: Over-promising, guarantees results, misleading
Score: 5=Honest and realistic, 3=Vague, 1=Over-promises

IMPORTANT SCORING RULES:
- Be strict and fair
- Very short responses (1-2 words) = Score 1-2
- Generic/textbook responses = Score 2-3
- Thoughtful, specific responses = Score 4-5
- If a question wasn't answered, score 1

Return ONLY this JSON structure (no other text):
{"q1_empathy": X, "q2_communication": X, "q3_sensitivity": X, "q4_honesty": X, "averageScore": X.X, "overallAssessment": "2-3 sentence summary", "strengths": ["str1", "str2"], "concerns": ["con1"], "recommendation": "STRONG_YES|YES|MAYBE|NO|STRONG_NO"}`;

          // KEY FIX: Add temperature: 0 for consistent output
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: chatPrompt }] }],
            generationConfig: {
              temperature: 0,  // CRITICAL: Zero temperature for deterministic output
              maxOutputTokens: 800
            }
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
    const combinedScore = Math.round((voiceScore + raiScore) * 10) / 10;
    
    const isQualified = combinedScore >= 6 && 
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
        model: 'gemini-2.5-flash'
      },
      updated_at: new Date().toISOString()
    };

    if (['applied', 'ai_assessment_complete', 'started'].includes(application.status)) {
      updatePayload.status = isQualified ? 'qualified' : 'not_qualified';
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
        threshold: 6
      }
    });

  } catch (error: any) {
    console.error('💥 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}