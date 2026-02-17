// =============================================================================
// QUIZ API
// Fetch quiz questions by ID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

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
    
    // Fetch quiz questions from video_quizzes table
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
