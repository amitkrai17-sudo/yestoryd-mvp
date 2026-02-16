// =============================================================================
// FILE: app/api/group-classes/register/route.ts
// PURPOSE: Create registration record and Razorpay order (if payment needed)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      childId,
      parentId,
      childName,
      childAge,
      parentName,
      parentEmail,
      parentPhone,
      couponCode,
    } = body;

    // Validate required fields
    if (!sessionId || !childName || !childAge || !parentName || !parentEmail || !parentPhone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('group_sessions')
      .select('*, class_type:group_class_types(name)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check spots available
    const spotsAvailable = session.max_participants - session.current_participants;
    if (spotsAvailable <= 0) {
      return NextResponse.json({ error: 'Session is full' }, { status: 400 });
    }

    // Check if session is still open
    const sessionDate = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    if (sessionDate <= new Date()) {
      return NextResponse.json({ error: 'Registration closed' }, { status: 400 });
    }

    // Get or create parent
    let finalParentId = parentId;
    if (!finalParentId) {
      // Check if parent exists by email
      const { data: existingParent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', parentEmail.toLowerCase())
        .single();

      if (existingParent) {
        finalParentId = existingParent.id;
      } else {
        // Create new parent
        const { data: newParent, error: parentError } = await supabase
          .from('parents')
          .insert({
            name: parentName,
            email: parentEmail.toLowerCase(),
            phone: parentPhone,
          })
          .select('id')
          .single();

        if (parentError) {
          console.error('Error creating parent:', parentError);
          return NextResponse.json({ error: 'Failed to create parent record' }, { status: 500 });
        }
        finalParentId = newParent.id;
      }
    }

    // Get or create child
    let finalChildId = childId;
    let isEnrolled = false;

    if (!finalChildId) {
      // Check if child exists for this parent
      const { data: existingChild } = await supabase
        .from('children')
        .select('id, is_enrolled')
        .eq('parent_id', finalParentId)
        .eq('name', childName)
        .single();

      if (existingChild) {
        finalChildId = existingChild.id;
        isEnrolled = existingChild.is_enrolled || false;
      } else {
        // Create new child
        const { data: newChild, error: childError } = await supabase
          .from('children')
          .insert({
            name: childName,
            age: childAge,
            parent_id: finalParentId,
            is_enrolled: false,
            lead_source: 'group_class',
          })
          .select('id, is_enrolled')
          .single();

        if (childError) {
          console.error('Error creating child:', childError);
          return NextResponse.json({ error: 'Failed to create child record' }, { status: 500 });
        }
        finalChildId = newChild.id;
        isEnrolled = false;
      }
    } else {
      // Get enrollment status for existing child
      const { data: child } = await supabase
        .from('children')
        .select('is_enrolled')
        .eq('id', finalChildId)
        .single();
      isEnrolled = child?.is_enrolled || false;
    }

    // Check if already registered for this session
    const { data: existingReg } = await supabase
      .from('group_session_participants')
      .select('id')
      .eq('group_session_id', sessionId)
      .eq('child_id', finalChildId)
      .single();

    if (existingReg) {
      return NextResponse.json(
        { error: 'Child is already registered for this session' },
        { status: 400 }
      );
    }

    // Calculate pricing
    const originalPrice = session.price_inr;
    let discountAmount = 0;
    let finalPrice = originalPrice;
    let appliedCouponId = null;
    let appliedCouponCode = null;
    let isEnrolledFree = false;

    // If enrolled, apply ENROLLED100 automatically
    if (isEnrolled) {
      isEnrolledFree = true;
      discountAmount = originalPrice;
      finalPrice = 0;
      appliedCouponCode = 'ENROLLED100';
    } else if (couponCode) {
      // Validate and apply coupon
      const { data: coupon } = await supabase
        .from('group_class_coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          discountAmount = Math.round((originalPrice * coupon.discount_value) / 100);
        } else {
          discountAmount = Math.min(coupon.discount_value / 100, originalPrice);
        }
        finalPrice = Math.max(originalPrice - discountAmount, 0);
        appliedCouponId = coupon.id;
        appliedCouponCode = coupon.code;
      }
    }

    // If payment required, create Razorpay order
    let razorpayOrderId = null;
    if (finalPrice > 0) {
      try {
        const order = await razorpay.orders.create({
          amount: finalPrice * 100, // Razorpay expects paise
          currency: 'INR',
          receipt: `gc_${sessionId}_${finalChildId}`.substring(0, 40),
          notes: {
            session_id: sessionId,
            child_id: finalChildId,
            parent_id: finalParentId,
            class_name: session.class_type?.name || 'Group Class',
            session_title: session.title,
          },
        });
        razorpayOrderId = order.id;
      } catch (rzpError) {
        console.error('Razorpay error:', rzpError);
        return NextResponse.json(
          { error: 'Failed to create payment order' },
          { status: 500 }
        );
      }
    }

    // Create registration record
    const registrationData = {
      group_session_id: sessionId,
      child_id: finalChildId,
      parent_id: finalParentId,
      coupon_id: appliedCouponId,
      coupon_code_used: appliedCouponCode,
      amount_original: originalPrice,
      discount_amount: discountAmount,
      amount_paid: finalPrice,
      is_enrolled_free: isEnrolledFree,
      razorpay_order_id: razorpayOrderId,
      payment_status: finalPrice === 0 ? 'free' : 'pending',
      attendance_status: 'registered',
      paid_at: finalPrice === 0 ? new Date().toISOString() : null,
    };

    const { data: registration, error: regError } = await supabase
      .from('group_session_participants')
      .insert(registrationData)
      .select('id')
      .single();

    if (regError) {
      console.error('Error creating registration:', regError);
      return NextResponse.json(
        { error: 'Failed to create registration' },
        { status: 500 }
      );
    }

    // If free registration, update session participant count
    if (finalPrice === 0) {
      await supabase
        .from('group_sessions')
        .update({ current_participants: session.current_participants + 1 })
        .eq('id', sessionId);

      // Increment coupon usage if applicable
      if (appliedCouponId) {
        await supabase.rpc('increment_coupon_usage', { coupon_id: appliedCouponId });
      }
    }

    return NextResponse.json({
      success: true,
      registrationId: registration.id,
      requiresPayment: finalPrice > 0,
      razorpayOrderId,
      razorpayKeyId: finalPrice > 0 ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID : null,
      pricing: {
        originalPrice,
        discountAmount,
        finalPrice,
        isEnrolledFree,
        appliedCouponCode,
      },
      session: {
        title: session.title,
        date: session.scheduled_date,
        time: session.scheduled_time,
        className: session.class_type?.name,
      },
      child: {
        id: finalChildId,
        name: childName,
      },
      parent: {
        id: finalParentId,
        name: parentName,
        email: parentEmail,
        phone: parentPhone,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
