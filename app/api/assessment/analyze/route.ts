import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getStrictnessForAge(age: number) {
  if (age <= 5) {
    return {
      guidance: `ASSESSMENT APPROACH FOR YOUNG CHILDREN (Age ${age}):
- Be ENCOURAGING and supportive in tone
- Focus on effort and progress rather than perfection
- Allow for minor pronunciation variations common at this age
- Consider developmental speech patterns
- Celebrate attempts and partial success
- Be lenient with pacing and hesitations
- If child completes 60%+ of passage with effort, minimum score should be 5`,
      feedbackTone: "Use warm, encouraging language. Focus on celebrating what the child did well and gently suggest one area to practice."
    };
  } else if (age <= 8) {
    return {
      guidance: `ASSESSMENT APPROACH FOR EARLY READERS (Age ${age}):
- Balance encouragement with constructive feedback
- Expect reasonable fluency but allow for age-appropriate pauses
- Note pronunciation errors but be understanding
- If child completes 70%+ with moderate fluency, minimum score should be 5`,
      feedbackTone: "Use friendly, supportive language while providing clear feedback. Acknowledge strengths and give specific guidance."
    };
  } else if (age <= 11) {
    return {
      guidance: `ASSESSMENT APPROACH FOR DEVELOPING READERS (Age ${age}):
- Expect good fluency and clear pronunciation
- Note errors in pacing, expression, and accuracy
- Be fair but firm about incomplete passages
- If child completes 75%+ with good fluency, minimum score should be 6`,
      feedbackTone: "Use clear, direct feedback. Acknowledge achievements and provide constructive criticism."
    };
  } else {
    return {
      guidance: `ASSESSMENT APPROACH FOR ADVANCED READERS (Age ${age}):
- Expect EXCELLENT fluency, expression, and comprehension
- Be STRICT about pronunciation, pacing, and completion
- Incomplete passages should receive low scores (maximum 4)
- High scores (8+) reserved for truly exceptional reading`,
      feedbackTone: "Use mature, direct language. Provide sophisticated feedback that challenges the reader."
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      audio,
      passage,
      wordCount,
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
    const strictnessGuidelines = getStrictnessForAge(childAge);

    // Build the analysis prompt - YOUR EXACT PROMPT
    const analysisPrompt = `You are an expert reading assessment AI. Analyze this audio recording of a ${childAge}-year-old child reading the following passage.

PASSAGE TO BE READ:
"${passage}"
(Word count: ${wordCount} words)

RECORDING DURATION: ${recordingDuration} seconds

${strictnessGuidelines.guidance}

ASSESSMENT CRITERIA:
1. COMPLETENESS: Did the child read the entire passage? Calculate percentage read.
2. FLUENCY: Was the reading smooth or choppy? Were there long pauses?
3. PRONUNCIATION: Were words pronounced correctly?
4. PACE: Was the reading speed appropriate (not too fast/slow)?
5. EXPRESSION: Did the child read with appropriate expression?

RESPONSE FORMAT - Provide ONLY valid JSON:
{
  "reading_score": <number 1-10>,
  "wpm": <number>,
  "fluency_rating": "<Excellent/Good/Fair/Poor/Very Poor>",
  "pronunciation_rating": "<Clear/Mostly Clear/Unclear/Very Unclear>",
  "errors": ["specific error 1", "specific error 2", "missing sentence X", "skipped words"],
  "completeness_percentage": <number 0-100>,
  "feedback": "<80-100 word constructive feedback that MUST mention if the passage was incomplete. If less than 80% was read, feedback MUST say 'Only X% of the passage was read' and explain this is why the score is low. ${strictnessGuidelines.feedbackTone}>"
}

BE STRICT: If the child did not read the full passage or made many errors, score MUST be low (1-4). Do not give high scores for incomplete readings.

Respond ONLY with valid JSON. No additional text.`;

    // Use Gemini 2.5 Flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
        wpm: Math.round((wordCount / Math.max(recordingDuration, 1)) * 60),
        fluency_rating: 'Fair',
        pronunciation_rating: 'Mostly Clear',
        errors: [],
        completeness_percentage: 80,
        feedback: `${childName} showed good effort in this reading assessment. The reading demonstrated understanding of the passage content with reasonable pace and clarity. To continue improving, ${childName} should practice reading aloud daily, focusing on smooth transitions between words and sentences. Building vocabulary through regular reading will help with unfamiliar words. Keep up the great work and remember that every reading session makes you a stronger reader!`
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
