// file: app/api/payment/webhook/route.ts
// Razorpay Webhook - Backup handler for payment completion
// Integrates with revenue split system

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify webhook signature
function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not configured');
    return false;
  }
  
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

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const event = payload.event;
    
    console.log('📥 Webhook received:', event);

    // Handle payment.captured event
    if (event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount / 100; // Convert paise to rupees

      console.log('💰 Payment captured:', { orderId, paymentId, amount });

      // Check if already processed (enrollment exists)
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('payment_id', paymentId)
        .maybeSingle();

      if (existingEnrollment) {
        console.log('✅ Already processed via verify route');
        return NextResponse.json({ status: 'already_processed' });
      }

      // Find booking by order_id
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      if (!booking) {
        console.log('⚠️ No booking found for order:', orderId);
        // Try to find by checking payments table
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('razorpay_order_id', orderId)
          .maybeSingle();

        if (existingPayment) {
          console.log('✅ Payment already recorded');
          return NextResponse.json({ status: 'payment_exists' });
        }

        return NextResponse.json({ status: 'booking_not_found' });
      }

      // Process the enrollment
      const {
        child_id,
        child_name,
        parent_id,
        parent_email,
        parent_name,
        coach_id,
        lead_source,
        lead_source_coach_id,
      } = booking;

      // Get or use default coach
      let finalCoachId = coach_id;
      if (!finalCoachId) {
        const { data: defaultCoach } = await supabase
          .from('coaches')
          .select('id')
          .eq('email', 'rucha@yestoryd.com')
          .maybeSingle();
        finalCoachId = defaultCoach?.id;
      }

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'paid',
          payment_id: paymentId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          child_id: child_id,
          coach_id: 'webhook',
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          amount: amount,
          package_type: 'coaching-3month',
          source: 'webhook',
          status: 'captured',
          captured_at: new Date().toISOString(),
        });

      if (paymentError) {
        console.error('⚠️ Payment record error:', paymentError);
      }

      // Create enrollment
      const programStart = new Date();
      const programEnd = new Date();
      programEnd.setMonth(programEnd.getMonth() + 3);

      const { data: enrollment, error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          child_id: child_id,
          parent_id: parent_id,
          coach_id: finalCoachId,
          payment_id: paymentId,
          amount: amount,
          status: 'active',
          program_start: programStart.toISOString(),
          program_end: programEnd.toISOString(),
          schedule_confirmed: false,
        })
        .select('id')
        .single();

      if (enrollmentError) {
        console.error('⚠️ Enrollment error:', enrollmentError);
      } else {
        console.log('✅ Enrollment created via webhook:', enrollment?.id);

        // Calculate revenue split
        if (enrollment?.id && finalCoachId) {
          try {
            const revenueResponse = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com'}/api/enrollment/calculate-revenue`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  enrollment_id: enrollment.id,
                  total_amount: amount,
                  lead_source: lead_source || 'yestoryd',
                  lead_source_coach_id: lead_source === 'coach' ? lead_source_coach_id : null,
                  coaching_coach_id: finalCoachId,
                  child_id: child_id,
                  child_name: child_name,
                }),
              }
            );

            const revenueData = await revenueResponse.json();
            if (revenueData.success) {
              console.log('✅ Revenue split calculated via webhook');
            }
          } catch (revenueError) {
            console.error('⚠️ Revenue calculation error:', revenueError);
          }
        }

        // Schedule sessions
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com'}/api/sessions/schedule`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                enrollmentId: enrollment.id,
                childId: child_id,
                childName: child_name,
                parentEmail: parent_email,
                coachId: finalCoachId,
              }),
            }
          );
          console.log('✅ Sessions scheduled via webhook');
        } catch (scheduleError) {
          console.error('⚠️ Session scheduling error:', scheduleError);
        }
      }

      // Update child status
      if (child_id) {
        await supabase
          .from('children')
          .update({ 
            lead_status: 'enrolled',
            coach_id: finalCoachId,
          })
          .eq('id', child_id);
      }

      return NextResponse.json({ 
        status: 'processed',
        enrollmentId: enrollment?.id,
      });
    }

    // Handle payment.failed event
    if (event === 'payment.failed') {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      
      console.log('❌ Payment failed:', orderId);

      // Update booking status
      await supabase
        .from('bookings')
        .update({
          status: 'failed',
          failure_reason: payment.error_description || 'Payment failed',
        })
        .eq('razorpay_order_id', orderId);

      return NextResponse.json({ status: 'failure_recorded' });
    }

    // Acknowledge other events
    return NextResponse.json({ status: 'event_received', event });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}