// app/api/payment/verify/route.ts
// Payment verification endpoint - Updated with async queue
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// CHANGES FROM PREVIOUS VERSION:
// - Session scheduling moved to background job (QStash)
// - Email sending moved to background job
// - Returns immediately after DB updates (no more timeouts!)

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { queueEnrollmentComplete } from '@/lib/qstash';

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Child & Parent data from checkout
      childName,
      childAge,
      childId,
      parentName,
      parentEmail,
      parentPhone,
      coachId,
    } = body;

    console.log('🔐 Verifying payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      childName,
    });

    // ============================================
    // STEP 1: Verify Razorpay Signature
    // ============================================
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Invalid payment signature');
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    console.log('✅ Signature verified');

    // ============================================
    // STEP 2: Get or Create Parent
    // ============================================
    let parent;
    const { data: existingParent } = await supabase
      .from('parents')
      .select('*')
      .eq('email', parentEmail.toLowerCase().trim())
      .single();

    if (existingParent) {
      parent = existingParent;
      console.log('👤 Found existing parent:', parent.id);
    } else {
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          email: parentEmail.toLowerCase().trim(),
          name: parentName,
          phone: parentPhone,
        })
        .select()
        .single();
      
      if (parentError) {
        console.error('❌ Failed to create parent:', parentError);
        throw new Error('Failed to create parent record');
      }
      parent = newParent;
      console.log('👤 Created new parent:', parent.id);
    }

    // ============================================
    // STEP 3: Get or Create Child
    // ============================================
    let child;
    if (childId) {
      // Child already exists from assessment
      const { data: existingChild } = await supabase
        .from('children')
        .select('*')
        .eq('id', childId)
        .single();
      
      if (existingChild) {
        child = existingChild;
        console.log('👶 Found existing child:', child.id);
      }
    }
    
    if (!child) {
      // Create new child record
      const { data: newChild, error: childError } = await supabase
        .from('children')
        .insert({
          name: childName,
          age: parseInt(childAge) || null,
          parent_id: parent.id,
          enrollment_status: 'enrolled',
        })
        .select()
        .single();
      
      if (childError) {
        console.error('❌ Failed to create child:', childError);
        throw new Error('Failed to create child record');
      }
      child = newChild;
      console.log('👶 Created new child:', child.id);
    }

    // Update child status to enrolled
    await supabase
      .from('children')
      .update({
        enrollment_status: 'enrolled',
        coach_id: coachId,
        parent_id: parent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', child.id);

    // ============================================
    // STEP 4: Get Coach Details
    // ============================================
    let coach;
    
    if (coachId) {
      const { data: foundCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', coachId)
        .single();
      coach = foundCoach;
    }

    // Fallback to default coach (Rucha)
    if (!coach) {
      const { data: defaultCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', 'rucha@yestoryd.com')
        .single();
      
      coach = defaultCoach || {
        id: coachId || 'default',
        email: 'rucha@yestoryd.com',
        name: 'Rucha Rai',
      };
    }

    console.log('👩‍🏫 Coach assigned:', coach.name);

    // ============================================
    // STEP 5: Create Payment Record
    // ============================================
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        parent_id: parent.id,
        child_id: child.id,
        razorpay_order_id,
        razorpay_payment_id,
        amount: 5999,
        currency: 'INR',
        status: 'captured',
        captured_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('⚠️ Payment record error:', paymentError);
      // Continue - payment is successful, just logging failed
    }

    // ============================================
    // STEP 6: Create Enrollment Record
    // ============================================
    const programStart = new Date();
    const programEnd = new Date();
    programEnd.setMonth(programEnd.getMonth() + 3);

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: child.id,
        parent_id: parent.id,
        coach_id: coach.id,
        payment_id: razorpay_payment_id,
        amount: 5999,
        status: 'active',
        program_start: programStart.toISOString(),
        program_end: programEnd.toISOString(),
        schedule_confirmed: false, // Will be updated by background job
        sessions_scheduled: 0,     // Will be updated by background job
      })
      .select()
      .single();

    if (enrollmentError) {
      console.error('❌ Enrollment creation failed:', enrollmentError);
      throw new Error('Failed to create enrollment record');
    }

    console.log('📝 Enrollment created:', enrollment.id);

    // ============================================
    // STEP 7: 🚀 QUEUE BACKGROUND JOB (KEY CHANGE!)
    // ============================================
    // Instead of scheduling calendar events and sending emails here
    // (which can timeout on Vercel's 10s limit), we queue a background job.
    // QStash will handle retries if it fails.
    
    let queueResult = { success: false, messageId: null };
    
    try {
      queueResult = await queueEnrollmentComplete({
        enrollmentId: enrollment.id,
        childId: child.id,
        childName: child.name,
        parentId: parent.id,
        parentEmail: parent.email,
        parentName: parent.name,
        parentPhone: parent.phone || parentPhone,
        coachId: coach.id,
        coachEmail: coach.email,
        coachName: coach.name,
      });
      
      console.log('📤 Background job queued:', queueResult.messageId);
    } catch (queueError: any) {
      // Log but don't fail - enrollment is created
      // The Razorpay webhook can serve as backup
      console.error('⚠️ Queue error (non-fatal):', queueError.message);
      
      // Optionally, you could try direct scheduling as fallback here
      // But that risks timeout, so we'll rely on webhook backup
    }

    // ============================================
    // STEP 8: Return Success Immediately
    // ============================================
    const duration = Date.now() - startTime;
    console.log(`✅ Payment verified in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        enrollmentId: enrollment.id,
        childId: child.id,
        parentId: parent.id,
        coachId: coach.id,
        coachName: coach.name,
      },
      // Inform frontend that sessions are being scheduled in background
      scheduling: {
        status: queueResult.success ? 'queued' : 'pending',
        messageId: queueResult.messageId,
        note: 'Calendar sessions and confirmation email are being processed. Check your email shortly!',
      },
    });

  } catch (error: any) {
    console.error('❌ Payment verification error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Payment verification failed',
      },
      { status: 500 }
    );
  }
}