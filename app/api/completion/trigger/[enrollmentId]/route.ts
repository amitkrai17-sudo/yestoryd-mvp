// =============================================================================
// FILE: app/api/completion/trigger/[enrollmentId]/route.ts
// PURPOSE: Trigger the completion flow - sends final assessment invite
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // Verify eligibility first
    const eligibilityCheck = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/completion/check/${enrollmentId}`
    );
    const eligibility = await eligibilityCheck.json();

    if (!eligibility.eligible) {
      return NextResponse.json({
        success: false,
        error: eligibility.reason || 'Not eligible for completion',
      }, { status: 400 });
    }

    // Get enrollment with all details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        child:children(
          id, child_name, age, grade, parent_email, parent_phone, parent_name, parent_id
        ),
        coach:coaches(id, name, email)
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({
        success: false,
        error: 'Enrollment not found',
      }, { status: 404 });
    }

    // Mark completion as triggered
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        completion_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);

    if (updateError) {
      console.error('Error updating enrollment:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update enrollment',
      }, { status: 500 });
    }

    // Generate final assessment link
    const assessmentLink = `${process.env.NEXT_PUBLIC_SITE_URL}/assessment/final?enrollment=${enrollmentId}`;

    // Send WhatsApp notification (P31: Final Assessment Invite)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/communication/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'completion_final_assessment',
          phone: enrollment.child.parent_phone,
          variables: {
            parent_name: enrollment.child.parent_name,
            child_name: enrollment.child.child_name,
            coach_name: enrollment.coach?.name || 'your coach',
            assessment_link: assessmentLink,
          },
        }),
      });
    } catch (commError) {
      console.error('Failed to send WhatsApp:', commError);
      // Don't fail the whole operation
    }

    // Send Email notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: enrollment.child.parent_email,
          template: 'completion_final_assessment',
          variables: {
            parentName: enrollment.child.parent_name,
            childName: enrollment.child.child_name,
            coachName: enrollment.coach?.name || 'your coach',
            assessmentLink,
          },
        }),
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    // Schedule follow-up reminders via QStash
    try {
      // NPS survey: 24 hours after certificate issued (will be triggered later)
      // Renewal offer: 48 hours after certificate issued (will be triggered later)
      // These are scheduled after final assessment is completed
    } catch (qstashError) {
      console.error('Failed to schedule follow-ups:', qstashError);
    }

    return NextResponse.json({
      success: true,
      message: 'Completion flow triggered',
      enrollmentId,
      childName: enrollment.child.child_name,
      assessmentLink,
      triggeredAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Completion trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
