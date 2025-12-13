import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID);
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'EXISTS' : 'MISSING');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      childId,
      childName,
      parentName,
      parentEmail,
      parentPhone,
      coachId,
      packageType,
      source,
      preferredDay,
      preferredTime,
    } = body;

    // Validate required fields
    if (!amount || !childName || !parentEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `yestoryd_${Date.now()}`,
      notes: {
        childId: childId || 'new',
        childName,
        parentName,
        parentEmail,
        parentPhone,
        coachId: coachId || 'rucha',
        packageType: packageType || 'coaching-6',
        source: source || 'yestoryd.com',
        preferredDay: String(preferredDay),
        preferredTime: preferredTime || '',
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}