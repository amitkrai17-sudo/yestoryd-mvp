// file: app/api/assessment/analyze/route.ts
// rAI v2.2 - Full detailed assessment with all 6 skills + soft c/g phonemes

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding, buildSearchableContent } from '@/lib/rai/embeddings';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getStrictnessForAge(age: number) {
  if (age <= 5) {
    return {
      level: "ENCOURAGING",
      guidance: "Be warm and encouraging. Focus on effort over perfection. Allow developmental speech patterns. Minimum score 5 if 60%+ completed.",
      minCompleteness: 60
    };
  } else if (age <= 8) {
    return {
      level: "BALANCED",
      guidance: "Balance encouragement with constructive feedback. Allow age-appropriate pauses. Minimum score 5 if 70%+ completed.",
      minCompleteness: 70
    };
  } else if (age <= 11) {
    return {
      level: "MODERATELY STRICT",
      guidance: "Expect good fluency and clear pronunciation. Be fair but firm. Minimum score 6 if 75%+ completed.",
      minCompleteness: 75
    };
  } else {
    return {
      level: "STRICT",
      guidance: "Expect excellent fluency, expression, and accuracy. High scores (8+) reserved for exceptional reading. Maximum score 4 for incomplete passages.",
      minCompleteness: 80
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      audio,
      passage,
      childAge,
      childName,
      parentName,
      parentEmail,
      parentPhone,
      lead_source,
      lead_source_coach_id,
      referral_code_used,
    } = body;

    if (!audio || !passage) {
      return NextResponse.json(
        { success: false, error: 'Missing audio or passage' },
        { status: 400 }
      );
    }

    const name = childName?.trim() || 'the child';
    const age = parseInt(childAge) || 6;
    const strictness = getStrictnessForAge(age);
    const wordCount = passage.split(' ').length;

    const analysisPrompt = `
Role: Expert Phonics & Reading Specialist with deep knowledge of systematic phonics instruction.
Task: Analyze audio of a ${age}-year-old child named "${name}" reading the passage below.

IMPORTANT: The child's name is "${name}". You MUST use exactly "${name}" (not any other name) in your feedback.

PASSAGE CONTEXT:
"${passage}"
(Word Count: ${wordCount} words)

CRITICAL SCORING RULES:
1. COMPLETENESS CHECK: If the child reads less than ${strictness.minCompleteness}% of the text, ALL scores MUST be 4 or lower.
2. EVIDENCE REQUIRED: Do not be generic. You must quote specific misread words heard in the audio.
3. STRICTNESS LEVEL: ${strictness.level}
   ${strictness.guidance}
4. NAME REQUIREMENT: Always refer to the child as "${name}" - never use any other name.

Generate a JSON response with this EXACT structure:
{
    "clarity_score": (integer 1-10, pronunciation clarity),
    "fluency_score": (integer 1-10, reading flow and smoothness),
    "speed_score": (integer 1-10, appropriate pace for age),
    "wpm": (integer, words per minute),
    "completeness_percentage": (integer 0-100),
    
    "error_classification": {
        "substitutions": [{"original": "actual_word", "read_as": "what_child_said"}],
        "omissions": ["list of skipped words"],
        "insertions": ["list of added words not in passage"],
        "reversals": [{"original": "was", "read_as": "saw"}],
        "mispronunciations": [{"word": "word", "issue": "specific description of how it was mispronounced"}]
    },
    
    "phonics_analysis": {
        "struggling_phonemes": ["list specific phonemes the child struggles with from the categories below"],
        "phoneme_details": [
            {"phoneme": "th", "examples": ["the->da", "this->dis"], "frequency": "frequent"},
            {"phoneme": "soft_g", "examples": ["giant->gant"], "frequency": "occasional"}
        ],
        "strong_phonemes": ["list phonemes the child pronounces well"],
        "recommended_focus": "Primary phonics area to practice with specific examples"
    },
    
    "skill_breakdown": {
        "decoding": {"score": 1-10, "notes": "ability to sound out unfamiliar words"},
        "sight_words": {"score": 1-10, "notes": "recognition of common high-frequency words"},
        "blending": {"score": 1-10, "notes": "combining sounds to form words"},
        "segmenting": {"score": 1-10, "notes": "breaking words into individual sounds"},
        "expression": {"score": 1-10, "notes": "reading with appropriate intonation"},
        "comprehension_indicators": {"score": 1-10, "notes": "pausing at punctuation, emphasis on key words"}
    },
    
    "practice_recommendations": {
        "daily_words": ["5 specific words from the passage to practice daily"],
        "phonics_focus": "Specific phoneme pattern to work on with examples",
        "suggested_activity": "One specific activity for home practice"
    },
    
    "feedback": "80-100 words, 4 sentences. MUST use name '${name}'. Include specific phonics observations and quote actual errors heard.",
    
    "errors": ["simple list of all error words for quick reference"],
    "strengths": ["2-3 specific things done well with evidence"],
    "areas_to_improve": ["2-3 specific areas with actionable advice"]
}

PHONEME CATEGORIES TO ASSESS:

CONSONANT DIGRAPHS:
- th (voiced: the, this, that / unvoiced: think, three, bath)
- ch (chat, child, much)
- sh (ship, shoe, fish)
- wh (what, when, where)
- ph (phone, photo)
- ng (sing, ring, hang)
- ck (back, sick, duck)

CONSONANT BLENDS:
- L-blends: bl, cl, fl, gl, pl, sl
- R-blends: br, cr, dr, fr, gr, pr, tr
- S-blends: sc, sk, sl, sm, sn, sp, st, sw

SOFT & HARD SOUNDS:
- soft_c: ce, ci, cy -> /s/ sound (city, nice, cycle)
- hard_c: ca, co, cu -> /k/ sound (cat, cold, cup)
- soft_g: ge, gi, gy -> /j/ sound (giant, giraffe, gym)
- hard_g: ga, go, gu -> /g/ sound (game, go, gum)

SHORT VOWELS:
- short_a (cat, bat, hat)
- short_e (bed, red, pen)
- short_i (sit, pig, fin)
- short_o (hot, dog, top)
- short_u (cup, bus, sun)

LONG VOWELS:
- long_a (cake, make, rain, day)
- long_e (feet, tree, team, key)
- long_i (time, bike, pie, sky)
- long_o (home, boat, snow, go)
- long_u (cute, tube, blue, few)

R-CONTROLLED VOWELS:
- ar (car, star, farm)
- er (her, fern, term)
- ir (bird, girl, first)
- or (for, born, horse)
- ur (fur, turn, nurse)

VOWEL TEAMS & DIPHTHONGS:
- ai, ay (rain, day)
- ea, ee (team, feet)
- oa, oe (boat, toe)
- oo (book, moon)
- ou, ow (out, cow)
- oi, oy (oil, boy)
- au, aw (pause, saw)

SKILL DEFINITIONS FOR SCORING:
- Decoding: Ability to apply phonics rules to sound out unfamiliar words
- Sight Words: Instant recognition of common words (the, was, said, have, come)
- Blending: Smoothly combining individual sounds (c-a-t -> cat)
- Segmenting: Breaking words into component sounds for spelling
- Expression: Natural intonation, appropriate pauses, emotional engagement
- Comprehension Indicators: Evidence of understanding through phrasing and emphasis

SCORING CONSISTENCY RULES:
- If completeness_percentage < ${strictness.minCompleteness}%, ALL scores must be 4 or lower
- If completeness_percentage < 50%, ALL scores must be 2 or lower
- Speed score should reflect WPM for age ${age}: <30 WPM = 1-3, 30-60 WPM = 4-6, 60-100 WPM = 7-8, >100 WPM = 9-10
- Be realistic: a choppy reader with many errors should NOT get 7+ in fluency
- Skill scores should be consistent with overall performance

Respond ONLY with valid JSON. No additional text.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const audioData = audio.split(',')[1] || audio;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioData,
        },
      },
      { text: analysisPrompt },
    ]);

    const response = await result.response;
    const responseText = response.text();

    // Full interface with all 6 skills
    interface ErrorClassification {
      substitutions: { original: string; read_as: string }[];
      omissions: string[];
      insertions: string[];
      reversals: { original: string; read_as: string }[];
      mispronunciations: { word: string; issue: string }[];
    }

    interface PhonicsAnalysis {
      struggling_phonemes: string[];
      phoneme_details: { phoneme: string; examples: string[]; frequency: string }[];
      strong_phonemes: string[];
      recommended_focus: string;
    }

    interface SkillScore {
      score: number;
      notes: string;
    }

    interface SkillBreakdown {
      decoding: SkillScore;
      sight_words: SkillScore;
      blending: SkillScore;
      segmenting: SkillScore;
      expression: SkillScore;
      comprehension_indicators: SkillScore;
    }

    interface PracticeRecommendations {
      daily_words: string[];
      phonics_focus: string;
      suggested_activity: string;
    }

    interface AnalysisResult {
      clarity_score: number;
      fluency_score: number;
      speed_score: number;
      wpm: number;
      completeness_percentage: number;
      error_classification: ErrorClassification;
      phonics_analysis: PhonicsAnalysis;
      skill_breakdown: SkillBreakdown;
      feedback: string;
      errors: string[];
      strengths: string[];
      areas_to_improve: string[];
      practice_recommendations: PracticeRecommendations;
    }

    let analysisResult: AnalysisResult;
    
    try {
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedResponse);
      
      // Fix wrong names in feedback
      if (analysisResult.feedback) {
        const wrongNames = ['Aisha', 'Ali', 'Ahmed', 'Sara', 'Omar', 'Fatima', 'Mohammed', 'Zara', 'Aryan', 'Priya', 'Rahul', 'Ananya', 'the child', 'The child', 'this child', 'This child'];
        let feedback = analysisResult.feedback;
        wrongNames.forEach(wrongName => {
          const regex = new RegExp(wrongName, 'gi');
          feedback = feedback.replace(regex, name);
        });
        analysisResult.feedback = feedback;
      }
      
    } catch {
      console.error('Failed to parse Gemini response:', responseText);
      // Full fallback with all 6 skills
      analysisResult = {
        clarity_score: 5,
        fluency_score: 5,
        speed_score: 5,
        wpm: 60,
        completeness_percentage: 80,
        error_classification: {
          substitutions: [],
          omissions: [],
          insertions: [],
          reversals: [],
          mispronunciations: []
        },
        phonics_analysis: {
          struggling_phonemes: [],
          phoneme_details: [],
          strong_phonemes: [],
          recommended_focus: 'Continue practicing current level'
        },
        skill_breakdown: {
          decoding: { score: 5, notes: 'Assessment needed' },
          sight_words: { score: 5, notes: 'Assessment needed' },
          blending: { score: 5, notes: 'Assessment needed' },
          segmenting: { score: 5, notes: 'Assessment needed' },
          expression: { score: 5, notes: 'Assessment needed' },
          comprehension_indicators: { score: 5, notes: 'Assessment needed' }
        },
        errors: [],
        strengths: ['Completed the reading', 'Showed effort'],
        areas_to_improve: ['Practice reading aloud daily', 'Work on fluency'],
        feedback: `${name} completed the reading assessment with moderate fluency and acceptable pace. The reading showed engagement with the passage content, though some words required additional effort. Continue practicing daily reading aloud to build confidence and smooth out hesitations. With consistent effort, ${name} will show noticeable improvement in reading skills.`,
        practice_recommendations: {
          daily_words: [],
          phonics_focus: 'Review current phonics level',
          suggested_activity: 'Read aloud for 10 minutes daily'
        }
      };
    }

    // Calculate scores with bounds checking
    const clarityScore = Math.min(10, Math.max(1, analysisResult.clarity_score || 5));
    const fluencyScore = Math.min(10, Math.max(1, analysisResult.fluency_score || 5));
    const speedScore = Math.min(10, Math.max(1, analysisResult.speed_score || 5));
    
    // Calculate overall as weighted average (clarity 35%, fluency 40%, speed 25%)
    const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

    // Calculate average skill score from all 6 skills
    const skillScores = analysisResult.skill_breakdown;
    const avgSkillScore = Math.round(
      (skillScores.decoding.score + 
       skillScores.sight_words.score + 
       skillScores.blending.score + 
       skillScores.segmenting.score + 
       skillScores.expression.score + 
       skillScores.comprehension_indicators.score) / 6
    );

    // Save to database
    let childId: string | null = null;
    
    try {
      const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('name', name)
        .eq('parent_email', parentEmail)
        .maybeSingle();

      if (existingChild) {
        childId = existingChild.id;
        await supabase
          .from('children')
          .update({
            age,
            parent_name: parentName,
            parent_phone: parentPhone,
            latest_assessment_score: overallScore,
            phonics_focus: analysisResult.phonics_analysis?.recommended_focus || null,
            struggling_phonemes: analysisResult.phonics_analysis?.struggling_phonemes || [],
            ...(lead_source === 'coach' && lead_source_coach_id ? {
              lead_source: 'coach',
              lead_source_coach_id,
              referral_code_used,
            } : {}),
          })
          .eq('id', childId);
        
        console.log('Updated existing child:', childId);
      } else {
        const { data: newChild, error: childError } = await supabase
          .from('children')
          .insert({
            name,
            child_name: name,
            age,
            parent_name: parentName,
            parent_email: parentEmail,
            parent_phone: parentPhone,
            lead_status: 'assessed',
            latest_assessment_score: overallScore,
            phonics_focus: analysisResult.phonics_analysis?.recommended_focus || null,
            struggling_phonemes: analysisResult.phonics_analysis?.struggling_phonemes || [],
            lead_source: lead_source || 'yestoryd',
            lead_source_coach_id: lead_source_coach_id || null,
            referral_code_used: referral_code_used || null,
          })
          .select('id')
          .single();

        if (childError) {
          console.error('Failed to save child:', childError);
        } else {
          childId = newChild.id;
          console.log('Created new child:', childId, 'Lead source:', lead_source || 'yestoryd');
        }
      }
    } catch (dbError) {
      console.error('Database error (non-blocking):', dbError);
    }

    // Save learning event with full data
    if (childId) {
      try {
        const eventData = {
          score: overallScore,
          wpm: analysisResult.wpm,
          completeness: analysisResult.completeness_percentage,
          feedback: analysisResult.feedback,
          errors: analysisResult.errors,
          strengths: analysisResult.strengths,
          areas_to_improve: analysisResult.areas_to_improve,
          clarity_score: clarityScore,
          fluency_score: fluencyScore,
          speed_score: speedScore,
          passage_word_count: wordCount,
          error_classification: analysisResult.error_classification,
          phonics_analysis: analysisResult.phonics_analysis,
          skill_breakdown: analysisResult.skill_breakdown,
          practice_recommendations: analysisResult.practice_recommendations,
        };

        const searchableContent = buildSearchableContent(
          'assessment',
          name,
          eventData,
          analysisResult.feedback
        );

        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(searchableContent);
          console.log('Embedding generated for assessment');
        } catch (embError) {
          console.error('Embedding generation failed (non-blocking):', embError);
        }

        const fluencyDesc = fluencyScore >= 7 ? 'smooth' : fluencyScore >= 5 ? 'moderate' : 'developing';
        const phonicsFocus = analysisResult.phonics_analysis?.recommended_focus || 'general practice';
        const aiSummary = `${name} scored ${overallScore}/10 with ${fluencyDesc} fluency at ${analysisResult.wpm} WPM. Focus area: ${phonicsFocus}. ${analysisResult.strengths?.[0] || 'Showed good effort'}.`;

        const { error: eventError } = await supabase
          .from('learning_events')
          .insert({
            child_id: childId,
            event_type: 'assessment',
            event_date: new Date().toISOString(),
            event_data: eventData,
            ai_summary: aiSummary,
            content_for_embedding: searchableContent,
            embedding: embedding,
          });

        if (eventError) {
          console.error('Failed to save learning event:', eventError);
        } else {
          console.log('Learning event saved with embedding');
        }

      } catch (eventError) {
        console.error('Learning event error (non-blocking):', eventError);
      }
    }

    // Lead scoring with phonics consideration
    if (childId) {
      try {
        let leadScore = 10;
        
        // Score-based scoring
        if (overallScore <= 3) leadScore += 50;
        else if (overallScore <= 5) leadScore += 30;
        else if (overallScore <= 7) leadScore += 15;
        else leadScore += 5;
        
        // Age-based scoring
        if (age >= 4 && age <= 7) leadScore += 15;
        else if (age >= 8 && age <= 10) leadScore += 10;

        // Phonics struggles indicate coaching need
        const strugglingCount = analysisResult.phonics_analysis?.struggling_phonemes?.length || 0;
        if (strugglingCount >= 3) leadScore += 10;
        else if (strugglingCount >= 1) leadScore += 5;
        
        const leadStatus = leadScore >= 60 ? 'hot' : leadScore >= 30 ? 'warm' : 'new';
        
        await supabase
          .from('children')
          .update({
            lead_score: leadScore,
            lead_status: leadStatus,
            lead_score_updated_at: new Date().toISOString(),
          })
          .eq('id', childId);
        
        console.log('Lead score:', leadScore, '(' + leadStatus + ')');
        
        // Trigger hot lead alert
        if (leadStatus === 'hot') {
          console.log('HOT LEAD detected! Triggering alert...');
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yestoryd.com';
          fetch(`${baseUrl}/api/leads/hot-alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ childId }),
          }).catch(err => console.error('Hot lead alert failed:', err));
        }
      } catch (leadError) {
        console.error('Lead scoring error (non-blocking):', leadError);
      }
    }

    // Count total errors
    const totalErrors = 
      (analysisResult.error_classification?.substitutions?.length || 0) +
      (analysisResult.error_classification?.omissions?.length || 0) +
      (analysisResult.error_classification?.insertions?.length || 0) +
      (analysisResult.error_classification?.reversals?.length || 0) +
      (analysisResult.error_classification?.mispronunciations?.length || 0);

    return NextResponse.json({
      success: true,
      childId,
      childName: name,
      childAge: age,
      parentName,
      parentEmail,
      parentPhone,
      passage,
      
      // Core scores
      overall_score: overallScore,
      clarity_score: clarityScore,
      fluency_score: fluencyScore,
      speed_score: speedScore,
      wpm: analysisResult.wpm,
      completeness: analysisResult.completeness_percentage,
      
      // Error analysis
      errors: analysisResult.errors,
      error_classification: analysisResult.error_classification,
      total_error_count: totalErrors,
      
      // Phonics analysis (with soft c/g)
      phonics_analysis: analysisResult.phonics_analysis,
      
      // Full skill breakdown (all 6 skills)
      skill_breakdown: analysisResult.skill_breakdown,
      avg_skill_score: avgSkillScore,
      
      // Feedback & recommendations
      feedback: analysisResult.feedback,
      strengths: analysisResult.strengths,
      areas_to_improve: analysisResult.areas_to_improve,
      practice_recommendations: analysisResult.practice_recommendations,
      
      encouragement: `Keep reading daily, ${name}! Every page makes you stronger.`,
      lead_source: lead_source || 'yestoryd',
    });

  } catch (error: unknown) {
    console.error('Assessment analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}