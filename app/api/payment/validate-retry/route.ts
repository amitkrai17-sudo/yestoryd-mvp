// ============================================================
// GET /api/payment/validate-retry?token=xxx
// Validates a payment retry token and returns booking details
// for the retry page to initiate a new Razorpay checkout.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token required' }, { status: 400 });
  }

  const { data: retryToken, error } = await supabase
    .from('payment_retry_tokens')
    .select(`
      id, token, booking_id, expires_at, used_at
    `)
    .eq('token', token)
    .single();

  if (error || !retryToken) {
    return NextResponse.json({ valid: false, error: 'Invalid or expired token' }, { status: 404 });
  }

  if (retryToken.used_at) {
    return NextResponse.json({ valid: false, error: 'Token already used' }, { status: 410 });
  }

  if (new Date(retryToken.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Token expired' }, { status: 410 });
  }

  if (!retryToken.booking_id) {
    return NextResponse.json({ valid: false, error: 'Invalid token - no booking associated' }, { status: 400 });
  }

  // Fetch booking info (which has parent_id, child_id, etc.)
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, razorpay_order_id, amount, status, metadata, parent_id, child_id')
    .eq('id', retryToken.booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ valid: false, error: 'Booking not found' }, { status: 404 });
  }

  // Check if this booking was already paid (user may have retried manually)
  if (booking.status === 'paid') {
    return NextResponse.json({ valid: false, error: 'Payment already completed' }, { status: 410 });
  }

  // Validate booking has parent and child IDs
  if (!booking.parent_id || !booking.child_id) {
    return NextResponse.json({ valid: false, error: 'Booking missing parent or child information' }, { status: 400 });
  }

  // Type-safe after null check
  const parentId = booking.parent_id;
  const childId = booking.child_id;

  // Fetch parent and child info
  const [{ data: parent }, { data: child }] = await Promise.all([
    supabase
      .from('parents')
      .select('id, name, email, phone')
      .eq('id', parentId)
      .single(),
    supabase
      .from('children')
      .select('id, child_name, age')
      .eq('id', childId)
      .single(),
  ]);

  if (!parent || !child) {
    return NextResponse.json({ valid: false, error: 'Parent or child not found' }, { status: 404 });
  }

  // Extract product code from metadata
  const productCode = (booking.metadata as Record<string, unknown>)?.product_code as string ?? 'full';

  return NextResponse.json({
    valid: true,
    data: {
      tokenId: retryToken.id,
      orderId: booking.razorpay_order_id,
      amount: booking.amount,
      productCode,
      parentName: parent.name,
      parentEmail: parent.email,
      parentPhone: parent.phone ?? null,
      childName: child.child_name,
      childAge: child.age ?? null,
      childId: child.id,
      parentId: parent.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    },
  });
}
