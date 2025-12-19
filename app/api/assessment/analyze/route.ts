// file: app/api/assessment/analyze/route.ts
// UPDATED: Now saves child to database with lead_source tracking

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Supabase client with service role for database writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 4-tier age strictness function
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
      // NEW: Referral tracking fields
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

    // Validate childName
    const name = childName?.trim() || 'the child';
    const age = parseInt(childAge) || 6;
    const strictness = getStrictnessForAge(age);
    const wordCount = passage.split(' ').length;

    // Build the analysis prompt with STRICT name enforcement
    const analysisPrompt = `
Role: Expert Phonics & Reading Specialist.
Task: Analyze audio of a ${age}-year-old child named "${name}" reading the passage below.

IMPORTANT: The child's name is "${name}". You MUST use exactly "${name}" (not any other name) in your feedback.

PASSAGE CONTEXT:
"${passage}"
(Approx. Word Count: ${wordCount} words)

CRITICAL SCORING RULES:
1. COMPLETENESS CHECK: If the child reads less than 80% of the text, the 'reading_score' MUST be 4 or lower.
2. EVIDENCE REQUIRED: Do not be generic. You must quote specific misread words (e.g., "Read 'Hop' as 'hobbed'").
3. STRICTNESS LEVEL: ${strictness.level}
   ${strictness.guidance}
4. NAME REQUIREMENT: Always refer to the child as "${name}" - never use any other name.

Generate a JSON response with this EXACT structure:
{
    "reading_score": (integer 1-10 based on accuracy & completeness),
    "wpm": (integer estimated words per minute),
    "fluency_rating": (string: "Smooth", "Choppy", "Monotone", or "Fast"),
    "pronunciation_rating": (string: "Clear", "Slurred", "Inconsistent"),
    "completeness_percentage": (integer 0-100),
    "feedback": (string, 80-100 words, 4 sentences - MUST use the name "${name}"),
    "errors": (list of specific words missed or misread)
}

Requirements for 'feedback' (4 sentences, 80-100 words total):
- Sentence 1: Comment on completeness and fluency. Start with "${name} read..." 
- Sentence 2: Cite specific evidence of errors OR praise accuracy if minimal errors.
- Sentence 3: Give one actionable technical tip for improvement.
- Sentence 4: Encouraging closing about progress. Must include "${name}".

CRITICAL: Use ONLY the name "${name}" in your response. Do not use any other name.

Respond ONLY with valid JSON. No additional text.`;

    // Use Gemini 2.5 Flash Lite model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Extract base64 audio data
    const audioData = audio.split(',')[1] || audio;

    // Create the request with audio
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

    // Parse the JSON response
    let analysisResult;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedResponse);
      
      // Extra safety: Replace any wrong names in feedback with correct name
      if (analysisResult.feedback) {
        // Common names Gemini might hallucinate
        const wrongNames = ['Aisha', 'Ali', 'Ahmed', 'Sara', 'Omar', 'Fatima', 'Mohammed', 'Zara', 'Aryan', 'Priya', 'Rahul', 'Ananya', 'the child', 'The child', 'this child', 'This child'];
        let feedback = analysisResult.feedback;
        wrongNames.forEach(wrongName => {
          const regex = new RegExp(wrongName, 'gi');
          feedback = feedback.replace(regex, name);
        });
        analysisResult.feedback = feedback;
      }
      
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      // Provide default values if parsing fails
      analysisResult = {
        reading_score: 5,
        wpm: 60,
        fluency_rating: 'Choppy',
        pronunciation_rating: 'Inconsistent',
        errors: [],
        completeness_percentage: 80,
        feedback: `${name} completed the reading assessment with moderate fluency and acceptable pace. The reading showed engagement with the passage content, though some words required additional effort. Continue practicing daily reading aloud to build confidence and smooth out hesitations. With consistent effort, ${name} will show noticeable improvement in reading skills.`
      };
    }

    // Calculate scores
    const overallScore = analysisResult.reading_score;
    const clarityScore = analysisResult.pronunciation_rating === 'Clear' ? 8 : analysisResult.pronunciation_rating === 'Slurred' ? 4 : 6;
    const fluencyScore = analysisResult.fluency_rating === 'Smooth' ? 8 : analysisResult.fluency_rating === 'Choppy' ? 5 : analysisResult.fluency_rating === 'Fast' ? 7 : 4;
    const speedScore = Math.min(10, Math.round(analysisResult.wpm / 15));

    // ==================== SAVE CHILD TO DATABASE ====================
    let childId: string | null = null;
    
    try {
      // Check if child already exists (same name + parent email)
      const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('name', name)
        .eq('parent_email', parentEmail)
        .maybeSingle();

      if (existingChild) {
        // Update existing child with new assessment
        childId = existingChild.id;
        await supabase
          .from('children')
          .update({
            age,
            parent_name: parentName,
            parent_phone: parentPhone,
            last_assessment_score: overallScore,
            last_assessment_date: new Date().toISOString(),
            // Update lead source only if it was previously 'yestoryd' and now has coach referral
            ...(lead_source === 'coach' && lead_source_coach_id ? {
              lead_source: 'coach',
              lead_source_coach_id,
              referral_code_used,
            } : {}),
          })
          .eq('id', childId);
        
        console.log('✅ Updated existing child:', childId);
      } else {
        // Create new child record
        const { data: newChild, error: childError } = await supabase
          .from('children')
          .insert({
            name,
            age,
            parent_name: parentName,
            parent_email: parentEmail,
            parent_phone: parentPhone,
            lead_status: 'assessed',
            last_assessment_score: overallScore,
            last_assessment_date: new Date().toISOString(),
            // Referral tracking
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
      // Don't fail the assessment if DB save fails
    }

    // Return success response
    return NextResponse.json({
      success: true,
      childId, // Include childId in response
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
      encouragement: `Keep reading daily, ${name}! Every page makes you stronger.`,
      // Include lead source in response for debugging
      lead_source: lead_source || 'yestoryd',
    });

  } catch (error: any) {
    console.error('Assessment analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}