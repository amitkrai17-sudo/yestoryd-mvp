import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify Razorpay webhook signature
function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('❌ RAZORPAY_WEBHOOK_SECRET not configured');
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
    const signature = request.headers.get('x-razorpay-signature');

    // Verify webhook signature
    if (!signature || !verifyWebhookSignature(body, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    console.log('📩 Webhook event:', event.event);

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
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handlePaymentCaptured(payment: any) {
  const orderId = payment.order_id;
  const paymentId = payment.id;
  const notes = payment.notes || {};

  console.log('💰 Payment captured (webhook):', { orderId, paymentId });

  // 1. Find booking by order_id
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, child:children(*), parent:parents(*)')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();

  // 2. Check if already processed
  if (booking?.status === 'paid') {
    console.log('✅ Already processed by verify endpoint');
    return;
  }

  // 3. Check if enrollment already exists
  if (booking?.child_id) {
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('child_id', booking.child_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingEnrollment) {
      console.log('✅ Enrollment already exists:', existingEnrollment.id);
      
      // Just update booking status
      await supabase
        .from('bookings')
        .update({ status: 'paid', payment_id: paymentId, paid_at: new Date().toISOString() })
        .eq('id', booking.id);
      
      return;
    }
  }

  console.log('⚠️ Webhook backup: Processing missed payment');

  // 4. Get parent/child data from booking or notes
  let parentId = booking?.parent_id;
  let childId = booking?.child_id;
  let parentData = booking?.parent;
  let childData = booking?.child;
  const metadata = booking?.metadata || {};

  const parentEmail = parentData?.email || metadata.parentEmail || notes.parentEmail;
  const parentName = parentData?.name || metadata.parentName || notes.parentName;
  const parentPhone = parentData?.phone || metadata.parentPhone || notes.parentPhone;
  const childName = childData?.name || metadata.childName || notes.childName;
  const childAge = childData?.age || metadata.childAge || notes.childAge;

  // 5. Create parent if needed
  if (!parentId && parentEmail) {
    const { data: existingParent } = await supabase
      .from('parents')
      .select('*')
      .eq('email', parentEmail)
      .maybeSingle();

    if (existingParent) {
      parentId = existingParent.id;
      parentData = existingParent;
    } else if (parentName) {
      const { data: newParent } = await supabase
        .from('parents')
        .insert({ name: parentName, email: parentEmail, phone: parentPhone })
        .select('*')
        .single();
      
      if (newParent) {
        parentId = newParent.id;
        parentData = newParent;
      }
    }
  }

  // 6. Create child if needed - ✅ FIX: Always include parent_email
  if (!childId && childName && parentId) {
    const { data: newChild } = await supabase
      .from('children')
      .insert({
        parent_id: parentId,
        parent_email: parentEmail, // ✅ FIX: Always set parent_email
        name: childName,
        age: parseInt(childAge) || null,
        lead_status: 'enrolled',
        enrolled_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (newChild) {
      childId = newChild.id;
      childData = newChild;
    }
  }

  if (!childId || !parentId) {
    console.error('❌ Cannot process: Missing child or parent data');
    return;
  }

  // 7. Update child status - ✅ FIX: Always set parent_email and parent_id
  await supabase
    .from('children')
    .update({ 
      lead_status: 'enrolled', 
      enrolled_at: new Date().toISOString(),
      parent_email: parentEmail, // ✅ FIX: Always update parent_email
      parent_id: parentId, // ✅ FIX: Ensure parent_id is set
    })
    .eq('id', childId);

  // 8. Get coach
  const { data: coach } = await supabase
    .from('coaches')
    .select('*')
    .or('email.ilike.%rucha%,is_active.eq.true')
    .limit(1)
    .maybeSingle();

  const coachId = coach?.id || null;

  if (coachId) {
    await supabase
      .from('children')
      .update({ coach_id: coachId, assigned_to: coach?.email })
      .eq('id', childId);
  }

  // 9. Create payment record
  const amount = booking?.amount || payment.amount / 100;

  await supabase
    .from('payments')
    .insert({
      child_id: childId,
      coach_id: 'rucha',
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      amount: amount,
      package_type: 'coaching-3month',
      source: 'webhook',
      status: 'captured',
      captured_at: new Date().toISOString(),
    });

  // 10. Update booking
  if (booking?.id) {
    await supabase
      .from('bookings')
      .update({
        status: 'paid',
        payment_id: paymentId,
        paid_at: new Date().toISOString(),
        child_id: childId,
        parent_id: parentId,
      })
      .eq('id', booking.id);
  }

  // 11. Create enrollment
  const programStart = new Date();
  const programEnd = new Date();
  programEnd.setMonth(programEnd.getMonth() + 3);

  const { data: enrollment } = await supabase
    .from('enrollments')
    .insert({
      child_id: childId,
      parent_id: parentId,
      coach_id: coachId,
      payment_id: paymentId,
      amount: amount,
      status: 'active',
      program_start: programStart.toISOString(),
      program_end: programEnd.toISOString(),
      preferred_day: 6,
      preferred_time: '17:00',
      schedule_confirmed: false,
    })
    .select('id')
    .single();

  console.log('✅ Enrollment created via webhook:', enrollment?.id);

  // 12. Trigger async processes
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

  // Email
  fetch(`${appUrl}/api/email/enrollment-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enrollmentId: enrollment?.id,
      childId,
      parentEmail: parentData?.email,
      parentName: parentData?.name,
      childName: childData?.name,
      coachName: coach?.name || 'Rucha Rai',
    }),
  }).catch(err => console.error('Email error:', err));

  // Sessions
  fetch(`${appUrl}/api/sessions/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enrollmentId: enrollment?.id,
      childId,
      childName: childData?.name,
      parentEmail: parentData?.email,
      parentName: parentData?.name,
      coachEmail: coach?.email || 'rucha@yestoryd.com',
      coachName: coach?.name || 'Rucha Rai',
      preferredDay: 6,
      preferredTime: '17:00',
    }),
  }).catch(err => console.error('Scheduling error:', err));

  console.log('🎉 Webhook backup processing complete!');
}

async function handlePaymentFailed(payment: any) {
  const orderId = payment.order_id;
  
  console.log('❌ Payment failed:', { orderId, reason: payment.error_description });

  // Update booking status
  await supabase
    .from('bookings')
    .update({ status: 'failed' })
    .eq('razorpay_order_id', orderId);

  // Update payment if exists
  await supabase
    .from('payments')
    .update({ status: 'failed', failure_reason: payment.error_description })
    .eq('razorpay_order_id', orderId);
}

// Health check
export async function GET() {
  return NextResponse.json({ 
    status: 'Payment webhook ready',
    timestamp: new Date().toISOString(),
  });
}