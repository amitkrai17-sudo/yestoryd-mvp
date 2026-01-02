// =============================================================================
// FILE: app/api/completion/check/[enrollmentId]/route.ts
// PURPOSE: Check if enrollment is eligible for completion
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

    // Get enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        completion_triggered_at,
        program_start,
        program_end,
        child_id,
        coach_id
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({
        eligible: false,
        reason: 'Enrollment not found',
        sessionsCompleted: { coaching: 0, parent: 0 }
      });
    }

    if (enrollment.completion_triggered_at) {
      return NextResponse.json({
        eligible: false,
        reason: 'Completion already triggered',
        triggeredAt: enrollment.completion_triggered_at,
        sessionsCompleted: { coaching: 6, parent: 3 }
      });
    }

    if (enrollment.status !== 'active') {
      return NextResponse.json({
        eligible: false,
        reason: `Enrollment status is ${enrollment.status}`,
        sessionsCompleted: { coaching: 0, parent: 0 }
      });
    }

    // Count completed sessions
    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select('session_type, status')
      .eq('enrollment_id', enrollmentId);

    const coachingCompleted = sessions?.filter(
      s => s.session_type === 'coaching' && s.status === 'completed'
    ).length || 0;

    const parentCompleted = sessions?.filter(
      s => s.session_type === 'parent' && s.status === 'completed'
    ).length || 0;

    // Session 9 = 6 coaching + 3 parent check-ins
    const isEligible = coachingCompleted >= 6 && parentCompleted >= 3;

    return NextResponse.json({
      eligible: isEligible,
      reason: isEligible 
        ? 'All sessions completed' 
        : `Need ${Math.max(0, 6 - coachingCompleted)} more coaching and ${Math.max(0, 3 - parentCompleted)} more check-ins`,
      sessionsCompleted: {
        coaching: coachingCompleted,
        parent: parentCompleted
      },
      enrollmentId,
      childId: enrollment.child_id,
      coachId: enrollment.coach_id,
    });

  } catch (error) {
    console.error('Completion check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
