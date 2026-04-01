// ============================================================
// FILE: app/api/payment/record-offline/route.ts
// PURPOSE: Record cash/UPI/bank-transfer payments for tuition enrollments
// AUTH: admin or coach only
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { loadPaymentConfig } from '@/lib/config/loader';
import { getCoach } from '@/lib/payment/coach-assigner';
import { calculateRevenueSplit } from '@/lib/payment/post-payment-notifications';

export const dynamic = 'force-dynamic';

const RecordOfflineSchema = z.object({
  enrollment_id: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  sessions_purchased: z.number().int().positive('Sessions must be positive'),
  payment_method: z.enum(['cash', 'upi_manual', 'bank_transfer']),
  notes: z.string().max(500).optional(),
});

export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  const { auth, supabase, requestId } = ctx;

  const rawBody = await req.json();
  const validation = RecordOfflineSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.format() },
      { status: 400 },
    );
  }

  const body = validation.data;

  console.log(JSON.stringify({
    requestId,
    event: 'offline_payment_start',
    enrollmentId: body.enrollment_id,
    amount: body.amount,
    method: body.payment_method,
    recordedBy: auth.email,
  }));

  // 1. Fetch enrollment with parent + child info
  const { data: enrollment, error: enrollErr } = await supabase
    .from('enrollments')
    .select('id, child_id, parent_id, coach_id, sessions_purchased, sessions_remaining, amount, status, program_start, enrollment_type, billing_model')
    .eq('id', body.enrollment_id)
    .single();

  if (enrollErr || !enrollment) {
    return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
  }

  if (enrollment.enrollment_type !== 'tuition') {
    return NextResponse.json({ success: false, error: 'Only tuition enrollments support offline payments' }, { status: 400 });
  }

  // 2. Fetch parent + child info for WA notification
  const [parentResult, childResult] = await Promise.all([
    enrollment.parent_id
      ? supabase.from('parents').select('name, email, phone').eq('id', enrollment.parent_id).single()
      : Promise.resolve({ data: null }),
    enrollment.child_id
      ? supabase.from('children').select('name, child_name').eq('id', enrollment.child_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const parentData = parentResult.data;
  const childData = childResult.data;
  const childName = childData?.child_name || childData?.name || 'Student';
  const parentName = parentData?.name || 'Parent';
  const parentPhone = parentData?.phone || '';
  const parentEmail = parentData?.email || '';

  // 3. Record payment (razorpay fields stay NULL)
  const paymentConfig = await loadPaymentConfig();
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      parent_id: enrollment.parent_id,
      child_id: enrollment.child_id,
      amount: body.amount,
      currency: paymentConfig.currency,
      status: 'captured',
      captured_at: new Date().toISOString(),
      source: 'offline',
      payment_method: body.payment_method,
      recorded_by: auth.userId || null,
      notes: body.notes || null,
    })
    .select('id')
    .single();

  if (paymentError) {
    console.error(JSON.stringify({ requestId, event: 'offline_payment_record_error', error: paymentError.message }));
    return NextResponse.json({ success: false, error: 'Failed to record payment' }, { status: 500 });
  }

  // 4. Update enrollment balance (mirrors tuition branch in verify route)
  const currentRemaining = enrollment.sessions_remaining || 0;
  const newRemaining = currentRemaining + body.sessions_purchased;
  const isFirstPayment = !enrollment.program_start;
  const existingAmount = enrollment.amount || 0;

  const enrollmentUpdate: Record<string, unknown> = {
    status: 'active',
    sessions_remaining: newRemaining,
    amount: existingAmount + body.amount,
    updated_at: new Date().toISOString(),
  };
  if (isFirstPayment) {
    enrollmentUpdate.program_start = new Date().toISOString();
    enrollmentUpdate.actual_start_date = new Date().toISOString().split('T')[0];
  }

  await supabase.from('enrollments').update(enrollmentUpdate).eq('id', body.enrollment_id);

  // 5. Ledger entry
  await supabase.from('tuition_session_ledger').insert({
    enrollment_id: body.enrollment_id,
    change_amount: body.sessions_purchased,
    balance_after: newRemaining,
    reason: isFirstPayment ? 'initial_purchase' : 'top_up',
    payment_id: payment.id,
    notes: `Offline ${body.payment_method}: ₹${body.amount} — ${body.sessions_purchased} sessions credited${body.notes ? ` (${body.notes})` : ''}`,
    created_by: auth.email || 'system',
  });

  // 6. Update child as enrolled + safety net for name
  if (enrollment.child_id) {
    await supabase.from('children').update({
      is_enrolled: true,
      enrollment_status: 'enrolled',
      lead_status: 'enrolled',
      coach_id: enrollment.coach_id,
      enrolled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', enrollment.child_id);

    if (childName && childName !== 'Student') {
      await supabase
        .from('children')
        .update({ name: childName, child_name: childName })
        .eq('id', enrollment.child_id)
        .is('name', null);
    }
  }

  // 7. Revenue split
  try {
    const coach = await getCoach(enrollment.coach_id || null, requestId);
    await calculateRevenueSplit(
      body.enrollment_id, body.amount, coach, 'yestoryd', null,
      enrollment.child_id || '', childName, requestId, 1,
    );
  } catch (revErr: unknown) {
    console.error(JSON.stringify({ requestId, event: 'offline_revenue_error', error: revErr instanceof Error ? revErr.message : String(revErr) }));
  }

  // 8. Send payment confirmation WhatsApp + Email
  try {
    const { sendCommunication } = await import('@/lib/communication');
    await sendCommunication({
      templateCode: 'P14_payment_confirmed',
      recipientType: 'parent',
      recipientId: enrollment.parent_id || undefined,
      recipientPhone: parentPhone,
      recipientEmail: parentEmail,
      recipientName: parentName,
      variables: {
        parent_first_name: parentName.split(' ')[0] || 'Parent',
        amount: String(body.amount),
        child_name: childName,
        enrollment_id: body.enrollment_id,
        sessions_count: String(body.sessions_purchased),
      },
      relatedEntityType: 'enrollment',
      relatedEntityId: body.enrollment_id,
    });
  } catch (waErr: unknown) {
    console.error(JSON.stringify({ requestId, event: 'payment_wa_send_failed', path: 'offline_payment', error: waErr instanceof Error ? waErr.message : String(waErr) }));
    try {
      await supabase.from('activity_log').insert({
        action: 'payment_wa_send_failed',
        user_email: auth.email || 'unknown',
        user_type: 'system',
        metadata: {
          error: waErr instanceof Error ? waErr.message : String(waErr),
          template: 'P14_payment_confirmed',
          parent_id: enrollment.parent_id,
          enrollment_id: body.enrollment_id,
          payment_path: 'offline_payment',
        },
      });
    } catch (_) { /* swallow logging failure */ }
  }

  // 9. Activity log
  await supabase.from('activity_log').insert({
    action: 'offline_payment_recorded',
    user_email: auth.email || 'unknown',
    user_type: auth.role || 'admin',
    metadata: {
      enrollment_id: body.enrollment_id,
      payment_id: payment.id,
      amount: body.amount,
      sessions_purchased: body.sessions_purchased,
      new_balance: newRemaining,
      payment_method: body.payment_method,
      is_first_payment: isFirstPayment,
      recorded_by: auth.email,
      notes: body.notes,
    },
  });

  console.log(JSON.stringify({
    requestId,
    event: 'offline_payment_recorded',
    enrollmentId: body.enrollment_id,
    paymentId: payment.id,
    amount: body.amount,
    sessions: body.sessions_purchased,
    newBalance: newRemaining,
    method: body.payment_method,
  }));

  return NextResponse.json({
    success: true,
    message: `₹${body.amount} ${body.payment_method} payment recorded — ${body.sessions_purchased} sessions added`,
    data: {
      paymentId: payment.id,
      enrollmentId: body.enrollment_id,
      amountPaid: body.amount,
      sessionsAdded: body.sessions_purchased,
      newBalance: newRemaining,
      paymentMethod: body.payment_method,
    },
  });
}, { auth: 'adminOrCoach' });
