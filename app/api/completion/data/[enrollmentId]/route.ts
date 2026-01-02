// =============================================================================
// FILE: app/api/completion/data/[enrollmentId]/route.ts
// PURPOSE: Fetch certificate data and next steps for completion page
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // Get certificate data
    const { data: certificate, error: certError } = await supabase
      .from('completion_certificates')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .single();

    if (certError) {
      console.error('Certificate fetch error:', certError);
    }

    // Get enrollment with related data
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        child:children(
          id, child_name, parent_id, parent_name, parent_email
        ),
        coach:coaches(id, name)
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Get parent's referral code
    const { data: referralCoupon } = await supabase
      .from('coupons')
      .select('code')
      .eq('parent_id', enrollment.child?.parent_id)
      .eq('coupon_type', 'parent_referral')
      .single();

    // Get parent's credit balance
    const { data: parent } = await supabase
      .from('parents')
      .select('referral_credit_balance, referral_credit_expires_at')
      .eq('id', enrollment.child?.parent_id)
      .single();

    // Get loyalty discount settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['loyalty_discount_percent', 'loyalty_discount_days']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
      settingsMap[s.key] = s.value?.replace(/"/g, '') || '';
    });

    const loyaltyDiscountPercent = parseInt(settingsMap.loyalty_discount_percent || '10');
    const loyaltyDiscountDays = parseInt(settingsMap.loyalty_discount_days || '7');

    // Calculate if loyalty discount is available
    const programEndDate = enrollment.program_end ? new Date(enrollment.program_end) : new Date();
    const loyaltyExpiresAt = new Date(programEndDate);
    loyaltyExpiresAt.setDate(loyaltyExpiresAt.getDate() + loyaltyDiscountDays);
    const loyaltyDiscountAvailable = new Date() <= loyaltyExpiresAt;

    // Format certificate data
    const certificateData = certificate ? {
      certificateNumber: certificate.certificate_number,
      childName: certificate.child_name,
      coachName: certificate.coach_name,
      programStart: certificate.program_start_date,
      programEnd: certificate.program_end_date,
      certificateUrl: certificate.certificate_url,
      progressReportUrl: certificate.progress_report_url,
      improvements: certificate.improvement_data,
      report: certificate.report_content,
    } : {
      certificateNumber: 'Pending',
      childName: enrollment.child?.child_name,
      coachName: enrollment.coach?.name,
      programStart: enrollment.program_start,
      programEnd: enrollment.program_end,
      improvements: { clarity: 0, fluency: 0, speed: 0, wpm: 0 },
    };

    // Format next steps data
    const nextStepsData = {
      hasReferralCode: !!referralCoupon,
      referralCode: referralCoupon?.code,
      creditBalance: parent?.referral_credit_balance || 0,
      loyaltyDiscountAvailable,
      loyaltyDiscountPercent,
      loyaltyExpiresAt: loyaltyDiscountAvailable ? loyaltyExpiresAt.toISOString() : undefined,
      elearningAvailable: true,
    };

    return NextResponse.json({
      certificate: certificateData,
      nextSteps: nextStepsData,
    });

  } catch (error) {
    console.error('Completion data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
