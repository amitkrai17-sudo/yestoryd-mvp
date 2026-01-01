// file: app/api/assessment/result/[childId]/route.ts
// Fetches complete assessment data for results page

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { childId: string } }
) {
  try {
    const { childId } = params;

    if (!childId) {
      return NextResponse.json(
        { error: 'Child ID is required' },
        { status: 400 }
      );
    }

    // Fetch child data
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('*')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      console.error('Child not found:', childError);
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Fetch the most recent assessment learning event for this child
    const { data: learningEvent } = await supabase
      .from('learning_events')
      .select('event_data, ai_summary, created_at')
      .eq('child_id', childId)
      .eq('event_type', 'assessment')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const eventData = learningEvent?.event_data || {};

    // Build response combining child data and learning event data
    const response = {
      // Basic info
      childId: child.id,
      childName: child.child_name || child.name,
      childAge: child.age?.toString() || '',
      parentName: child.parent_name || '',
      parentEmail: child.parent_email || '',
      parentPhone: child.parent_phone || '',

      // Scores - prefer eventData, fallback to child table
      overall_score: eventData.score || child.latest_assessment_score || 0,
      clarity_score: eventData.clarity_score || 5,
      fluency_score: eventData.fluency_score || 5,
      speed_score: eventData.speed_score || 5,
      wpm: eventData.wpm || 0,
      completeness: eventData.completeness || eventData.completeness_percentage || 0,

      // Feedback
      feedback: eventData.feedback || '',
      errors: eventData.errors || [],
      strengths: eventData.strengths || [],
      areas_to_improve: eventData.areas_to_improve || [],

      // Enhanced data (new fields)
      error_classification: eventData.error_classification || null,
      phonics_analysis: eventData.phonics_analysis || {
        recommended_focus: child.phonics_focus || null,
        struggling_phonemes: child.struggling_phonemes || [],
        strong_phonemes: [],
        phoneme_details: [],
      },
      skill_breakdown: eventData.skill_breakdown || null,
      practice_recommendations: eventData.practice_recommendations || null,

      // Metadata
      assessed_at: learningEvent?.created_at || child.created_at,
      ai_summary: learningEvent?.ai_summary || null,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Assessment result API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessment data' },
      { status: 500 }
    );
  }
}
