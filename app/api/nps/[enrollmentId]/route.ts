// =============================================================================
// FILE: app/api/nps/[enrollmentId]/route.ts
// PURPOSE: NPS survey data fetch and submission
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// GET: Check if NPS already submitted and get enrollment data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // Check if already submitted
    const { data: existingNps } = await supabase
      .from('nps_responses')
      .select('id, score')
      .eq('enrollment_id', enrollmentId)
      .single();

    // Get enrollment data
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select('id, program_end, child_id, coach_id')
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Fetch child data separately
    const { data: child } = await supabase
      .from('children')
      .select('child_name, parent_name, parent_email')
      .eq('id', enrollment.child_id!)
      .single();

    // Fetch coach data separately
    const { data: coach } = await supabase
      .from('coaches')
      .select('name')
      .eq('id', enrollment.coach_id!)
      .single();

    return NextResponse.json({
      alreadySubmitted: !!existingNps,
      previousScore: existingNps?.score,
      enrollment: {
        childName: child?.child_name || 'Child',
        parentName: child?.parent_name || 'Parent',
        coachName: coach?.name || 'Coach',
        programEnd: enrollment.program_end,
      },
    });

  } catch (error) {
    console.error('NPS GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Submit NPS response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const body = await request.json();

    const {
      score,
      coachRating,
      platformRating,
      contentRating,
      highlight,
      feedback,
      testimonial,
      testimonialConsent,
    } = body;

    if (score === undefined || score === null) {
      return NextResponse.json({ error: 'NPS score is required' }, { status: 400 });
    }

    // Get enrollment data
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, child_id, coach_id')
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Fetch child data separately
    const { data: child } = await supabase
      .from('children')
      .select('parent_id, parent_name, parent_email, child_name')
      .eq('id', enrollment.child_id!)
      .single();

    // Insert or update NPS response
    const { data: nps, error: npsError } = await supabase
      .from('nps_responses')
      .upsert({
        enrollment_id: enrollmentId,
        child_id: enrollment.child_id!,
        parent_id: child?.parent_id,
        coach_id: enrollment.coach_id,
        score,
        coach_rating: coachRating,
        platform_rating: platformRating,
        content_rating: contentRating,
        highlight,
        feedback,
        improvement_suggestions: feedback,
        testimonial,
        testimonial_consent: testimonialConsent,
        parent_name: child?.parent_name,
        parent_email: child?.parent_email,
        child_name: child?.child_name,
        submitted_at: new Date().toISOString(),
      }, {
        onConflict: 'enrollment_id',
      })
      .select()
      .single();

    if (npsError) {
      console.error('NPS insert error:', npsError);
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }

    // Update enrollment with NPS score
    await supabase
      .from('enrollments')
      .update({
        nps_score: score,
        nps_submitted_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    // Determine category
    const category = score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';

    return NextResponse.json({
      success: true,
      category,
      npsId: nps.id,
    });

  } catch (error) {
    console.error('NPS POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}