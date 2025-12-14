import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key
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
      childName,
      childAge,
      parentName,
      parentEmail,
      parentPhone,
      coachId,
      amount,
      preferredDay = 6,  // Default: Saturday
      preferredTime = '17:00',  // Default: 5 PM
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

    // Step 2: Check/Create Parent
    let parentId: string;
    
    const { data: existingParent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', parentEmail)
      .single();

    if (existingParent) {
      parentId = existingParent.id;
      console.log('✅ Existing parent found:', parentId);
    } else {
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          name: parentName,
          email: parentEmail,
          phone: parentPhone || null,
        })
        .select('id')
        .single();

      if (parentError) {
        console.error('❌ Parent creation error:', parentError);
        throw new Error('Failed to create parent record');
      }
      parentId = newParent.id;
      console.log('✅ New parent created:', parentId);
    }

    // Step 3: Create Child
    const { data: child, error: childError } = await supabase
      .from('children')
      .insert({
        parent_id: parentId,
        name: childName,
        age: parseInt(childAge) || 6,
      })
      .select('id')
      .single();

    if (childError) {
      console.error('❌ Child creation error:', childError);
      throw new Error('Failed to create child record');
    }
    console.log('✅ Child created:', child.id);

    // Step 4: Get Rucha's coach ID (auto-assign)
    let coachUUID: string | null = null;
    
    const { data: ruchaCoach } = await supabase
      .from('coaches')
      .select('id')
      .eq('email', 'rucha@yestoryd.com')
      .single();
    
    if (ruchaCoach) {
      coachUUID = ruchaCoach.id;
    } else {
      // Fallback: Get first active coach
      const { data: anyCoach } = await supabase
        .from('coaches')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .single();
      
      if (anyCoach) {
        coachUUID = anyCoach.id;
      }
    }
    
    console.log('✅ Coach assigned:', coachUUID);

    // Step 5: Create Payment record (matching your schema)
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        child_id: child.id,
        coach_id: coachId || 'rucha', // text field in payments
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
      console.error('❌ Payment record error:', paymentError);
      throw new Error('Failed to create payment record');
    }
    console.log('✅ Payment recorded:', payment.id);

    // Step 6: Create Enrollment (matching your schema)
    const programStart = new Date();
    const programEnd = new Date();
    programEnd.setMonth(programEnd.getMonth() + 3);

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: child.id,
        parent_id: parentId,
        coach_id: coachUUID, // UUID field in enrollments
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
      console.error('❌ Enrollment creation error:', enrollmentError);
      throw new Error('Failed to create enrollment record');
    }
    console.log('✅ Enrollment created:', enrollment.id);

    // Step 7: Trigger async processes
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Send confirmation email
    fetch(`${appUrl}/api/email/enrollment-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        enrollmentId: enrollment.id, 
        parentEmail, 
        childName,
        parentName,
      }),
    }).then(() => console.log('✅ Confirmation email triggered'))
      .catch(err => console.error('Email trigger error:', err));

    // Schedule sessions using existing /api/sessions/confirm endpoint
    fetch(`${appUrl}/api/sessions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        enrollmentId: enrollment.id, 
        childId: child.id,
        preferredDay,
        preferredTime,
        confirmedBy: 'system',
      }),
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Sessions scheduled:', data.sessions?.length || 9);
        } else {
          console.error('❌ Session scheduling failed:', data.error);
        }
      })
      .catch(err => console.error('Scheduling trigger error:', err));

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
      childId: child.id,
      paymentId: payment.id,
      message: 'Payment successful and enrollment created',
    });

  } catch (error: any) {
    console.error('❌ Payment verify error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}
