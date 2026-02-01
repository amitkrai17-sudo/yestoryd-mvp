// ============================================================
// GET /api/admin/payments/stats — Payment stats summary
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const supabase = getServiceSupabase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [todayRes, monthRes, failedRes, refundRes, totalRes] = await Promise.all([
    // Today's revenue
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'captured')
      .gte('captured_at', todayStart),

    // This month's revenue
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'captured')
      .gte('captured_at', monthStart),

    // Failed payments (last 30 days)
    supabase
      .from('failed_payments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(now.getTime() - 30 * 86400000).toISOString()),

    // Refunds (pending + completed)
    supabase
      .from('enrollment_terminations')
      .select('refund_amount, refund_status')
      .in('refund_status', ['initiated', 'completed']),

    // Total all-time revenue
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'captured'),
  ]);

  const sumAmounts = (rows: { amount: number }[] | null) =>
    (rows || []).reduce((sum, r) => sum + (r.amount || 0), 0);

  const refundRows = refundRes.data || [];
  const refundTotal = refundRows.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
  const refundPending = refundRows
    .filter((r) => r.refund_status === 'initiated')
    .reduce((sum, r) => sum + (r.refund_amount || 0), 0);

  return NextResponse.json({
    today: {
      revenue: sumAmounts(todayRes.data),
      count: todayRes.data?.length || 0,
    },
    month: {
      revenue: sumAmounts(monthRes.data),
      count: monthRes.data?.length || 0,
    },
    failed: {
      count: failedRes.count || 0,
    },
    refunds: {
      total: refundTotal,
      pending: refundPending,
      count: refundRows.length,
    },
    allTime: {
      revenue: sumAmounts(totalRes.data),
      count: totalRes.data?.length || 0,
    },
  });
}
