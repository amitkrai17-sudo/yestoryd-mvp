import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface GenerateQuizRequest {
  topic: string;
  subtopic?: string;
  childAge: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
  sessionId?: string;
  childId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateQuizRequest = await request.json();
    
    const {
      topic,
      subtopic,
      childAge,
      difficulty = 'medium',
      questionCount = 5,
      sessionId,
      childId,
    } = body;

    if (!topic || !childId) {
      return NextResponse.json(
        { success: false, error: 'topic and childId are required' },
        { status: 400 }
      );
    }

    // First, check quiz_bank for existing quiz
    const { data: existingQuiz } = await supabase
      .from('quiz_bank')
      .select('*')
      .eq('topic', topic)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (existingQuiz) {
      // Use existing quiz from bank
      return NextResponse.json({
        success: true,
        source: 'bank',
        quiz: {
          id: existingQuiz.id,
          topic: existingQuiz.topic,
          subtopic: existingQuiz.subtopic,
          questions: existingQuiz.questions,
          difficulty: existingQuiz.difficulty_level,
        },
      });
    }

    // Generate quiz using AI
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `Generate a ${questionCount}-question quiz for a ${childAge}-year-old child on the topic: ${topic}${subtopic ? ` - ${subtopic}` : ''}.

Difficulty level: ${difficulty}

Requirements:
- Questions should be age-appropriate
- Mix of question types (multiple choice preferred)
- Clear, simple language
- Educational and engaging

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation why this is correct"
    }
  ]
}

Generate exactly ${questionCount} questions.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse the response
    let quizData;
    try {
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      quizData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse quiz response:', responseText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate quiz' },
        { status: 500 }
      );
    }

    // Save generated quiz to quiz_bank for future use
    const { data: savedQuiz, error: saveError } = await supabase
      .from('quiz_bank')
      .insert({
        topic,
        subtopic: subtopic || null,
        difficulty_level: difficulty,
        age_group: `${childAge - 1}-${childAge + 1}`,
        questions: quizData.questions,
        is_active: true,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save quiz to bank:', saveError);
    }

    return NextResponse.json({
      success: true,
      source: 'generated',
      quiz: {
        id: savedQuiz?.id || null,
        topic,
        subtopic,
        questions: quizData.questions,
        difficulty,
      },
    });

  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
