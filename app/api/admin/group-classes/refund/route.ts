// ============================================================
// FILE: app/api/admin/group-classes/refund/route.ts
// ============================================================
// Process a full refund for a group class participant.
// Admin-only. Uses Razorpay refund API on the original payment.
// Updates participant record and sends confirmation email.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import razorpay from '@/lib/razorpay';
import { sendEmail } from '@/lib/email/resend-client';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { participant_id, reason } = body;

    if (!participant_id) {
      return NextResponse.json({ error: 'participant_id required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch participant with session and parent info
    const { data: participant } = await supabase
      .from('group_session_participants')
      .select(`
        id, child_id, parent_id, payment_status, refund_status,
        amount_paid, razorpay_payment_id, razorpay_order_id,
        group_sessions!inner ( id, title, scheduled_date, group_class_types ( name ) ),
        children!inner ( child_name ),
        parents!inner ( id, name, email, phone )
      `)
      .eq('id', participant_id)
      .single();

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    // Validate refund eligibility
    if (participant.refund_status === 'processed' || participant.refund_status === 'credited') {
      return NextResponse.json({ error: 'Refund already processed' }, { status: 409 });
    }

    if (participant.payment_status !== 'paid') {
      return NextResponse.json({ error: 'No payment to refund (status: ' + participant.payment_status + ')' }, { status: 400 });
    }

    if (!participant.razorpay_payment_id) {
      return NextResponse.json({ error: 'No Razorpay payment ID found' }, { status: 400 });
    }

    const amountToRefund = participant.amount_paid || 0;
    if (amountToRefund <= 0) {
      return NextResponse.json({ error: 'No refundable amount' }, { status: 400 });
    }

    // Initiate Razorpay refund
    const amountPaise = Math.round(amountToRefund * 100);
    let razorpayRefund;

    try {
      razorpayRefund = await (razorpay.payments as any).refund(participant.razorpay_payment_id, {
        amount: amountPaise,
        speed: 'normal',
        notes: {
          participant_id,
          session_id: (participant.group_sessions as any)?.id,
          reason: reason || 'Admin refund',
          request_id: requestId,
        },
      });
    } catch (rpErr: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'group_class_razorpay_refund_failed',
        error: rpErr.message,
        paymentId: participant.razorpay_payment_id,
      }));
      return NextResponse.json(
        { error: 'Razorpay refund failed', details: rpErr.message },
        { status: 502 },
      );
    }

    // Update participant record
    const { error: updateErr } = await supabase
      .from('group_session_participants')
      .update({
        refund_status: 'processed',
        refund_amount: amountToRefund,
        payment_status: 'refunded',
      })
      .eq('id', participant_id);

    if (updateErr) {
      console.error(JSON.stringify({ requestId, event: 'participant_update_failed', error: updateErr.message }));
    }

    // Extract details for notifications
    const gs = Array.isArray(participant.group_sessions)
      ? participant.group_sessions[0]
      : participant.group_sessions;
    const ct = gs ? (Array.isArray(gs.group_class_types) ? gs.group_class_types[0] : gs.group_class_types) : null;
    const className = ct?.name || gs?.title || 'Group Class';
    const childData = Array.isArray(participant.children) ? participant.children[0] : participant.children;
    const parentData = Array.isArray(participant.parents) ? participant.parents[0] : participant.parents;
    const childName = childData?.child_name || 'Child';

    // Send confirmation email
    if (parentData?.email) {
      try {
        await sendEmail({
          to: parentData.email,
          subject: `Refund Processed: ${className}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #FF0099;">Refund Confirmation</h2>
              <p>Hi ${parentData.name || 'Parent'},</p>
              <p>Your refund of <strong>Rs. ${amountToRefund}</strong> for <strong>${childName}</strong>'s registration in <strong>${className}</strong> has been processed.</p>
              <p>The refund will be credited to your original payment method within 5-7 business days.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p style="color: #999; font-size: 12px;">Razorpay Refund ID: ${razorpayRefund?.id || 'N/A'}</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error(JSON.stringify({ requestId, event: 'refund_email_failed', error: emailErr instanceof Error ? emailErr.message : 'Unknown' }));
      }
    }

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: auth.email || COMPANY_CONFIG.adminEmail,
        user_type: 'admin',
        action: 'group_class_refund_processed',
        metadata: {
          request_id: requestId,
          participant_id,
          session_id: gs?.id,
          child_id: participant.child_id,
          child_name: childName,
          class_name: className,
          amount_refunded: amountToRefund,
          razorpay_refund_id: razorpayRefund?.id,
          reason: reason || null,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      requestId,
      refund: {
        razorpay_refund_id: razorpayRefund?.id,
        amount: amountToRefund,
        participant_id,
        child_name: childName,
        class_name: className,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'group_class_refund_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
