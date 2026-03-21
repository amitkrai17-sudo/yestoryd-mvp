// ============================================================
// FILE: app/api/tuition/pay/[enrollmentId]/route.ts
// PURPOSE: Fetch tuition enrollment data for the checkout page.
//          Public route (no auth) — enrollment ID is the token.
//          Supports ?renewal=true for active enrollment top-ups.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const { enrollmentId } = await params;
  const isRenewal = request.nextUrl.searchParams.get('renewal') === 'true';
  const supabase = getServiceSupabase();

  // Fetch enrollment
  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select(`
      id, child_id, parent_id, coach_id, session_rate, sessions_purchased,
      session_duration_minutes, enrollment_type, status, amount, sessions_remaining
    `)
    .eq('id', enrollmentId)
    .eq('enrollment_type', 'tuition')
    .single();

  if (error || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  // Block "already paid" only for first-time payments, not renewals
  if (!isRenewal && enrollment.status === 'active' && enrollment.amount && enrollment.amount > 0) {
    return NextResponse.json({ error: 'This enrollment has already been paid', alreadyPaid: true }, { status: 400 });
  }

  // For renewals, enrollment must be active or paused (not payment_pending)
  if (isRenewal && enrollment.status === 'payment_pending') {
    return NextResponse.json({ error: 'Please complete the initial payment first' }, { status: 400 });
  }

  // Fetch child name
  const { data: child } = enrollment.child_id
    ? await supabase.from('children').select('child_name, age').eq('id', enrollment.child_id).single()
    : { data: null };

  // Fetch parent info
  const { data: parent } = enrollment.parent_id
    ? await supabase.from('parents').select('name, email, phone').eq('id', enrollment.parent_id).single()
    : { data: null };

  // Fetch coach name
  const { data: coach } = enrollment.coach_id
    ? await supabase.from('coaches').select('name').eq('id', enrollment.coach_id).single()
    : { data: null };

  const sessionRate = enrollment.session_rate || 0;
  const sessionsPurchased = enrollment.sessions_purchased || 0;
  const totalAmountRupees = (sessionRate * sessionsPurchased) / 100;

  return NextResponse.json({
    id: enrollment.id,
    childName: child?.child_name || 'Student',
    childAge: child?.age || null,
    childId: enrollment.child_id,
    parentName: parent?.name || 'Parent',
    parentEmail: parent?.email || '',
    parentPhone: parent?.phone || '',
    parentId: enrollment.parent_id,
    coachName: coach?.name || 'Coach',
    coachId: enrollment.coach_id,
    sessionRate,
    sessionsPurchased,
    totalAmountRupees,
    sessionDurationMinutes: enrollment.session_duration_minutes || 60,
    status: enrollment.status,
    isRenewal,
    sessionsRemaining: enrollment.sessions_remaining ?? 0,
  });
}
