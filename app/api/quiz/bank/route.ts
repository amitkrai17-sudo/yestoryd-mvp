import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List quizzes from bank, optionally filtered by topic
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const ageGroup = searchParams.get('ageGroup');
    const difficulty = searchParams.get('difficulty');

    let query = supabase
      .from('quiz_bank')
      .select('id, topic, subtopic, difficulty_level, age_group, created_at')
      .eq('is_active', true)
      .order('topic', { ascending: true });

    if (topic) {
      query = query.ilike('topic', `%${topic}%`);
    }

    if (ageGroup) {
      query = query.eq('age_group', ageGroup);
    }

    if (difficulty) {
      query = query.eq('difficulty_level', difficulty);
    }

    const { data: quizzes, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get unique topics for filter dropdown
    const { data: topics } = await supabase
      .from('quiz_bank')
      .select('topic')
      .eq('is_active', true);

    const uniqueTopics = [...new Set(topics?.map((t) => t.topic) || [])];

    return NextResponse.json({
      quizzes,
      topics: uniqueTopics,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST: Add a new quiz to the bank
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      topic,
      subtopic,
      difficultyLevel,
      ageGroup,
      questions,
    } = body;

    if (!topic || !questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'topic and questions are required' },
        { status: 400 }
      );
    }

    // Validate question structure
    for (const q of questions) {
      if (!q.question || !q.correct_answer) {
        return NextResponse.json(
          { error: 'Each question must have question text and correct_answer' },
          { status: 400 }
        );
      }
    }

    const { data: quiz, error } = await supabase
      .from('quiz_bank')
      .insert({
        topic,
        subtopic: subtopic || null,
        difficulty_level: difficultyLevel || 'medium',
        age_group: ageGroup || null,
        questions,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quiz,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete a quiz (set is_active = false)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('id');

    if (!quizId) {
      return NextResponse.json(
        { error: 'Quiz ID required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('quiz_bank')
      .update({ is_active: false })
      .eq('id', quizId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz deactivated',
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
