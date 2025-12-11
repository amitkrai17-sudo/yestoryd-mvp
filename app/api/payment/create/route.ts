import { NextRequest, NextResponse } from 'next/server';
import { createOrder, PACKAGES, PackageType } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      childId,
      childName,
      coachId = 'rucha', // Default to Rucha
      packageType = 'coaching-6',
      parentName,
      parentEmail,
      parentPhone,
      source = 'yestoryd.com',
    } = body;

    // Validate required fields
    if (!childId || !childName || !parentEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: childId, childName, parentEmail' },
        { status: 400 }
      );
    }

    // Validate package type
    if (!PACKAGES[packageType as PackageType]) {
      return NextResponse.json(
        { success: false, error: 'Invalid package type' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await createOrder({
      childId,
      childName,
      coachId,
      packageType: packageType as PackageType,
      parentName: parentName || '',
      parentEmail,
      parentPhone: parentPhone || '',
      source,
    });

    return NextResponse.json({
      success: true,
      ...order,
    });

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
