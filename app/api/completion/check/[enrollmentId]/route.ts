// =============================================================================
// FILE: app/api/completion/check/[enrollmentId]/route.ts
// PURPOSE: Check if enrollment is eligible for completion
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPricingConfig } from '@/lib/config/pricing-config';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // Get enrollment with total_sessions for V3 dynamic completion
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        completion_triggered_at,
        program_start,
        program_end,
        child_id,
        coach_id,
        total_sessions,
        age_band
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({
        eligible: false,
        reason: 'Enrollment not found',
        sessionsCompleted: { coaching: 0, total: 0 }
      });
    }

    if (enrollment.completion_triggered_at) {
      return NextResponse.json({
        eligible: false,
        reason: 'Completion already triggered',
        triggeredAt: enrollment.completion_triggered_at,
        sessionsCompleted: { coaching: 0, total: 0 }
      });
    }

    if (enrollment.status !== 'active') {
      return NextResponse.json({
        eligible: false,
        reason: `Enrollment status is ${enrollment.status}`,
        sessionsCompleted: { coaching: 0, total: 0 }
      });
    }

    // Count completed coaching sessions (V3: coaching-only completion)
    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select('session_type, status')
      .eq('enrollment_id', enrollmentId);

    const coachingCompleted = sessions?.filter(
      s => s.session_type === 'coaching' && s.status === 'completed'
    ).length || 0;

    // V3: completion based on coaching sessions vs enrollment.total_sessions
    const pricingConfig = await getPricingConfig();
    const bandSessions = pricingConfig.ageBands.find(b => b.id === ((enrollment as any).age_band || 'building'))?.sessionsPerSeason;
    const totalExpected = enrollment.total_sessions || bandSessions || 9;
    const isEligible = coachingCompleted >= totalExpected;

    return NextResponse.json({
      eligible: isEligible,
      reason: isEligible
        ? 'All coaching sessions completed'
        : `Need ${Math.max(0, totalExpected - coachingCompleted)} more coaching sessions`,
      sessionsCompleted: {
        coaching: coachingCompleted,
        total: coachingCompleted,
      },
      totalExpected,
      enrollmentId,
      childId: enrollment.child_id,
      coachId: enrollment.coach_id,
    });

  } catch (error) {
    console.error('Completion check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
