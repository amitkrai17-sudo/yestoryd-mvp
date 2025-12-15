import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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
      // Optional overrides (if not in booking)
      childName,
      childAge,
      parentName,
      parentEmail,
      parentPhone,
      preferredDay = 6,    // Saturday
      preferredTime = '17:00',  // 5 PM
    } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Step 1: Verify Razorpay signature
    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Signature verification failed');
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    console.log('✅ Payment signature verified:', razorpay_payment_id);

    // Step 2: Find booking by order_id
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, child:children(*), parent:parents(*)')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    // Step 3: Check if already processed (idempotency)
    if (booking?.status === 'paid') {
      console.log('⚠️ Payment already processed:', razorpay_order_id);
      
      // Find existing enrollment
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', booking.child_id)
        .eq('status', 'active')
        .maybeSingle();

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        enrollmentId: existingEnrollment?.id,
        childId: booking.child_id,
        message: 'Payment was already processed',
      });
    }

    // Step 4: Get or create parent
    let parentId = booking?.parent_id;
    let parentData = booking?.parent;
    const metadata = booking?.metadata || {};
    
    const finalParentEmail = parentEmail || metadata.parentEmail;
    const finalParentName = parentName || metadata.parentName;
    const finalParentPhone = parentPhone || metadata.parentPhone;

    if (!parentId && finalParentEmail) {
      const { data: existingParent } = await supabase
        .from('parents')
        .select('*')
        .eq('email', finalParentEmail)
        .maybeSingle();

      if (existingParent) {
        parentId = existingParent.id;
        parentData = existingParent;
      } else if (finalParentName) {
        const { data: newParent } = await supabase
          .from('parents')
          .insert({
            name: finalParentName,
            email: finalParentEmail,
            phone: finalParentPhone || null,
          })
          .select('*')
          .single();

        if (newParent) {
          parentId = newParent.id;
          parentData = newParent;
        }
      }
    }

    if (!parentId) {
      console.error('❌ Could not find or create parent');
      return NextResponse.json(
        { success: false, error: 'Parent information required' },
        { status: 400 }
      );
    }

    console.log('✅ Parent:', parentData?.name || parentId);

    // Step 5: Get or create child
    let childId = booking?.child_id;
    let childData = booking?.child;
    
    const finalChildName = childName || metadata.childName;
    const finalChildAge = childAge || metadata.childAge;

    if (!childId && finalChildName) {
      const { data: newChild } = await supabase
        .from('children')
        .insert({
          parent_id: parentId,
          name: finalChildName,
          age: parseInt(finalChildAge) || null,
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

    if (!childId) {
      console.error('❌ Could not find or create child');
      return NextResponse.json(
        { success: false, error: 'Child information required' },
        { status: 400 }
      );
    }

    console.log('✅ Child:', childData?.name || childId);

    // Step 6: Update child status to enrolled
    await supabase
      .from('children')
      .update({
        lead_status: 'enrolled',
        enrolled_at: new Date().toISOString(),
      })
      .eq('id', childId);

    // Step 7: Get coach (Rucha as default)
    let coachId: string | null = null;
    let coachData: any = null;

    const { data: coach } = await supabase
      .from('coaches')
      .select('*')
      .or('email.ilike.%rucha%,is_active.eq.true')
      .order('current_students', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (coach) {
      coachId = coach.id;
      coachData = coach;
      
      // Assign coach to child
      await supabase
        .from('children')
        .update({ 
          coach_id: coachId,
          assigned_to: coach.email,
        })
        .eq('id', childId);
    }

    console.log('✅ Coach:', coachData?.name || 'Rucha Rai (default)');

    // Step 8: Create payment record
    const amount = booking?.amount || 5999;
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        child_id: childId,
        coach_id: 'rucha', // text field
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        amount: amount,
        package_type: 'coaching-3month',
        source: 'website',
        status: 'captured',
        captured_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (paymentError) {
      console.error('⚠️ Payment record error:', paymentError);
    } else {
      console.log('✅ Payment recorded:', payment?.id);
    }

    // Step 9: Update booking status
    if (booking?.id) {
      await supabase
        .from('bookings')
        .update({
          status: 'paid',
          payment_id: razorpay_payment_id,
          paid_at: new Date().toISOString(),
          child_id: childId,
          parent_id: parentId,
        })
        .eq('id', booking.id);
    }

    // Step 10: Create enrollment
    const programStart = new Date();
    const programEnd = new Date();
    programEnd.setMonth(programEnd.getMonth() + 3);

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: childId,
        parent_id: parentId,
        coach_id: coachId,
        payment_id: razorpay_payment_id,
        amount: amount,
        status: 'active',
        program_start: programStart.toISOString(),
        program_end: programEnd.toISOString(),
        preferred_day: preferredDay,
        preferred_time: preferredTime,
        schedule_confirmed: false,
      })
      .select('id')
      .single();

    if (enrollmentError) {
      console.error('⚠️ Enrollment error:', enrollmentError);
    } else {
      console.log('✅ Enrollment created:', enrollment?.id);
    }

    // Step 11: Update coach student count
    if (coachId && coachData) {
      await supabase
        .from('coaches')
        .update({ current_students: (coachData.current_students || 0) + 1 })
        .eq('id', coachId);
    }

    // Step 12: Trigger async processes
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';
    
    // Send confirmation email (async, don't wait)
    fetch(`${appUrl}/api/email/enrollment-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        enrollmentId: enrollment?.id,
        childId,
        parentEmail: parentData?.email || finalParentEmail,
        parentName: parentData?.name || finalParentName,
        childName: childData?.name || finalChildName,
        coachName: coachData?.name || 'Rucha Rai',
      }),
    }).then(() => console.log('✅ Email triggered'))
      .catch(err => console.error('Email error:', err));

    // Schedule sessions (async, don't wait)
    fetch(`${appUrl}/api/sessions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        enrollmentId: enrollment?.id,
        childId,
        childName: childData?.name || finalChildName,
        parentEmail: parentData?.email || finalParentEmail,
        parentName: parentData?.name || finalParentName,
        coachEmail: coachData?.email || 'rucha@yestoryd.com',
        coachName: coachData?.name || 'Rucha Rai',
        preferredDay,
        preferredTime,
      }),
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Sessions scheduled:', data.sessions?.length || 9);
        } else {
          console.error('⚠️ Session scheduling:', data.error);
        }
      })
      .catch(err => console.error('Scheduling error:', err));

    console.log('🎉 Payment verification complete!');

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment?.id,
      childId: childId,
      paymentId: payment?.id,
      coachName: coachData?.name || 'Rucha Rai',
      message: 'Payment successful! Enrollment created.',
    });

  } catch (error: any) {
    console.error('❌ Payment verify error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}
