// file: app/api/assessment/analyze/route.ts
// rAI v2.0 - Assessment analysis with learning_events integration

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
Role: Expert Phonics & Reading Specialist.
Task: Analyze audio of a ${age}-year-old child named "${name}" reading the passage below.

IMPORTANT: The child's name is "${name}". You MUST use exactly "${name}" (not any other name) in your feedback.

PASSAGE CONTEXT:
"${passage}"
(Approx. Word Count: ${wordCount} words)

CRITICAL SCORING RULES:
1. COMPLETENESS CHECK: If the child reads less than 80% of the text, the 'reading_score' MUST be 4 or lower.
2. EVIDENCE REQUIRED: Do not be generic. You must quote specific misread words.
3. STRICTNESS LEVEL: ${strictness.level}
   ${strictness.guidance}
4. NAME REQUIREMENT: Always refer to the child as "${name}" - never use any other name.

Generate a JSON response with this EXACT structure:
{
    "reading_score": (integer 1-10),
    "wpm": (integer),
    "fluency_rating": "Smooth|Choppy|Monotone|Fast",
    "pronunciation_rating": "Clear|Slurred|Inconsistent",
    "completeness_percentage": (integer 0-100),
    "feedback": (string, 80-100 words, 4 sentences - MUST use the name "${name}"),
    "errors": (list of specific words missed),
    "strengths": (list of 2-3 things done well),
    "areas_to_improve": (list of 2-3 specific areas)
}

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

    let analysisResult: {
      reading_score: number;
      wpm: number;
      fluency_rating: string;
      pronunciation_rating: string;
      errors: string[];
      strengths: string[];
      areas_to_improve: string[];
      completeness_percentage: number;
      feedback: string;
    };
    
    try {
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedResponse);
      
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
      analysisResult = {
        reading_score: 5,
        wpm: 60,
        fluency_rating: 'Choppy',
        pronunciation_rating: 'Inconsistent',
        errors: [],
        strengths: ['Completed the reading', 'Showed effort'],
        areas_to_improve: ['Practice reading aloud daily', 'Work on fluency'],
        completeness_percentage: 80,
        feedback: `${name} completed the reading assessment with moderate fluency and acceptable pace. The reading showed engagement with the passage content, though some words required additional effort. Continue practicing daily reading aloud to build confidence and smooth out hesitations. With consistent effort, ${name} will show noticeable improvement in reading skills.`
      };
    }

    const overallScore = analysisResult.reading_score;
    const clarityScore = analysisResult.pronunciation_rating === 'Clear' ? 8 : analysisResult.pronunciation_rating === 'Slurred' ? 4 : 6;
    const fluencyScore = analysisResult.fluency_rating === 'Smooth' ? 8 : analysisResult.fluency_rating === 'Choppy' ? 5 : analysisResult.fluency_rating === 'Fast' ? 7 : 4;
    const speedScore = Math.min(10, Math.round(analysisResult.wpm / 15));

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
            ...(lead_source === 'coach' && lead_source_coach_id ? {
              lead_source: 'coach',
              lead_source_coach_id,
              referral_code_used,
            } : {}),
          })
          .eq('id', childId);
        
        console.log('✅ Updated existing child:', childId);
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
            lead_source: lead_source || 'yestoryd',
            lead_source_coach_id: lead_source_coach_id || null,
            referral_code_used: referral_code_used || null,
          })
          .select('id')
          .single();

        if (childError) {
          console.error('⚠️ Failed to save child:', childError);
        } else {
          childId = newChild.id;
          console.log('✅ Created new child:', childId, 'Lead source:', lead_source || 'yestoryd');
        }
      }
    } catch (dbError) {
      console.error('⚠️ Database error (non-blocking):', dbError);
    }

    if (childId) {
      try {
        const eventData = {
          score: overallScore,
          wpm: analysisResult.wpm,
          fluency: analysisResult.fluency_rating,
          pronunciation: analysisResult.pronunciation_rating,
          completeness: analysisResult.completeness_percentage,
          feedback: analysisResult.feedback,
          errors: analysisResult.errors,
          strengths: analysisResult.strengths,
          areas_to_improve: analysisResult.areas_to_improve,
          clarity_score: clarityScore,
          fluency_score: fluencyScore,
          speed_score: speedScore,
          passage_word_count: wordCount,
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
          console.log('🔢 Embedding generated for assessment');
        } catch (embError) {
          console.error('⚠️ Embedding generation failed (non-blocking):', embError);
        }

        const aiSummary = `${name} completed a reading assessment scoring ${overallScore}/10. Reading speed was ${analysisResult.wpm} WPM with ${analysisResult.fluency_rating.toLowerCase()} fluency. ${analysisResult.strengths?.[0] || 'Showed good effort'}. Areas to work on: ${analysisResult.areas_to_improve?.[0] || 'daily practice'}.`;

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
          console.error('⚠️ Failed to save learning event:', eventError);
        } else {
          console.log('✅ Learning event saved with embedding');
        }

      } catch (eventError) {
        console.error('⚠️ Learning event error (non-blocking):', eventError);
      }
    }

    return NextResponse.json({
      success: true,
      childId,
      childName: name,
      childAge: age,
      parentName,
      parentEmail,
      parentPhone,
      passage,
      overall_score: overallScore,
      clarity_score: clarityScore,
      fluency_score: fluencyScore,
      speed_score: speedScore,
      wpm: analysisResult.wpm,
      fluency: analysisResult.fluency_rating,
      pronunciation: analysisResult.pronunciation_rating,
      errors: analysisResult.errors,
      completeness: analysisResult.completeness_percentage,
      feedback: analysisResult.feedback,
      strengths: analysisResult.strengths,
      areas_to_improve: analysisResult.areas_to_improve,
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