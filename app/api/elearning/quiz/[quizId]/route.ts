// =============================================================================
// QUIZ API
// Fetch quiz questions by ID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { quizId: string } }
) {
  try {
    const quizId = params.quizId;
    
    if (!quizId || quizId === 'null') {
      return NextResponse.json(
        { success: false, error: 'Quiz ID required' },
        { status: 400 }
      );
    }
    
    // Try elearning_quizzes first (new table)
    const { data: quiz, error: quizError } = await supabase
      .from('elearning_quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    
    if (quiz && !quizError) {
      return NextResponse.json({
        success: true,
        quiz: {
          id: quiz.id,
          name: quiz.name,
          passing_score: quiz.passing_score,
        },
        questions: quiz.questions || [],
      });
    }
    
    // Fallback: try video_quizzes table (old table)
    const { data: videoQuizzes, error: vqError } = await supabase
      .from('video_quizzes')
      .select('*')
      .eq('video_id', quizId);
    
    if (videoQuizzes && videoQuizzes.length > 0 && !vqError) {
      const formattedQuestions = videoQuizzes.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correct: q.correct_answer,
        explanation: q.explanation,
      }));
      
      return NextResponse.json({
        success: true,
        quiz: { id: quizId, name: 'Quiz', passing_score: 60 },
        questions: formattedQuestions,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Quiz not found' },
      { status: 404 }
    );
    
  } catch (error: any) {
    console.error('Quiz API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
