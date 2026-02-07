// =============================================================================
// FILE: app/api/assessment/final/data/route.ts
// PURPOSE: Fetch enrollment data for final assessment page
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollment');

    if (!enrollmentId) {
      return NextResponse.json({ error: 'Enrollment ID required' }, { status: 400 });
    }

    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        program_start,
        program_end,
        child_id,
        coach_id
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Fetch child data separately
    const { data: child } = await supabase
      .from('children')
      .select('child_name, age, grade')
      .eq('id', enrollment.child_id)
      .single();

    // Fetch coach data separately
    const { data: coach } = await supabase
      .from('coaches')
      .select('name')
      .eq('id', enrollment.coach_id)
      .single();

    return NextResponse.json({
      childName: child?.child_name || 'Child',
      age: child?.age || 8,
      grade: child?.grade || '',
      coachName: coach?.name || 'Coach',
      programStart: enrollment.program_start,
      programEnd: enrollment.program_end,
    });

  } catch (error) {
    console.error('Final assessment data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}