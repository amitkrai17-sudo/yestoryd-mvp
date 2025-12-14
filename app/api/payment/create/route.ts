import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      amount,
      childName,
      childAge,
      parentName,
      parentEmail,
      parentPhone,
      coachId,
    } = body;

    // Validate required fields
    if (!amount || !childName || !parentName || !parentEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Debug: Log keys (first few chars only)
    console.log('Razorpay Key ID:', process.env.RAZORPAY_KEY_ID?.substring(0, 12));
    console.log('Razorpay Secret:', process.env.RAZORPAY_KEY_SECRET ? 'EXISTS' : 'MISSING');

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        childName,
        childAge: childAge || '',
        parentName,
        parentEmail,
        parentPhone: parentPhone || '',
        coachId: coachId || 'rucha',
      },
    });

    console.log('✅ Razorpay order created:', order.id);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    
    // Handle specific Razorpay errors
    if (error.statusCode === 401) {
      return NextResponse.json(
        { error: 'Payment gateway authentication failed. Check API keys.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: error.error?.description || error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}