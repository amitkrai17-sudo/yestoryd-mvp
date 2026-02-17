// ============================================================
// FILE: app/api/admin/orphaned-payments/route.ts
// ============================================================
// Returns orphaned payments detected by the reconciliation cron
// Queries activity_log for recent orphaned_payment_detected entries
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch orphaned payment detections from activity_log
    const { data: logs, error } = await supabase
      .from('activity_log')
      .select('id, metadata, created_at')
      .eq('action', 'orphaned_payment_detected')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Orphaned payments query error:', error);
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    // Deduplicate by razorpay_payment_id (cron may detect same orphan on consecutive runs)
    const seen = new Set<string>();
    const orphans = [];

    for (const log of logs || []) {
      const meta = log.metadata as Record<string, any> | null;
      if (!meta?.razorpay_payment_id) continue;

      if (seen.has(meta.razorpay_payment_id)) continue;
      seen.add(meta.razorpay_payment_id);

      orphans.push({
        id: log.id,
        detected_at: log.created_at,
        razorpay_payment_id: meta.razorpay_payment_id,
        razorpay_order_id: meta.razorpay_order_id,
        amount: meta.amount,
        currency: meta.currency || 'INR',
        email: meta.email,
        phone: meta.phone,
        contact_name: meta.contact_name,
        captured_at: meta.captured_at,
        has_booking: meta.has_booking,
        has_payment_record: meta.has_payment_record,
      });
    }

    // Also fetch the latest cron run summary
    const { data: lastRun } = await supabase
      .from('activity_log')
      .select('metadata, created_at')
      .eq('action', 'payment_reconciliation_completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      orphans,
      total: orphans.length,
      last_cron_run: lastRun ? {
        ran_at: lastRun.created_at,
        ...(lastRun.metadata as Record<string, any>),
      } : null,
    });
  } catch (error) {
    console.error('Orphaned payments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
