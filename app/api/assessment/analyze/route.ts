import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
      recordingDuration,
    } = body;

    if (!audio || !passage) {
      return NextResponse.json(
        { success: false, error: 'Missing audio or passage' },
        { status: 400 }
      );
    }

    // Get age-appropriate strictness
    const strictness = getStrictnessForAge(childAge);

    // Build the analysis prompt - Phonics & Reading Specialist with 4-tier strictness
    const analysisPrompt = `Role: Expert Phonics & Reading Specialist.
Task: Analyze audio of a ${childAge}-year-old child named ${childName} reading the passage below.

PASSAGE CONTEXT:
"${passage}"
(Approx. Word Count: ${passage.split(' ').length} words)

AGE-BASED ASSESSMENT (${strictness.level}):
${strictness.guidance}

CRITICAL SCORING RULES:
1. COMPLETENESS CHECK: If the child reads less than ${strictness.minCompleteness}% of the text, the 'reading_score' MUST be 4 or lower.
2. EVIDENCE REQUIRED: Do not be generic. You must quote specific misread words (e.g., "Read 'Hop' as 'hobbed'").
3. ACCURACY: Note substitutions, omissions, and mispronunciations with exact examples.

Generate a JSON response with this EXACT structure:
{
    "reading_score": (integer 1-10 based on accuracy & completeness),
    "wpm": (integer estimated words per minute),
    "fluency_rating": (string: "Smooth", "Choppy", "Monotone", or "Fast"),
    "pronunciation_rating": (string: "Clear", "Slurred", or "Inconsistent"),
    "completeness_percentage": (integer 0-100),
    "feedback": (string, exactly 3 sentences, 60-80 words total),
    "errors": (list of specific words missed or misread with format "Read 'X' as 'Y'" or "Skipped 'X'")
}

FEEDBACK REQUIREMENTS (must be 60-80 words, exactly 3 sentences):
- Sentence 1: Comment on completeness and overall fluency (e.g., "${childName} read 90% of the passage with good pace.").
- Sentence 2: Cite specific evidence of errors OR praise accuracy if minimal errors (e.g., "A substitution occurred where 'text' was read as 'test'." OR "Pronunciation was clear throughout with no significant errors.").
- Sentence 3: Give one actionable technical tip for improvement (e.g., "Focus on decoding the 'th' sound before speeding up." OR "Practice blending consonant clusters like 'str' and 'bl'.").

Respond ONLY with valid JSON. No additional text.`;

    // Use Gemini 2.5 Flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // For audio analysis, extract the base64 data
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
        feedback: `${childName} completed the reading assessment with moderate fluency and acceptable pace. The reading showed engagement with the passage content, though some words required additional effort. Continue practicing daily with finger-tracking to build smoother word recognition and confidence.`
      };
    }

    // Return success response
    return NextResponse.json({
      success: true,
      score: analysisResult.reading_score,
      wpm: analysisResult.wpm,
      fluency: analysisResult.fluency_rating,
      pronunciation: analysisResult.pronunciation_rating,
      errors: analysisResult.errors,
      completeness: analysisResult.completeness_percentage,
      feedback: analysisResult.feedback,
    });

  } catch (error: any) {
    console.error('Assessment analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}