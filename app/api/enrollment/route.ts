import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  try {
    const { enrollmentId } = params;

    // Get enrollment with related data
    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        children (
          id,
          name,
          age,
          parent_email,
          parent_phone,
          parent_name
        ),
        coaches (
          id,
          name,
          email
        )
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Check if already confirmed
    if (enrollment.schedule_confirmed) {
      return NextResponse.json(
        { error: 'Schedule already confirmed', alreadyConfirmed: true },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: enrollment.children?.id,
      enrollmentId: enrollment.id,
      childName: enrollment.children?.name,
      parentName: enrollment.children?.parent_name,
      parentEmail: enrollment.children?.parent_email,
      parentPhone: enrollment.children?.parent_phone,
      preferredDay: enrollment.preferred_day,
      preferredTime: enrollment.preferred_time,
      coachName: enrollment.coaches?.name,
      coachEmail: enrollment.coaches?.email,
      createdAt: enrollment.created_at,
    });
  } catch (error: any) {
    console.error('Error fetching enrollment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
