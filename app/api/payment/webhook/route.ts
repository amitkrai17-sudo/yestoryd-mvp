import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // Verify webhook signature
    if (!signature || !verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const event = JSON.parse(body);
    console.log('Razorpay webhook:', event.event);

    // Handle different events
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;

      case 'order.paid':
        console.log('Order paid:', event.payload.order.entity.id);
        break;

      default:
        console.log('Unhandled event:', event.event);
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function handlePaymentCaptured(payment: any) {
  const notes = payment.notes || {};
  
  console.log('Payment captured:', {
    paymentId: payment.id,
    amount: payment.amount / 100,
    childId: notes.childId,
    childName: notes.childName,
  });

  // Update payment status
  const { error } = await supabase
    .from('payments')
    .update({ status: 'captured', captured_at: new Date().toISOString() })
    .eq('razorpay_payment_id', payment.id);

  if (error) {
    console.error('Error updating payment:', error);
  }

  // Trigger auto-scheduling (you can call your scheduling API here)
  // await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/enrollment/complete`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ childId: notes.childId, coachId: notes.coachId }),
  // });
}

async function handlePaymentFailed(payment: any) {
  console.log('Payment failed:', {
    paymentId: payment.id,
    reason: payment.error_description,
  });

  // Update payment status
  await supabase
    .from('payments')
    .update({ 
      status: 'failed', 
      failure_reason: payment.error_description,
    })
    .eq('razorpay_payment_id', payment.id);
}
