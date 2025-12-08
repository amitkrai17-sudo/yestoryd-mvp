import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getStrictnessForAge(age: number) {
  if (age <= 5) {
    return {
      level: "NEUTRAL/ENCOURAGING",
      guidance: `
ASSESSMENT APPROACH FOR YOUNG CHILDREN (Age ${age}):
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
      level: "BALANCED",
      guidance: `
ASSESSMENT APPROACH FOR EARLY READERS (Age ${age}):
- Balance encouragement with constructive feedback
- Expect reasonable fluency but allow for age-appropriate pauses
- Note pronunciation errors but be understanding
- If child completes 70%+ with moderate fluency, minimum score should be 5`,
      feedbackTone: "Use friendly, supportive language while providing clear feedback. Acknowledge strengths and give specific guidance."
    };
  } else if (age <= 11) {
    return {
      level: "MODERATELY STRICT",
      guidance: `
ASSESSMENT APPROACH FOR DEVELOPING READERS (Age ${age}):
- Expect good fluency and clear pronunciation
- Note errors in pacing, expression, and accuracy
- Be fair but firm about incomplete passages
- If child completes 75%+ with good fluency, minimum score should be 6`,
      feedbackTone: "Use clear, direct feedback. Acknowledge achievements and provide constructive criticism."
    };
  } else {
    return {
      level: "STRICT",
      guidance: `
ASSESSMENT APPROACH FOR ADVANCED READERS (Age ${age}):
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

    const strictnessGuidelines = getStrictnessForAge(childAge);

    const analysisPrompt = `You are an expert reading assessment AI for children. Analyze this audio recording of a ${childAge}-year-old child named ${childName} reading the following passage.

PASSAGE TO BE READ:
"${passage}"
(Word count: ${wordCount} words)

RECORDING DURATION: ${recordingDuration} seconds

${strictnessGuidelines.guidance}

ASSESSMENT CRITERIA:
1. COMPLETENESS: Did the child read the entire passage?
2. FLUENCY: Was the reading smooth or choppy?
3. PRONUNCIATION: Were words pronounced correctly?
4. PACE: Was the reading speed appropriate?
5. EXPRESSION: Did the child read with appropriate expression?

RESPONSE FORMAT - Provide ONLY valid JSON:
{
  "reading_score": <number 1-10>,
  "wpm": <number>,
  "fluency_rating": "<Excellent/Good/Fair/Poor>",
  "pronunciation_rating": "<Clear/Mostly Clear/Unclear>",
  "errors": ["specific error 1", "specific error 2"],
  "completeness_percentage": <number 0-100>,
  "feedback": "<EXACTLY 90 WORDS of constructive, personalized feedback for ${childName}. ${strictnessGuidelines.feedbackTone} Start with what they did well, then mention specific areas to improve, and end with encouragement. Be specific about pronunciation issues or fluency problems observed. Include actionable tips for improvement.>"
}

IMPORTANT: 
- The feedback MUST be EXACTLY 90 words - no more, no less
- If passage was incomplete, mention the percentage read
- Be specific and personalized to ${childName}
- Include the child's name in the feedback

Respond ONLY with valid JSON. No additional text.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

    let analysisResult;
    try {
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      analysisResult = {
        reading_score: 5,
        wpm: Math.round((wordCount / recordingDuration) * 60),
        fluency_rating: 'Fair',
        pronunciation_rating: 'Mostly Clear',
        errors: [],
        completeness_percentage: 80,
        feedback: `${childName} showed good effort in this reading assessment. The reading demonstrated understanding of the passage content with reasonable pace and clarity. To continue improving, ${childName} should practice reading aloud daily, focusing on smooth transitions between words and sentences. Building vocabulary through regular reading will help with unfamiliar words. Keep up the great work and remember that every reading session makes you a stronger reader! The Yestoryd team is proud of your effort today.`,
      };
    }

    const wpm = analysisResult.wpm || Math.round((wordCount / recordingDuration) * 60);

    // Save to Google Sheets
    try {
      const { google } = await import('googleapis');
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const sheetId = process.env.GOOGLE_SHEET_ID;

      if (serviceAccountEmail && privateKey && sheetId) {
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: serviceAccountEmail,
            private_key: privateKey,
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Assessments!A:N',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              `assess_${Date.now()}`,
              childName,
              childAge,
              parentName,
              parentEmail,
              parentPhone,
              analysisResult.reading_score,
              wpm,
              analysisResult.fluency_rating,
              analysisResult.pronunciation_rating,
              analysisResult.completeness_percentage,
              analysisResult.feedback,
              JSON.stringify(analysisResult.errors || []),
              new Date().toISOString(),
            ]],
          },
        });
      }
    } catch (sheetsError) {
      console.error('Failed to save to sheets:', sheetsError);
    }

    return NextResponse.json({
      success: true,
      score: analysisResult.reading_score,
      wpm: wpm,
      fluency: analysisResult.fluency_rating,
      pronunciation: analysisResult.pronunciation_rating,
      completeness: analysisResult.completeness_percentage,
      errors: analysisResult.errors,
      feedback: analysisResult.feedback,
    });

  } catch (error: any) {
    console.error('Assessment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
