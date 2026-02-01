// ============================================================
// GET /api/admin/payments/export — CSV export of payments
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status') || 'all';

  const supabase = getServiceSupabase();

  let query = supabase
    .from('payments')
    .select(`
      id, razorpay_order_id, razorpay_payment_id, amount, currency, status,
      captured_at, coupon_code, source, created_at,
      parent:parent_id (name, email, phone),
      child:child_id (child_name, age)
    `)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (from) {
    query = query.gte('created_at', `${from}T00:00:00`);
  }
  if (to) {
    query = query.lte('created_at', `${to}T23:59:59`);
  }

  const { data: payments, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }

  // Build CSV
  const headers = [
    'Date', 'Payment ID', 'Order ID', 'Amount', 'Currency', 'Status',
    'Parent Name', 'Parent Email', 'Parent Phone',
    'Child Name', 'Child Age', 'Coupon', 'Source',
  ];

  const rows = (payments || []).map((p: any) => [
    p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '',
    p.razorpay_payment_id || '',
    p.razorpay_order_id || '',
    p.amount || 0,
    p.currency || 'INR',
    p.status || '',
    p.parent?.name || '',
    p.parent?.email || '',
    p.parent?.phone || '',
    p.child?.child_name || '',
    p.child?.age || '',
    p.coupon_code || '',
    p.source || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row: any[]) =>
      row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
