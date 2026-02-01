// ============================================================
// GET /api/payment/validate-retry?token=xxx
// Validates a payment retry token and returns booking details
// for the retry page to initiate a new Razorpay checkout.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token required' }, { status: 400 });
  }

  const { data: retryToken, error } = await supabase
    .from('payment_retry_tokens')
    .select(`
      id, token, booking_id, parent_id, child_id,
      razorpay_order_id, amount, product_code,
      expires_at, used, used_at
    `)
    .eq('token', token)
    .single();

  if (error || !retryToken) {
    return NextResponse.json({ valid: false, error: 'Invalid or expired token' }, { status: 404 });
  }

  if (retryToken.used) {
    return NextResponse.json({ valid: false, error: 'Token already used' }, { status: 410 });
  }

  if (new Date(retryToken.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Token expired' }, { status: 410 });
  }

  // Fetch booking + parent + child info for the retry page
  const [{ data: booking }, { data: parent }, { data: child }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, razorpay_order_id, amount, status, metadata')
      .eq('id', retryToken.booking_id)
      .single(),
    supabase
      .from('parents')
      .select('id, name, email, phone')
      .eq('id', retryToken.parent_id)
      .single(),
    supabase
      .from('children')
      .select('id, child_name, age')
      .eq('id', retryToken.child_id)
      .single(),
  ]);

  if (!booking || !parent || !child) {
    return NextResponse.json({ valid: false, error: 'Related records not found' }, { status: 404 });
  }

  // Check if this booking was already paid (user may have retried manually)
  if (booking.status === 'paid') {
    return NextResponse.json({ valid: false, error: 'Payment already completed' }, { status: 410 });
  }

  return NextResponse.json({
    valid: true,
    data: {
      tokenId: retryToken.id,
      orderId: retryToken.razorpay_order_id,
      amount: retryToken.amount,
      productCode: retryToken.product_code,
      parentName: parent.name,
      parentEmail: parent.email,
      parentPhone: parent.phone,
      childName: child.child_name,
      childAge: child.age,
      childId: child.id,
      parentId: parent.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    },
  });
}
