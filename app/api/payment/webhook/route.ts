import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Verify Razorpay webhook signature
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // Verify signature (skip in development if no secret)
    if (webhookSecret && !verifyWebhookSignature(body, signature, webhookSecret)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log('Webhook event received:', event.event);

    // Handle payment.captured event
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      
      console.log('Payment captured:', {
        paymentId: payment.id,
        amount: payment.amount / 100,
        email: payment.email,
      });

      // TODO: Save payment to Google Sheets when configured
      // TODO: Update parent's coaching status
      // TODO: Send confirmation email

      return NextResponse.json({ 
        success: true, 
        message: 'Payment recorded' 
      });
    }

    // Handle payment.failed event
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      
      console.log('Payment failed:', {
        paymentId: payment.id,
        reason: payment.error_description,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Failure recorded' 
      });
    }

    // Return success for other events
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
