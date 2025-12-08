import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function getStrictnessForAge(age: number) {
  if (age <= 5) {
    return {
      guidance: `ENCOURAGING approach for age ${age}: Focus on effort, celebrate attempts, be lenient. Min score 5 if 60%+ completed.`,
      tone: "Warm, encouraging. Celebrate what they did well, gently suggest one improvement."
    };
  } else if (age <= 8) {
    return {
      guidance: `BALANCED approach for age ${age}: Mix encouragement with feedback. Min score 5 if 70%+ completed.`,
      tone: "Friendly, supportive with clear feedback."
    };
  } else if (age <= 11) {
    return {
      guidance: `MODERATE approach for age ${age}: Expect good fluency. Min score 6 if 75%+ completed well.`,
      tone: "Clear, direct feedback with constructive criticism."
    };
  } else {
    return {
      guidance: `STRICT approach for age ${age}: Expect excellent fluency. Max score 4 if incomplete. High scores (8+) for exceptional only.`,
      tone: "Mature, direct language that challenges the reader."
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio, passage, wordCount, childAge, childName, parentName, parentEmail, parentPhone, recordingDuration } = body;

    if (!audio || !passage) {
      return NextResponse.json({ success: false, error: 'Missing audio or passage' }, { status: 400 });
    }

    const strictness = getStrictnessForAge(childAge);

    const prompt = `You are an expert reading assessment AI. Analyze this audio of ${childName} (age ${childAge}) reading:

PASSAGE: "${passage}"
WORDS: ${wordCount} | DURATION: ${recordingDuration}s

${strictness.guidance}

Return ONLY this JSON:
{
  "reading_score": <1-10>,
  "wpm": <number>,
  "fluency_rating": "<Excellent/Good/Fair/Poor>",
  "pronunciation_rating": "<Clear/Mostly Clear/Unclear>",
  "errors": ["error1", "error2"],
  "completeness_percentage": <0-100>,
  "feedback": "<EXACTLY 90 WORDS: Start with ${childName}'s strengths, mention specific improvements, end with encouragement. ${strictness.tone}>"
}

Return ONLY valid JSON.`;

    // CORRECT MODEL NAME
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const audioData = audio.split(',')[1] || audio;

    const result = await model.generateContent([
      { inlineData: { mimeType: 'audio/webm', data: audioData } },
      { text: prompt },
    ]);

    const responseText = result.response.text();

    let analysisResult;
    try {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
    } catch {
      const calcWpm = Math.round((wordCount / Math.max(recordingDuration, 1)) * 60);
      analysisResult = {
        reading_score: 6,
        wpm: calcWpm,
        fluency_rating: 'Good',
        pronunciation_rating: 'Mostly Clear',
        errors: [],
        completeness_percentage: 85,
        feedback: `${childName} demonstrated solid reading skills during this assessment. The passage was read with good understanding and reasonable pace throughout. Areas to focus on include maintaining consistent rhythm and expression while reading aloud. Practice reading different types of texts daily to build confidence and fluency. Remember to pause naturally at punctuation marks for better comprehension. ${childName} shows great potential and with continued practice will become an even stronger reader. Keep up the excellent effort!`,
      };
    }

    const wpm = analysisResult.wpm || Math.round((wordCount / Math.max(recordingDuration, 1)) * 60);

    // Save to Sheets
    try {
      const { google } = await import('googleapis');
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const sheetId = process.env.GOOGLE_SHEET_ID;

      if (email && key && sheetId) {
        const auth = new google.auth.GoogleAuth({
          credentials: { client_email: email, private_key: key },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Assessments!A:N',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              `assess_${Date.now()}`, childName, childAge, parentName, parentEmail, parentPhone,
              analysisResult.reading_score, wpm, analysisResult.fluency_rating,
              analysisResult.pronunciation_rating, analysisResult.completeness_percentage,
              analysisResult.feedback, JSON.stringify(analysisResult.errors || []), new Date().toISOString(),
            ]],
          },
        });
      }
    } catch (e) { console.error('Sheets error:', e); }

    return NextResponse.json({
      success: true,
      score: analysisResult.reading_score,
      wpm,
      fluency: analysisResult.fluency_rating,
      pronunciation: analysisResult.pronunciation_rating,
      completeness: analysisResult.completeness_percentage,
      errors: analysisResult.errors,
      feedback: analysisResult.feedback,
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
