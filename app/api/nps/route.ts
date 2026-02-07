// =============================================================================
// FILE: app/api/nps/route.ts
// PURPOSE: NPS (Net Promoter Score) survey API
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Retrieve NPS response for an enrollment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');

    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: 'Enrollment ID required' },
        { status: 400 }
      );
    }

    const { data: nps, error } = await supabase
      .from('nps_responses')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('NPS fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch NPS response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      exists: !!nps,
      data: nps || null,
    });

  } catch (error: any) {
    console.error('NPS GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Submit NPS response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      enrollmentId,
      score,
      feedback,
      improvements,
      wouldRecommend,
      testimonialConsent,
      testimonialText,
    } = body;

    // Validation
    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: 'Enrollment ID required' },
        { status: 400 }
      );
    }

    if (score === undefined || score < 0 || score > 10) {
      return NextResponse.json(
        { success: false, error: 'Score must be between 0 and 10' },
        { status: 400 }
      );
    }

    // Check if already submitted
    const { data: existing } = await supabase
      .from('nps_responses')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'NPS already submitted for this enrollment' },
        { status: 400 }
      );
    }

    // Get enrollment details
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select(`
        id,
        parent_id,
        child_id,
        coach_id,
        children!child_id (name, child_name),
        parents!parent_id (name, email),
        coaches!coach_id (name)
      `)
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Determine NPS category
    let category: 'promoter' | 'passive' | 'detractor';
    if (score >= 9) {
      category = 'promoter';
    } else if (score >= 7) {
      category = 'passive';
    } else {
      category = 'detractor';
    }

    // Insert NPS response
    const { data: nps, error: insertError } = await supabase
      .from('nps_responses')
      .insert({
        enrollment_id: enrollmentId,
        parent_id: enrollment.parent_id,
        child_id: enrollment.child_id,
        coach_id: enrollment.coach_id,
        score,
        category,
        feedback: feedback || null,
        improvements: improvements || null,
        would_recommend: wouldRecommend ?? (score >= 7),
        testimonial_consent: testimonialConsent || false,
        testimonial_text: testimonialText || null,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('NPS insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save NPS response' },
        { status: 500 }
      );
    }

    // Log event
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: 'nps_submitted',
      event_data: {
        score,
        category,
        has_feedback: !!feedback,
        testimonial_consent: testimonialConsent,
      },
      triggered_by: 'parent',
    });

    // If testimonial consent given and score is high, flag for marketing
    if (testimonialConsent && score >= 8 && testimonialText) {
      await supabase.from('testimonials').insert({
        nps_response_id: nps.id,
        enrollment_id: enrollmentId,
        parent_id: enrollment.parent_id,
        child_name: (enrollment.children as any)?.name || (enrollment.children as any)?.child_name,
        parent_name: (enrollment.parents as any)?.name,
        coach_name: (enrollment.coaches as any)?.name,
        text: testimonialText,
        score,
        status: 'pending_review', // Admin needs to approve
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your feedback!',
      data: {
        id: nps.id,
        score,
        category,
      },
    });

  } catch (error: any) {
    console.error('NPS POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
