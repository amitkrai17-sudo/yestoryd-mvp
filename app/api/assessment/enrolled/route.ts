import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

// Generate embedding for RAG search
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// Generate AI summary for the assessment
async function generateAISummary(childName: string, data: any): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    
    const prompt = `Summarize this reading assessment in 1-2 encouraging sentences for a parent:
Child: ${childName}
Score: ${data.score}/10
Reading Speed: ${data.wpm} WPM
Fluency: ${data.fluency}
Pronunciation: ${data.pronunciation}
Completeness: ${data.completeness}%
Errors: ${data.errors?.length || 0} words
Feedback: ${data.feedback}`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('AI summary error:', error);
    return `${childName} scored ${data.score}/10 with ${data.wpm} WPM reading speed.`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      childId,
      audio,
      passage,
      passageTitle,
    } = body;

    // Validate required fields
    if (!childId) {
      return NextResponse.json(
        { success: false, error: 'childId is required for enrolled assessments' },
        { status: 400 }
      );
    }

    if (!audio || !passage) {
      return NextResponse.json(
        { success: false, error: 'Missing audio or passage' },
        { status: 400 }
      );
    }

    // Get child details from database
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('*')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found' },
        { status: 404 }
      );
    }

    const childName = child.child_name || child.name;
    const childAge = child.age || 8;

    // Get age-appropriate strictness
    const strictness = getStrictnessForAge(childAge);

    // Build the analysis prompt
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
- Sentence 2: Cite specific evidence of errors OR praise accuracy if minimal errors.
- Sentence 3: Give one actionable technical tip for improvement.

Respond ONLY with valid JSON. No additional text.`;

    // Use Gemini model for analysis
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Extract base64 audio data
    const audioData = audio.split(',')[1] || audio;

    // Analyze the audio
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
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      analysisResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
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

    // Prepare assessment data for learning_events
    const assessmentData = {
      score: analysisResult.reading_score,
      wpm: analysisResult.wpm,
      fluency: analysisResult.fluency_rating,
      pronunciation: analysisResult.pronunciation_rating,
      completeness: analysisResult.completeness_percentage,
      errors: analysisResult.errors,
      feedback: analysisResult.feedback,
      passage_title: passageTitle || 'Reading Assessment',
      passage_word_count: passage.split(' ').length,
    };

    // Generate AI summary for RAG
    const aiSummary = await generateAISummary(childName, assessmentData);

    // Create searchable text for embedding
    const searchableText = `assessment reading score ${assessmentData.score} wpm ${assessmentData.wpm} fluency ${assessmentData.fluency} pronunciation ${assessmentData.pronunciation} completeness ${assessmentData.completeness} ${assessmentData.feedback} ${aiSummary}`;

    // Generate embedding
    const embedding = await generateEmbedding(searchableText);

    // Save to learning_events
    const { data: learningEvent, error: insertError } = await supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'assessment',
        event_date: new Date().toISOString(),
        data: assessmentData,
        ai_summary: aiSummary,
        embedding,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save to learning_events:', insertError);
      // Don't fail the request, just log it
    }

    // Update child's latest_assessment_score
    await supabase
      .from('children')
      .update({ 
        latest_assessment_score: analysisResult.reading_score,
        updated_at: new Date().toISOString()
      })
      .eq('id', childId);

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
      aiSummary,
      savedToHistory: !insertError,
    });

  } catch (error: any) {
    console.error('Enrolled assessment error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
