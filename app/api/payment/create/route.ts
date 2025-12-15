import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      amount,
      childId,        // If existing child (from assessment)
      childName,
      childAge,
      parentId,       // If existing parent
      parentName,
      parentEmail,
      parentPhone,
    } = body;

    // Validate required fields
    if (!amount) {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      );
    }

    // Must have parent email AND child name for payment to work
    if (!parentEmail || !childName) {
      return NextResponse.json(
        { 
          error: 'Parent email and child name are required',
          code: 'MISSING_INFO',
          redirectTo: '/enroll',
        },
        { status: 400 }
      );
    }

    // Generate receipt ID
    const receiptId = `rcpt_${Date.now()}`;

    console.log('📦 Creating Razorpay order:', { amount, childName, parentEmail });

    // 1. Create Razorpay order with all details in notes
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: receiptId,
      notes: {
        childId: childId || '',
        childName: childName || '',
        childAge: String(childAge || ''),
        parentId: parentId || '',
        parentName: parentName || '',
        parentEmail: parentEmail,
        parentPhone: parentPhone || '',
      },
    });

    console.log('✅ Razorpay order created:', order.id);

    // 2. Get or create parent
    let finalParentId = parentId;
    
    if (!finalParentId && parentEmail) {
      // Check if parent exists
      const { data: existingParent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', parentEmail)
        .maybeSingle();

      if (existingParent) {
        finalParentId = existingParent.id;
      } else if (parentName) {
        // Create new parent
        const { data: newParent } = await supabase
          .from('parents')
          .insert({
            name: parentName,
            email: parentEmail,
            phone: parentPhone || null,
          })
          .select('id')
          .single();
        
        if (newParent) {
          finalParentId = newParent.id;
        }
      }
    }

    // 3. Get or create child
    let finalChildId = childId;

    if (!finalChildId && childName && finalParentId) {
      // Check if child already exists for this parent
      const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('parent_id', finalParentId)
        .eq('name', childName)
        .maybeSingle();

      if (existingChild) {
        finalChildId = existingChild.id;
      } else {
        // Create new child
        const { data: newChild } = await supabase
          .from('children')
          .insert({
            parent_id: finalParentId,
            name: childName,
            age: parseInt(childAge) || null,
            lead_status: 'assessed',
          })
          .select('id')
          .single();

        if (newChild) {
          finalChildId = newChild.id;
        }
      }
    }

    // 4. Save order to bookings table for webhook to find later
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        razorpay_order_id: order.id,
        child_id: finalChildId || null,
        parent_id: finalParentId || null,
        amount: amount,
        status: 'pending',
        metadata: {
          childName,
          childAge,
          parentName,
          parentEmail,
          parentPhone,
          receiptId,
        },
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error('⚠️ Booking save error (non-fatal):', bookingError);
      // Don't fail - order was created, payment can still work
    } else {
      console.log('✅ Booking saved:', booking?.id);
    }

    // 5. Update child lead_status to show payment initiated
    if (finalChildId) {
      await supabase
        .from('children')
        .update({ lead_status: 'negotiating' })
        .eq('id', finalChildId)
        .eq('lead_status', 'assessed'); // Only if still assessed
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking?.id,
      childId: finalChildId,
      parentId: finalParentId,
    });

  } catch (error: any) {
    console.error('❌ Create order error:', error);
    
    if (error.statusCode === 401) {
      return NextResponse.json(
        { error: 'Payment gateway authentication failed' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.error?.description || error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
