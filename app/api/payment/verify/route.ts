import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Data passed from frontend
      childId,
      childName,
      coachId,
      packageType,
      parentName,
      parentEmail,
      parentPhone,
      source,
    } = body;

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      console.error('Invalid payment signature');
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Payment verified!
    console.log('Payment verified:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      childId,
      childName,
    });

    // Check if childId is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childId);

    if (isValidUUID) {
      // Update child status in database
      const { data: child, error: updateError } = await supabase
        .from('children')
        .update({
          status: 'enrolled',
          program_start_date: new Date().toISOString(),
          program_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          razorpay_payment_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id,
          // Don't set assigned_coach_id here - handle separately if needed
        })
        .eq('id', childId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating child:', updateError);
      } else {
        console.log('Child updated successfully:', child?.id);
      }
    }

    // Record payment in payments table
    const paymentData: any = {
      razorpay_order_id,
      razorpay_payment_id,
      amount: packageType === 'coaching-6' ? 5999 : 999,
      package_type: packageType || 'coaching-6',
      source: source || 'yestoryd.com',
      status: 'captured',
      created_at: new Date().toISOString(),
    };

    // Only add child_id if it's a valid UUID
    if (isValidUUID) {
      paymentData.child_id = childId;
    }

    // Store coach name as text (not UUID)
    if (coachId) {
      paymentData.coach_id = coachId;
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      console.error('Error recording payment:', paymentError);
    } else {
      console.log('Payment recorded successfully:', payment?.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and enrollment initiated',
      childId,
      paymentId: razorpay_payment_id,
      nextStep: 'schedule_sessions',
    });

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
