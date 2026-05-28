// TEMP: smoke-test endpoint for B3-INBOUND. Delete after smoke test passes (track as B3-SMOKE-CLEANUP).
// ============================================================
// FILE: app/api/admin/smoke-test/renewal-intent/route.ts
// PURPOSE: One-off admin smoke test for parent_renewal_intent_v1
//          quick-reply template. Fires the exact payload that
//          balance-tracker.ts L158 emits during a real sessions_remaining=1
//          deduction, without requiring a real session completion.
//
// After successful send, sets enrollments.parent_renewal_check_sent_at
// so the inbound button-tap handler (renewal-intent.ts) can find the
// awaiting enrollment.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { sendNotification } from '@/lib/communication/notify';

export const dynamic = 'force-dynamic';

const FireSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const POST = withApiHandler(async (req: NextRequest, { auth, supabase, requestId }) => {
  const body = await req.json();
  const parsed = FireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { enrollmentId } = parsed.data;

  // 1. Fetch enrollment
  const { data: enrollment, error: fetchErr } = await supabase
    .from('enrollments')
    .select('id, child_id, parent_id, parent_renewal_check_sent_at, parent_renewal_decision')
    .eq('id', enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  }

  if (!enrollment.parent_id) {
    return NextResponse.json({ error: 'Enrollment has no parent_id' }, { status: 400 });
  }

  // 2. Guard: refuse if already awaiting a response (sent but not yet responded).
  //    OK to re-fire if previously responded (parent_renewal_decision set) — that's a
  //    new cycle. OK to fire if never sent (parent_renewal_check_sent_at IS NULL).
  if (enrollment.parent_renewal_check_sent_at && !enrollment.parent_renewal_decision) {
    return NextResponse.json(
      {
        error: 'Enrollment is already awaiting renewal intent response',
        parent_renewal_check_sent_at: enrollment.parent_renewal_check_sent_at,
        parent_renewal_decision: enrollment.parent_renewal_decision,
      },
      { status: 409 },
    );
  }

  // 3. Resolve parent_name + child_name + parent_phone (same pattern as balance-tracker.ts L88-115)
  let childName = 'Student';
  let parentName = 'Parent';
  let parentPhone: string | null = null;

  if (enrollment.child_id) {
    const { data: child } = await supabase
      .from('children')
      .select('child_name, parent_phone')
      .eq('id', enrollment.child_id)
      .single();
    if (child) {
      childName = child.child_name || 'Student';
      parentPhone = child.parent_phone;
    }
  }

  const { data: parent } = await supabase
    .from('parents')
    .select('name, phone')
    .eq('id', enrollment.parent_id)
    .single();
  if (parent) {
    parentName = parent.name || 'Parent';
    if (!parentPhone) parentPhone = parent.phone;
  }

  if (!parentPhone) {
    return NextResponse.json({ error: 'Parent phone not found on child or parent row' }, { status: 400 });
  }

  // 4. Fire the EXACT payload balance-tracker.ts L158 emits during a real deduction
  const result = await sendNotification('parent_renewal_intent_v1', parentPhone, {
    parent_name: parentName,
    child_name: childName,
  }, {
    templateButtons: {
      category: 'marketing_quick_reply',
      payloads: [
        { id: 'btn_renew_yes',   title: 'Yes, renew' },
        { id: 'btn_renew_pause', title: 'Pause for now' },
        { id: 'btn_renew_talk',  title: 'Talk to coach' },
      ],
    },
    contextType: 'enrollment',
    contextId: enrollmentId,
  });

  if (!result.success) {
    console.error(JSON.stringify({
      requestId,
      event: 'smoke_test_renewal_intent_send_failed',
      enrollmentId,
      parentPhone,
      reason: result.reason,
    }));
    return NextResponse.json(
      { error: 'sendNotification failed', reason: result.reason },
      { status: 502 },
    );
  }

  // 5. Mark enrollment as awaiting response (mirrors balance-tracker post-send write)
  const sentAt = new Date().toISOString();
  await supabase
    .from('enrollments')
    .update({
      parent_renewal_check_sent_at: sentAt,
      parent_renewal_decision: null,
      parent_renewal_decision_at: null,
    })
    .eq('id', enrollmentId);

  // 6. activity_log row for admin visibility
  await supabase.from('activity_log').insert({
    action: 'smoke_test_renewal_intent_fired',
    user_email: auth.email ?? 'admin',
    user_type: 'admin',
    metadata: {
      enrollment_id: enrollmentId,
      triggered_by: auth.email ?? 'admin',
      parent_phone: parentPhone,
      log_id: result.logId ?? null,
    },
  });

  console.log(JSON.stringify({
    requestId,
    event: 'smoke_test_renewal_intent_fired',
    enrollmentId,
    parentPhone,
    sentAt,
  }));

  return NextResponse.json({
    success: true,
    enrollmentId,
    sentAt,
    template: 'parent_renewal_intent_v1',
  });
}, { auth: 'admin' });
