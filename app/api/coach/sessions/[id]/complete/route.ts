// =============================================================================
// FILE: app/api/discovery-call/[id]/route.ts
// CORRECT APPROACH: Use discovery_calls table ONLY (no unnecessary joins)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const authResult = await requireAdminOrCoach();
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const callId = params.id;

    // ═══════════════════════════════════════════════════════════════
    // FETCH FROM discovery_calls ONLY (has all data we need!)
    // Only join: assigned coach (for coach name/contact)
    // ═══════════════════════════════════════════════════════════════

    const { data: call, error } = await supabase
      .from('discovery_calls')
      .select(`
        *,
        assigned_coach:coaches!assigned_coach_id(
          id,
          name,
          email,
          phone,
          photo_url
        )
      `)
      .eq('id', callId)
      .single();

    if (error) {
      console.error('Discovery call fetch error:', error);
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    if (!call) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // GENERATE AI QUESTIONS
    // Using data from discovery_calls table
    // ═══════════════════════════════════════════════════════════════

    const aiQuestions = generateAIQuestions(call);

    return NextResponse.json({
      call,
      aiQuestions
    });

  } catch (error) {
    console.error('Discovery call API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// AI QUESTION GENERATION
// Using discovery_calls table columns only
// =============================================================================

function generateAIQuestions(call: any) {
  const questions = [];

  // ═══════════════════════════════════════════════════════════════
  // BASELINE QUESTIONS (Always ask)
  // ═══════════════════════════════════════════════════════════════

  questions.push({
    category: 'Reading Habits',
    question: 'How often does your child currently read at home?',
    priority: 'high'
  });

  questions.push({
    category: 'Learning Goals',
    question: 'What are your primary goals for your child\'s reading development?',
    priority: 'high'
  });

  questions.push({
    category: 'Learning Environment',
    question: 'What time of day does your child seem most focused for learning?',
    priority: 'medium'
  });

  // ═══════════════════════════════════════════════════════════════
  // ASSESSMENT-BASED QUESTIONS
  // Using: assessment_score, assessment_wpm, assessment_feedback
  // ═══════════════════════════════════════════════════════════════

  // Score-based questions
  if (call.assessment_score !== null && call.assessment_score !== undefined) {
    const score = parseFloat(call.assessment_score);
    
    if (score < 50) {
      questions.push({
        category: 'Reading Challenges',
        question: `Your child's assessment shows they're building foundational skills (score: ${score}/100). What specific reading challenges have you noticed at home?`,
        priority: 'high'
      });
    } else if (score >= 50 && score < 70) {
      questions.push({
        category: 'Progress Areas',
        question: `Your child is developing their reading skills (score: ${score}/100). Which areas would you like to see the most improvement in?`,
        priority: 'high'
      });
    } else if (score >= 70 && score < 85) {
      questions.push({
        category: 'Skill Building',
        question: `Your child shows good reading ability (score: ${score}/100). Are you looking to build fluency, comprehension, or both?`,
        priority: 'medium'
      });
    } else {
      questions.push({
        category: 'Advanced Reading',
        question: `Your child demonstrates strong reading skills (score: ${score}/100)! Would you like to focus on advanced comprehension or creative expression?`,
        priority: 'medium'
      });
    }
  }

  // WPM-based questions
  if (call.assessment_wpm) {
    const wpm = call.assessment_wpm;
    const expectedWPM = getExpectedWPMByAge(call.child_age);
    const wpmRatio = wpm / expectedWPM;

    if (wpmRatio < 0.7) {
      questions.push({
        category: 'Reading Fluency',
        question: `Your child's reading speed is ${wpm} words per minute. Do they struggle with word recognition, or do they prefer reading slowly for comprehension?`,
        priority: 'high'
      });
    } else if (wpmRatio > 1.3) {
      questions.push({
        category: 'Reading Comprehension',
        question: `Your child reads quite fast at ${wpm} WPM! How is their comprehension when reading at this speed?`,
        priority: 'medium'
      });
    } else {
      questions.push({
        category: 'Reading Speed',
        question: `Your child reads at ${wpm} words per minute, which is age-appropriate. Would you like us to work on increasing speed while maintaining comprehension?`,
        priority: 'low'
      });
    }
  }

  // Assessment feedback-based questions
  if (call.assessment_feedback) {
    questions.push({
      category: 'AI Assessment Insights',
      question: `Based on the reading assessment, our AI noticed: "${call.assessment_feedback.substring(0, 100)}...". Does this match what you observe at home?`,
      priority: 'medium'
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // QUESTIONNAIRE-BASED QUESTIONS
  // Using: questionnaire JSONB field (if filled during booking)
  // ═══════════════════════════════════════════════════════════════

  if (call.questionnaire) {
    // Extract any pre-filled questionnaire data
    const q = call.questionnaire;

    if (q.reading_challenges) {
      questions.push({
        category: 'Specific Challenges',
        question: `You mentioned challenges with ${q.reading_challenges}. Can you tell me more about when this is most noticeable?`,
        priority: 'high'
      });
    }

    if (q.favorite_subjects) {
      questions.push({
        category: 'Child\'s Interests',
        question: `Your child enjoys ${q.favorite_subjects}. Would you like us to incorporate these topics into reading materials?`,
        priority: 'medium'
      });
    }

    if (q.parent_concerns) {
      questions.push({
        category: 'Your Concerns',
        question: `You've expressed concern about: "${q.parent_concerns}". What outcome would make you feel this concern is addressed?`,
        priority: 'high'
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AGE-BASED QUESTIONS
  // Using: child_age
  // ═══════════════════════════════════════════════════════════════

  if (call.child_age) {
    const age = call.child_age;
    
    if (age >= 4 && age <= 6) {
      questions.push({
        category: 'Early Learning',
        question: 'Is your child familiar with letter sounds and basic phonics?',
        priority: 'high'
      });
    } else if (age >= 7 && age <= 9) {
      questions.push({
        category: 'Reading Independence',
        question: 'Can your child read simple sentences and short stories independently?',
        priority: 'high'
      });
    } else if (age >= 10) {
      questions.push({
        category: 'Advanced Reading',
        question: 'What types of books does your child enjoy reading? Fiction, non-fiction, graphic novels?',
        priority: 'medium'
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SORT BY PRIORITY
  // ═══════════════════════════════════════════════════════════════

  return questions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority as keyof typeof priorityOrder] - 
           priorityOrder[b.priority as keyof typeof priorityOrder];
  });
}

// =============================================================================
// HELPER: Expected WPM by Age
// =============================================================================

function getExpectedWPMByAge(age: number): number {
  const wpmByAge: { [key: number]: number } = {
    4: 30,
    5: 40,
    6: 60,
    7: 80,
    8: 100,
    9: 120,
    10: 140,
    11: 150,
    12: 160,
  };
  return wpmByAge[age] || 100;
}