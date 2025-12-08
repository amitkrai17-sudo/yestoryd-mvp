import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/razorpay/client';
import { PackageType } from '@/lib/utils/revenue-split';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      studentId,
      coachId,
      packageType,
      source,
      assignedBy,
      parentName,
      parentEmail,
      parentPhone,
    } = body;

    // Validate required fields
    if (!studentId || !coachId || !packageType || !parentEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate package type
    if (!['6-sessions', '2-sessions'].includes(packageType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid package type' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await createOrder({
      studentId,
      coachId,
      packageType: packageType as PackageType,
      source: source || 'yestoryd.com',
      assignedBy: assignedBy || 'auto',
      parentName: parentName || '',
      parentEmail,
      parentPhone: parentPhone || '',
    });

    return NextResponse.json({
      success: true,
      ...order,
    });

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}
