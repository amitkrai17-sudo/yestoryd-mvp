// =============================================================================
// FILE: app/api/elearning/submit-quiz/route.ts
// PURPOSE: Submit quiz answers and award XP
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface QuizAnswer {
  questionId: string;
  selectedOptionId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childId, videoId, answers, timeTakenSeconds } = body;

    if (!childId || !videoId || !answers) {
      return NextResponse.json(
        { error: 'childId, videoId, and answers are required' },
        { status: 400 }
      );
    }

    // Get quiz questions for this video
    const { data: questions, error: questionsError } = await supabase
      .from('video_quizzes')
      .select('id, question_text, correct_option_id, points')
      .eq('video_id', videoId)
      .order('display_order');

    if (questionsError || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'Quiz not found for this video' }, { status: 404 });
    }

    // Grade the quiz
    let correctCount = 0;
    const gradedAnswers: any[] = [];

    for (const question of questions) {
      const userAnswer = answers.find((a: QuizAnswer) => a.questionId === question.id);
      const isCorrect = userAnswer?.selectedOptionId === question.correct_option_id;
      
      if (isCorrect) {
        correctCount++;
      }

      gradedAnswers.push({
        questionId: question.id,
        questionText: question.question_text,
        selectedOptionId: userAnswer?.selectedOptionId || null,
        correctOptionId: question.correct_option_id,
        isCorrect,
        points: isCorrect ? (question.points || 10) : 0,
      });
    }

    const totalQuestions = questions.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const isPassed = scorePercent >= 70;
    const isPerfect = scorePercent === 100;

    // Calculate XP
    const baseXP = isPassed ? 50 : 0;
    const perfectBonus = isPerfect ? 30 : 0;

    // Check if this is a retry
    const { data: existingProgress } = await supabase
      .from('child_video_progress')
      .select('quiz_attempted, quiz_passed, best_quiz_score, quiz_attempts')
      .eq('child_id', childId)
      .eq('video_id', videoId)
      .single();

    const previouslyPassed = existingProgress?.quiz_passed === true;
    const previouslyPerfect = existingProgress?.best_quiz_score === 100;
    const isBestScore = !existingProgress?.best_quiz_score || scorePercent > existingProgress.best_quiz_score;

    // Only award XP on first pass or first perfect
    let actualXPAwarded = 0;
    if (isPassed && !previouslyPassed) {
      actualXPAwarded = baseXP + (isPerfect ? perfectBonus : 0);
    } else if (isPerfect && !previouslyPerfect && previouslyPassed) {
      actualXPAwarded = perfectBonus;
    }

    // Update video progress with quiz result
    const quizProgressUpdate: any = {
      quiz_attempted: true,
      quiz_score: scorePercent,
      quiz_passed: isPassed,
      quiz_completed_at: new Date().toISOString(),
    };

    const { data: currentProgress } = await supabase
      .from('child_video_progress')
      .select('quiz_attempts, best_quiz_score')
      .eq('child_id', childId)
      .eq('video_id', videoId)
      .single();

    quizProgressUpdate.quiz_attempts = (currentProgress?.quiz_attempts || 0) + 1;
    
    if (isBestScore) {
      quizProgressUpdate.best_quiz_score = scorePercent;
    }

    await supabase
      .from('child_video_progress')
      .update(quizProgressUpdate)
      .eq('child_id', childId)
      .eq('video_id', videoId);

    // Update gamification if XP awarded
    let newBadges: string[] = [];
    if (actualXPAwarded > 0) {
      const { data: gamification } = await supabase
        .from('child_gamification')
        .select('*')
        .eq('child_id', childId)
        .single();

      if (gamification) {
        const today = new Date().toISOString().split('T')[0];
        const lastActivity = gamification.last_activity_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let newStreak = gamification.current_streak_days;
        if (lastActivity === yesterday) {
          newStreak += 1;
        } else if (lastActivity !== today) {
          newStreak = 1;
        }

        const newTotalXP = gamification.total_xp + actualXPAwarded;
        const newQuizzesCompleted = isPassed && !previouslyPassed
          ? gamification.total_quizzes_completed + 1 
          : gamification.total_quizzes_completed;
        const newPerfectCount = isPerfect && !previouslyPerfect
          ? gamification.perfect_quiz_count + 1
          : gamification.perfect_quiz_count;

        const newLevel = calculateLevel(newTotalXP);

        await supabase
          .from('child_gamification')
          .update({
            total_xp: newTotalXP,
            current_level: newLevel,
            current_streak_days: newStreak,
            longest_streak_days: Math.max(newStreak, gamification.longest_streak_days),
            last_activity_date: today,
            total_quizzes_completed: newQuizzesCompleted,
            perfect_quiz_count: newPerfectCount,
            updated_at: new Date().toISOString(),
          })
          .eq('child_id', childId);

        newBadges = await checkQuizBadges(childId, {
          quizzesPassed: newQuizzesCompleted,
          perfectScores: newPerfectCount,
        });

        await supabase
          .from('learning_events')
          .insert({
            child_id: childId,
            event_type: 'quiz',
            event_data: {
              videoId,
              score: scorePercent,
              passed: isPassed,
              perfect: isPerfect,
              xpAwarded: actualXPAwarded,
              attempt: quizProgressUpdate.quiz_attempts,
            },
          });
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        score: scorePercent,
        correctCount,
        totalQuestions,
        passed: isPassed,
        perfect: isPerfect,
        xpEarned: actualXPAwarded,
        newBadges,
        gradedAnswers,
      },
    });
  } catch (error: any) {
    console.error('Submit quiz error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}

function calculateLevel(totalXP: number): number {
  if (totalXP >= 11000) return 10;
  if (totalXP >= 8000) return 9;
  if (totalXP >= 5500) return 8;
  if (totalXP >= 3500) return 7;
  if (totalXP >= 2000) return 6;
  if (totalXP >= 1000) return 5;
  if (totalXP >= 500) return 4;
  if (totalXP >= 250) return 3;
  if (totalXP >= 100) return 2;
  return 1;
}

async function checkQuizBadges(childId: string, stats: { quizzesPassed: number; perfectScores: number }): Promise<string[]> {
  const newBadges: string[] = [];

  const badgeChecks = [
    { condition: stats.quizzesPassed >= 1, name: 'Quiz Starter', icon: '✅', description: 'Passed your first quiz' },
    { condition: stats.quizzesPassed >= 5, name: 'Quiz Pro', icon: '🎯', description: 'Passed 5 quizzes' },
    { condition: stats.quizzesPassed >= 10, name: 'Quiz Master', icon: '🏆', description: 'Passed 10 quizzes' },
    { condition: stats.perfectScores >= 1, name: 'Perfect!', icon: '💎', description: 'Got your first perfect quiz score' },
    { condition: stats.perfectScores >= 5, name: 'Perfectionist', icon: '🌈', description: 'Got 5 perfect quiz scores' },
    { condition: stats.perfectScores >= 10, name: 'Flawless', icon: '👑', description: 'Got 10 perfect quiz scores' },
  ];

  for (const badge of badgeChecks) {
    if (badge.condition) {
      const { data: existing } = await supabase
        .from('child_badges')
        .select('id')
        .eq('child_id', childId)
        .eq('badge_name', badge.name)
        .single();

      if (!existing) {
        await supabase
          .from('child_badges')
          .insert({
            child_id: childId,
            badge_name: badge.name,
            badge_icon: badge.icon,
            badge_description: badge.description,
            badge_category: 'achievement',
          });
        newBadges.push(badge.name);
      }
    }
  }

  return newBadges;
}
