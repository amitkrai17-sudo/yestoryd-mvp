import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract form fields
    const parentName = formData.get('parentName') as string;
    const parentEmail = formData.get('parentEmail') as string;
    const childName = formData.get('childName') as string;
    const age = parseInt(formData.get('age') as string);
    const passage = formData.get('passage') as string;
    const audioBlob = formData.get('audio') as Blob;

    // Validate required fields
    if (!parentName || !parentEmail || !childName || !passage || !audioBlob) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert audio to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // Get age-appropriate guidance
    let ageGuidance = '';
    if (age <= 5) {
      ageGuidance = 'Be very encouraging. Focus on effort over perfection. Minimum score 5 if they tried.';
    } else if (age <= 8) {
      ageGuidance = 'Balance encouragement with feedback. Expect reasonable fluency.';
    } else if (age <= 11) {
      ageGuidance = 'Expect good fluency and clear pronunciation.';
    } else {
      ageGuidance = 'Expect excellent fluency and expression.';
    }

    // Analyze with Gemini
    console.log(`Analyzing reading for ${childName}, age ${age}...`);
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
You are an expert reading coach analyzing a child's reading performance.

CHILD: ${childName}, Age ${age}
PASSAGE: "${passage}"
AUDIO: [attached]

GUIDELINES: ${ageGuidance}

Analyze and return ONLY valid JSON (no markdown):
{
  "score": <number 1-10>,
  "wpm": <number>,
  "fluency": "<Poor|Fair|Good|Excellent>",
  "pronunciation": "<Poor|Fair|Good|Excellent>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "improvements": ["<area1>", "<area2>", "<area3>"],
  "nextSteps": ["<step1>", "<step2>", "<step3>"],
  "summary": "<150 word summary with encouragement>"
}
`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: base64Audio,
        },
      },
    ]);

    const responseText = result.response.text();
    console.log('Gemini response received');

    // Clean and parse response
    let cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error, using fallback');
      analysis = {
        score: 6,
        wpm: 50,
        fluency: 'Fair',
        pronunciation: 'Fair',
        strengths: ['Completed the reading', 'Showed good effort', 'Attempted all words'],
        improvements: ['Practice reading daily', 'Work on fluency', 'Build vocabulary'],
        nextSteps: ['Read aloud 15 minutes daily', 'Use finger tracking', 'Record and listen back'],
        summary: `${childName} completed the reading assessment. Great effort! With regular practice, reading skills will continue to improve. We recommend booking a coaching session for personalized guidance.`,
      };
    }

    // Generate a simple assessment ID
    const assessmentId = `asmt_${Date.now()}`;

    console.log('Analysis complete:', { score: analysis.score, wpm: analysis.wpm });

    // Return success (without saving to Google Sheets for now)
    return NextResponse.json({
      success: true,
      assessmentId,
      analysis: {
        score: analysis.score,
        wpm: analysis.wpm,
        fluency: analysis.fluency,
        pronunciation: analysis.pronunciation,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        nextSteps: analysis.nextSteps,
        summary: analysis.summary,
      },
    });

  } catch (error: any) {
    console.error('Assessment analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze assessment' },
      { status: 500 }
    );
  }
}
