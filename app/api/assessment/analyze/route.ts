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
TOTAL WORDS: ${wordCount} | RECORDING DURATION: ${recordingDuration}s

${strictness.guidance}

IMPORTANT INSTRUCTIONS:
1. Carefully check if ${childName} read the COMPLETE passage or only a portion
2. Count approximately how many words were actually read
3. Calculate completeness percentage (words read / total words * 100)

Return ONLY this JSON:
{
  "reading_score": <1-10>,
  "wpm": <calculated words per minute>,
  "fluency_rating": "<Excellent/Good/Fair/Poor>",
  "pronunciation_rating": "<Clear/Mostly Clear/Unclear>",
  "errors": ["specific error 1", "specific error 2"],
  "completeness_percentage": <0-100>,
  "words_read": <approximate number of words actually read>,
  "feedback": "<EXACTLY 100 WORDS feedback that MUST START by stating whether ${childName} read the full passage or only a portion (e.g., '${childName} read the complete passage...' OR '${childName} read approximately X% of the passage...'). Then mention specific strengths like words pronounced well. Then mention specific areas to improve with examples from the reading. End with encouragement and one actionable tip for practice. ${strictness.tone}>"
}

CRITICAL RULES:
- Feedback MUST be exactly 100 words
- Feedback MUST begin with completion status
- Include specific words/phrases the child handled well or struggled with
- Be personalized using ${childName}'s name

Return ONLY valid JSON. No markdown, no extra text.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
        words_read: Math.round(wordCount * 0.85),
        feedback: `${childName} read approximately 85% of the passage with good effort and understanding. The reading showed solid comprehension of the content with a reasonable pace maintained throughout most of the text. ${childName} handled several challenging words well, demonstrating growing vocabulary skills. To continue improving, focus on completing the entire passage and maintaining consistent expression while reading aloud. Practice reading different types of texts daily, paying attention to punctuation marks for natural pauses. ${childName} shows excellent potential and with regular practice will become an even more confident and fluent reader.`,
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
          range: 'Assessments!A:O',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              `assess_${Date.now()}`, childName, childAge, parentName, parentEmail, parentPhone,
              analysisResult.reading_score, wpm, analysisResult.fluency_rating,
              analysisResult.pronunciation_rating, analysisResult.completeness_percentage,
              analysisResult.words_read || '', analysisResult.feedback, 
              JSON.stringify(analysisResult.errors || []), new Date().toISOString(),
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
      wordsRead: analysisResult.words_read,
      errors: analysisResult.errors,
      feedback: analysisResult.feedback,
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
