import { NextRequest, NextResponse } from 'next/server';
import { getGenAI } from '@/lib/gemini/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { insertLearningEvent } from '@/lib/rai/learning-events';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

interface QuizSubmitRequest {
  childId: string;
  sessionId?: string;
  quizId?: string;
  topic: string;
  questions: Array<{
    id: number;
    question: string;
    correct_answer: string;
  }>;
  answers: Array<{
    questionId: number;
    answer: string;
  }>;
  timeTakenSeconds: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: QuizSubmitRequest = await request.json();
    
    const {
      childId,
      sessionId,
      quizId,
      topic,
      questions,
      answers,
      timeTakenSeconds,
    } = body;

    if (!childId || !questions || !answers) {
      return NextResponse.json(
        { success: false, error: 'childId, questions, and answers are required' },
        { status: 400 }
      );
    }

    // Get child details
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

    // Calculate score
    let correctCount = 0;
    const detailedResults: Array<{
      questionId: number;
      question: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }> = [];

    questions.forEach((q) => {
      const userAnswer = answers.find((a) => a.questionId === q.id)?.answer || '';
      const isCorrect = userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
      
      if (isCorrect) correctCount++;
      
      detailedResults.push({
        questionId: q.id,
        question: q.question,
        userAnswer,
        correctAnswer: q.correct_answer,
        isCorrect,
      });
    });

    const score = correctCount;
    const total = questions.length;
    const percentage = Math.round((score / total) * 100);

    // Determine performance level
    let performanceLevel: string;
    if (percentage >= 80) performanceLevel = 'Excellent';
    else if (percentage >= 60) performanceLevel = 'Good';
    else if (percentage >= 40) performanceLevel = 'Needs Practice';
    else performanceLevel = 'Needs Attention';

    // Generate AI summary
    const wrongAnswers = detailedResults.filter((r) => !r.isCorrect);
    const wrongTopics = wrongAnswers.map((r) => r.question).join('; ');

    const aiSummary = `${childName} scored ${score}/${total} (${percentage}%) on ${topic} quiz. Performance: ${performanceLevel}.${wrongAnswers.length > 0 ? ` Areas to review: ${wrongAnswers.length} question(s) missed.` : ' All questions answered correctly!'}`;

    // Save to quiz_attempts
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        child_id: childId,
        session_id: sessionId || null,
        quiz_id: quizId || null,
        quiz_type: quizId ? 'bank' : 'generated',
        questions,
        answers: detailedResults,
        score,
        total,
        time_taken_seconds: timeTakenSeconds,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Quiz attempt save error:', attemptError);
    }

    // Prepare data for learning_events
    const quizData = {
      quiz_id: quizId,
      attempt_id: attempt?.id,
      topic,
      score,
      total,
      percentage,
      performance_level: performanceLevel,
      time_taken_seconds: timeTakenSeconds,
      wrong_count: wrongAnswers.length,
      session_id: sessionId,
    };

    // Create searchable text for embedding
    const searchableText = `quiz ${topic} score ${score} out of ${total} ${percentage} percent ${performanceLevel} ${wrongAnswers.length > 0 ? 'missed questions' : 'perfect score'} ${aiSummary}`;

    // Save to learning_events
    const learningEvent = await insertLearningEvent({
      childId,
      eventType: 'quiz',
      eventDate: new Date().toISOString(),
      eventData: quizData,
      contentForEmbedding: searchableText,
      aiSummary,
      legacyData: quizData,
      signalSource: 'elearning_system',
      signalConfidence: 'medium',
    });

    const eventError = learningEvent === null;
    if (eventError) {
      console.error('Learning event save error: insertLearningEvent returned null');
    }

    // If linked to a session, update session with quiz completion
    if (sessionId) {
      await supabase
        .from('scheduled_sessions')
        .update({
          quiz_assigned_id: attempt?.id?.toString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      success: true,
      result: {
        score,
        total,
        percentage,
        performanceLevel,
        timeTakenSeconds,
        detailedResults,
        aiSummary,
      },
      savedToHistory: !eventError,
    });

  } catch (error: any) {
    console.error('Quiz submit error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}
