// =============================================================================
// FILE: app/api/elearning/quiz-questions/route.ts
// PURPOSE: Get quiz questions for a video
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    // Get quiz questions from video_quizzes table
    const { data: questions, error } = await supabase
      .from('video_quizzes')
      .select('id, question_text, question_type, options, correct_option_id, explanation, display_order, points')
      .eq('video_id', videoId)
      .order('display_order');

    if (error) {
      console.error('Quiz questions error:', error);
      throw error;
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ questions: [], message: 'No quiz for this video' });
    }

    // Format questions for frontend (hide correct answer)
    const formattedQuestions = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type || 'multiple_choice',
      options: q.options,
      points: q.points || 10,
    }));

    return NextResponse.json({
      questions: formattedQuestions,
      totalQuestions: formattedQuestions.length,
      totalPoints: questions.reduce((sum, q) => sum + (q.points || 10), 0),
    });
  } catch (error: any) {
    console.error('Quiz questions API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get quiz questions' },
      { status: 500 }
    );
  }
}
