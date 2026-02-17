// ============================================================
// POST /api/refund/initiate — Admin-only refund initiation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import razorpay from '@/lib/razorpay';
import { calculateRefund, isFullRefundEligible } from '@/lib/refund/calculator';
import { loadRevenueSplitConfig } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';

const InitiateRefundSchema = z.object({
  enrollmentId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const supabase = getServiceSupabase();

  // 1. Admin guard
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  // 2. Validate body
  let body;
  try {
    body = InitiateRefundSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { enrollmentId, reason, notes } = body;

  try {
    // 3. Fetch enrollment
    const { data: enrollment, error: enrollErr } = await supabase
      .from('enrollments')
      .select('id, child_id, parent_id, coach_id, payment_id, amount, status, lead_source, created_at')
      .eq('id', enrollmentId)
      .single();

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    if (enrollment.status === 'terminated') {
      return NextResponse.json({ error: 'Enrollment already terminated' }, { status: 409 });
    }

    // 4. Check for existing termination
    const { data: existingTermination } = await supabase
      .from('enrollment_terminations')
      .select('id, refund_status')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (existingTermination) {
      return NextResponse.json({
        error: 'Termination already exists',
        refundStatus: existingTermination.refund_status,
      }, { status: 409 });
    }

    // 5. Get session counts
    const { count: sessionsCompleted } = await supabase
      .from('scheduled_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'completed');

    const { count: sessionsTotal } = await supabase
      .from('scheduled_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId);

    // 6. Get payment record for Razorpay payment ID
    if (!enrollment.payment_id) {
      return NextResponse.json({ error: 'No payment ID associated with enrollment' }, { status: 400 });
    }

    const { data: payment } = await supabase
      .from('payments')
      .select('razorpay_payment_id, captured_at')
      .eq('razorpay_payment_id', enrollment.payment_id)
      .single();

    if (!payment || !payment.captured_at) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // 7. Calculate refund
    const revConfig = await loadRevenueSplitConfig();
    const coachPercent = revConfig.coachCostPercent ?? 0;

    const completed = sessionsCompleted ?? 0;
    const total = sessionsTotal ?? 0;
    const enrollmentAmount = enrollment.amount ?? 0;

    const fullEligible = isFullRefundEligible(
      new Date(payment.captured_at),
      completed
    );

    const calc = fullEligible
      ? { refundAmount: enrollmentAmount, coachCost: 0, refundType: 'full' as const }
      : calculateRefund(enrollmentAmount, total, completed, coachPercent);

    if (calc.refundAmount <= 0) {
      return NextResponse.json({ error: 'No refundable amount', calculation: calc }, { status: 422 });
    }

    // 8. Initiate Razorpay refund
    const amountPaise = Math.round(calc.refundAmount * 100);
    let razorpayRefund;
    try {
      razorpayRefund = await (razorpay.payments as any).refund(payment.razorpay_payment_id, {
        amount: amountPaise,
        speed: 'normal',
        notes: {
          enrollment_id: enrollmentId,
          reason,
          request_id: requestId,
        },
      });
    } catch (rpErr: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'razorpay_refund_failed',
        error: rpErr.message,
        paymentId: payment.razorpay_payment_id,
      }));
      return NextResponse.json({ error: 'Razorpay refund initiation failed', details: rpErr.message }, { status: 502 });
    }

    // 9. Create termination record
    await supabase.from('enrollment_terminations').insert({
      enrollment_id: enrollmentId,
      sessions_total: total,
      sessions_completed: completed,
      sessions_remaining: total - completed,
      original_amount: enrollmentAmount,
      coach_settlement_amount: calc.coachCost,
      platform_retention: enrollmentAmount - calc.refundAmount - calc.coachCost,
      refund_amount: calc.refundAmount,
      razorpay_payment_id: payment.razorpay_payment_id!,
      razorpay_refund_id: razorpayRefund.id,
      refund_status: 'initiated',
      created_by: auth.email ?? '',
      terminated_by: auth.email ?? '',
      termination_reason: reason,
      termination_notes: notes,
    });

    // 10. Update enrollment status
    await supabase
      .from('enrollments')
      .update({ status: 'terminated', updated_at: new Date().toISOString() })
      .eq('id', enrollmentId);

    // 11. Cancel remaining scheduled sessions
    await supabase
      .from('scheduled_sessions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('enrollment_id', enrollmentId)
      .in('status', ['scheduled', 'pending']);

    // 12. Log event
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: 'terminated_with_refund',
      event_data: {
        refund_amount: calc.refundAmount,
        refund_type: calc.refundType,
        razorpay_refund_id: razorpayRefund.id,
        sessions_completed: completed,
        sessions_total: total,
        initiated_by: auth.email,
        request_id: requestId,
      },
      triggered_by: 'admin_refund',
    });

    console.log(JSON.stringify({
      requestId,
      event: 'refund_initiated',
      enrollmentId,
      refundAmount: calc.refundAmount,
      refundType: calc.refundType,
      razorpayRefundId: razorpayRefund.id,
    }));

    return NextResponse.json({
      status: 'initiated',
      enrollmentId,
      refundAmount: calc.refundAmount,
      refundType: calc.refundType,
      razorpayRefundId: razorpayRefund.id,
      requestId,
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'refund_initiate_error',
      error: error.message,
    }));
    return NextResponse.json({ error: 'Internal error', requestId }, { status: 500 });
  }
}
