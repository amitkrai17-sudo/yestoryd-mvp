// =============================================================================
// FILE: app/api/enrollment/[id]/route.ts
// PURPOSE: Get enrollment details by ID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { capitalizeName } from '@/lib/utils';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const enrollmentId = params.id;

    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: 'Enrollment ID required' },
        { status: 400 }
      );
    }

    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        children!child_id (
          id,
          name,
          child_name,
          age,
          parent_email
        ),
        parents!parent_id (
          id,
          name,
          email,
          phone,
          referral_code
        ),
        coaches!coach_id (
          id,
          name,
          email
        )
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Get session stats
    const { count: completedSessions } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', enrollment.child_id!)
      .eq('status', 'completed');

    const { count: totalSessions } = await supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', enrollment.child_id!);

    // Capitalize names in nested objects
    const transformedEnrollment = {
      ...enrollment,
      children: enrollment.children ? {
        ...enrollment.children,
        name: capitalizeName(enrollment.children.name),
        child_name: capitalizeName(enrollment.children.child_name),
      } : null,
      parents: enrollment.parents ? {
        ...enrollment.parents,
        name: capitalizeName(enrollment.parents.name),
      } : null,
      coaches: enrollment.coaches ? {
        ...enrollment.coaches,
        name: capitalizeName(enrollment.coaches.name),
      } : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...transformedEnrollment,
        sessions: {
          completed: completedSessions || 0,
          total: totalSessions || 0,
          remaining: Math.max(0, 9 - (completedSessions || 0)),
        },
      },
    });

  } catch (error: any) {
    console.error('Enrollment fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch enrollment' },
      { status: 500 }
    );
  }
}
