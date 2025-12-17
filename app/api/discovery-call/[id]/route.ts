// app/api/discovery-call/[id]/route.ts
// Get discovery call details with AI-suggested questions

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// AI-suggested questions based on assessment data
function generateSuggestedQuestions(call: any): string[] {
  const questions: string[] = [];
  
  // Base questions for all calls
  questions.push(`"How often does ${call.child_name} read at home currently?"`);
  questions.push(`"Does ${call.child_name} enjoy reading or resist it?"`);
  questions.push(`"What are your goals for ${call.child_name}'s reading in 3 months?"`);
  questions.push(`"Has ${call.child_name} had any reading support before?"`);
  questions.push(`"What time works best for weekly sessions?"`);
  
  // Score-based questions
  if (call.assessment_score) {
    if (call.assessment_score < 5) {
      questions.push(`"I noticed ${call.child_name} scored ${call.assessment_score}/10. Have you observed any specific struggles at home?"`);
      questions.push(`"Does ${call.child_name} get frustrated when reading difficult words?"`);
    } else if (call.assessment_score >= 7) {
      questions.push(`"${call.child_name} scored well at ${call.assessment_score}/10! What would you like to focus on - speed, comprehension, or confidence?"`);
    }
  }
  
  // Age-based questions
  if (call.child_age) {
    if (call.child_age <= 5) {
      questions.push(`"At ${call.child_age} years old, we focus a lot on phonics and letter sounds. Is ${call.child_name} familiar with the alphabet?"`);
    } else if (call.child_age >= 8) {
      questions.push(`"For ${call.child_age}-year-olds, we often work on comprehension and reading fluency. Does ${call.child_name} understand what they read?"`);
    }
  }
  
  // WPM-based questions
  if (call.assessment_wpm) {
    if (call.assessment_wpm < 60) {
      questions.push(`"${call.child_name}'s reading speed is ${call.assessment_wpm} words per minute. Would you like us to focus on building fluency?"`);
    }
  }
  
  // Closing questions
  questions.push(`"Any specific concerns about ${call.child_name}'s reading that we haven't discussed?"`);
  
  return questions;
}

// Closing prompts for the coach
function generateClosingPrompts(call: any): string[] {
  return [
    `"Based on ${call.child_name}'s assessment, I'd focus on [specific area based on score]..."`,
    `"In 3 months, you can expect ${call.child_name} to [improvement prediction]..."`,
    `"Our program includes 6 coaching sessions plus 3 parent check-ins over 12 weeks."`,
    `"The investment is ₹5,999 for the full 3-month program, which also includes free access to our eLearning library and storytelling sessions."`,
    `"Ready to get started? I'll send you the payment link right after our call."`,
  ];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch discovery call with coach details
    const { data: call, error } = await supabase
      .from('discovery_calls')
      .select(`
        *,
        coach:coaches!assigned_coach_id (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single();

    if (error || !call) {
      return NextResponse.json(
        { error: 'Discovery call not found' },
        { status: 404 }
      );
    }

    // Generate AI-suggested questions
    const suggestedQuestions = generateSuggestedQuestions(call);
    const closingPrompts = generateClosingPrompts(call);

    return NextResponse.json({
      success: true,
      call,
      suggestedQuestions,
      closingPrompts,
    });

  } catch (error) {
    console.error('Error fetching discovery call:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
