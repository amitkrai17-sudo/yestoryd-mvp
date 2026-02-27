import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { getGeminiModel } from '@/lib/gemini-config';
import { buildLiteAssessmentPrompt } from '@/lib/gemini/assessment-prompts';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Generate AI summary for the assessment
async function generateAISummary(childName: string, data: any): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: getGeminiModel('assessment_analysis') });
    
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

    const childName = child.child_name || child.name || 'Child';
    const childAge = child.age || 8;

    // Build the analysis prompt (shared standardized lite prompt)
    const analysisPrompt = buildLiteAssessmentPrompt({
      childName,
      childAge,
      passage,
      wordCount: passage.split(' ').length,
    });

    // Use Gemini model for analysis
    const model = genAI.getGenerativeModel({ model: getGeminiModel('assessment_analysis') });

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
        fluency_rating: 'Fair',
        pronunciation_rating: 'Fair',
        errors: [],
        self_corrections: [],
        hesitations: [],
        completeness_percentage: 80,
        feedback: `${childName} completed the reading assessment with moderate fluency and acceptable pace. The reading showed engagement with the passage content, though some words required additional effort. Continue practicing daily with finger-tracking to build smoother word recognition and confidence.`
      };
    }

    // Prepare assessment data for learning_events
    const assessmentData = {
      score: analysisResult.reading_score,
      wpm: analysisResult.wpm,
      fluency: analysisResult.fluency_rating,
      fluency_rating: analysisResult.fluency_rating,
      pronunciation: analysisResult.pronunciation_rating,
      completeness: analysisResult.completeness_percentage,
      errors: analysisResult.errors,
      self_corrections: analysisResult.self_corrections || [],
      hesitations: analysisResult.hesitations || [],
      feedback: analysisResult.feedback,
      passage_title: passageTitle || 'Reading Assessment',
      passage_word_count: passage.split(' ').length,
    };

    // Generate AI summary for RAG
    const aiSummary = await generateAISummary(childName || 'Child', assessmentData);

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
        data: JSON.parse(JSON.stringify(assessmentData)),
        ai_summary: aiSummary,
        embedding: embedding ? JSON.stringify(embedding) : null,
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
