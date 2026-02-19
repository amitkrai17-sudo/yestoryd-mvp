// ============================================================
// FILE: app/api/parent-call/request/route.ts
// PURPOSE: Request a parent call (by parent or coach)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enrollment_id, initiated_by, preferred_time, notes } = body;

    // Validate required fields
    if (!enrollment_id) {
      return NextResponse.json({ error: 'enrollment_id is required' }, { status: 400 });
    }
    if (!initiated_by || !['parent', 'coach'].includes(initiated_by)) {
      return NextResponse.json({ error: 'initiated_by must be "parent" or "coach"' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch enrollment with child + coach details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, status, child_id, coach_id')
      .eq('id', enrollment_id)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.status !== 'active') {
      return NextResponse.json({ error: 'Enrollment is not active' }, { status: 400 });
    }

    // Rate limit: check calls this month (IST), excluding cancelled
    const istMonthStart = getISTMonthStart();
    const { count: usedThisMonth } = await supabase
      .from('parent_calls')
      .select('*', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment_id)
      .neq('status', 'cancelled')
      .gte('requested_at', istMonthStart);

    // Get max per month from site_settings
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'parent_call_max_per_month')
      .single();

    const maxPerMonth = parseInt(String(setting?.value ?? '1'), 10);

    if ((usedThisMonth || 0) >= maxPerMonth) {
      return NextResponse.json({
        error: 'Monthly parent call limit reached',
        message: `You can request ${maxPerMonth} parent call per month. Your next call will be available next month.`,
        quota: { used: usedThisMonth || 0, max: maxPerMonth, remaining: 0 },
      }, { status: 429 });
    }

    // Build the record
    const isCoachInitiated = initiated_by === 'coach';
    const record: Record<string, unknown> = {
      enrollment_id,
      child_id: enrollment.child_id,
      coach_id: enrollment.coach_id,
      initiated_by,
      requested_at: new Date().toISOString(),
      status: isCoachInitiated && preferred_time ? 'scheduled' : 'requested',
      notes: notes || null,
    };

    // Coach-initiated with preferred_time → auto-schedule
    if (isCoachInitiated && preferred_time) {
      record.scheduled_at = new Date(preferred_time).toISOString();
    }

    // Insert parent call record
    const { data: call, error: insertError } = await supabase
      .from('parent_calls')
      .insert(record)
      .select()
      .single();

    if (insertError) {
      console.error('[ParentCall] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create call request' }, { status: 500 });
    }

    // Send notification (non-blocking)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://yestoryd.com';

      // Fetch child + coach info for notification
      const [{ data: child }, { data: coach }] = await Promise.all([
        supabase.from('children').select('child_name, parent_phone, parent_email').eq('id', enrollment.child_id!).single(),
        supabase.from('coaches').select('name, phone, email').eq('id', enrollment.coach_id!).single(),
      ]);

      if (initiated_by === 'parent' && coach?.phone) {
        // Notify coach: parent wants a call
        await fetch(`${appUrl}/api/communication/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: 'parent_call_requested',
            channel: 'whatsapp',
            recipient: { phone: coach.phone, email: coach.email },
            variables: {
              coachName: coach.name,
              childName: child?.child_name || 'Student',
              notes: notes || 'No notes provided',
            },
          }),
        });
      } else if (initiated_by === 'coach' && child?.parent_phone) {
        // Notify parent: coach scheduled a call
        await fetch(`${appUrl}/api/communication/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: 'parent_call_scheduled',
            channel: 'whatsapp',
            recipient: { phone: child.parent_phone, email: child.parent_email },
            variables: {
              parentName: child.child_name ? `${child.child_name}'s parent` : 'Parent',
              coachName: coach?.name || 'Your coach',
              scheduledTime: preferred_time
                ? new Date(preferred_time).toLocaleString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                  })
                : 'To be confirmed',
            },
          }),
        });
      }
    } catch (notifError) {
      console.error('[ParentCall] Notification error (non-blocking):', notifError);
    }

    return NextResponse.json({
      success: true,
      call,
      message: isCoachInitiated && preferred_time
        ? 'Parent call scheduled'
        : 'Parent call requested. Coach will confirm within 24 hours.',
    });
  } catch (error: any) {
    console.error('[ParentCall] Request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getISTMonthStart(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const monthStart = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1));
  return new Date(monthStart.getTime() - istOffset).toISOString();
}
