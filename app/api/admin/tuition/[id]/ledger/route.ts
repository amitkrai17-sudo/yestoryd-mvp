// ============================================================
// FILE: app/api/admin/tuition/[id]/ledger/route.ts
// PURPOSE: Get ledger history for a tuition enrollment.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { withParamsHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withParamsHandler<{ id: string }>(async (_req: NextRequest, { id: enrollmentId }, { supabase }) => {
  const { data: entries, error } = await supabase
    .from('tuition_session_ledger')
    .select('id, change_amount, balance_after, reason, session_id, payment_id, notes, created_by, created_at')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }

  return NextResponse.json({ entries: entries || [], total: entries?.length || 0 });
}, { auth: 'admin' });
