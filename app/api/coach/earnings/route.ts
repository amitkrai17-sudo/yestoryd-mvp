// =============================================================================
// GET /api/coach/earnings
// Coach earnings from coach_payouts (actual data, not projections).
// Supports: month filter, product_type filter, session log, payout history.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (req: NextRequest, { auth, supabase }) => {
  // 1. Get coach
  const { data: coach, error: coachErr } = await supabase
    .from('coaches')
    .select('id, name')
    .eq('email', auth.email!)
    .single();

  if (coachErr || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  const coachId = coach.id;
  const url = new URL(req.url);

  // Default month: current month in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const defaultMonth = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}`;
  const month = url.searchParams.get('month') || defaultMonth;
  const productFilter = url.searchParams.get('product_type') || 'all';

  // 2. Session-level rows for the selected month
  let sessionsQuery = supabase
    .from('coach_payouts')
    .select('id, scheduled_date, child_name, product_type, payout_type, gross_amount, tds_amount, net_amount, status, session_type, description, payout_period, session_id, created_at')
    .eq('coach_id', coachId)
    .eq('payout_period', month)
    .order('created_at', { ascending: false });

  if (productFilter !== 'all') {
    sessionsQuery = sessionsQuery.eq('product_type', productFilter);
  }

  const { data: sessionRows } = await sessionsQuery;

  // Get session dates from scheduled_sessions for matching
  const sessionIds = (sessionRows || []).map(r => r.session_id).filter(Boolean) as string[];
  let sessionDateMap = new Map<string, string>();
  if (sessionIds.length > 0) {
    const { data: ssRows } = await supabase
      .from('scheduled_sessions')
      .select('id, scheduled_date, scheduled_time')
      .in('id', sessionIds);

    for (const ss of ssRows || []) {
      sessionDateMap.set(ss.id, ss.scheduled_date || '');
    }
  }

  const sessions = (sessionRows || []).map(r => ({
    id: r.id,
    date: r.session_id ? sessionDateMap.get(r.session_id) || r.scheduled_date : r.scheduled_date,
    childName: r.child_name || 'Student',
    productType: (r as any).product_type || 'coaching',
    payoutType: r.payout_type,
    grossAmount: r.gross_amount,
    tdsAmount: r.tds_amount ?? 0,
    netAmount: r.net_amount,
    status: r.status,
    sessionType: r.session_type || null,
    description: r.description || null,
    sessionId: r.session_id || null,
  }));

  // 3. Summary — aggregate from the session rows
  const summary = {
    totalGross: 0,
    totalTds: 0,
    totalNet: 0,
    sessionCount: sessions.length,
    byProduct: {} as Record<string, { gross: number; tds: number; net: number; sessions: number }>,
  };

  for (const s of sessions) {
    summary.totalGross += s.grossAmount;
    summary.totalTds += s.tdsAmount;
    summary.totalNet += s.netAmount;

    const pt = s.productType;
    if (!summary.byProduct[pt]) summary.byProduct[pt] = { gross: 0, tds: 0, net: 0, sessions: 0 };
    summary.byProduct[pt].gross += s.grossAmount;
    summary.byProduct[pt].tds += s.tdsAmount;
    summary.byProduct[pt].net += s.netAmount;
    summary.byProduct[pt].sessions += 1;
  }

  // 4. Payout schedule (grouped by scheduled_date + status)
  const payoutMap = new Map<string, { date: string; status: string; total: number; paidAt: string | null; utr: string | null }>();
  for (const s of sessions) {
    const key = `${s.date}-${s.status}`;
    const existing = payoutMap.get(key);
    if (existing) {
      existing.total += s.netAmount;
    } else {
      payoutMap.set(key, {
        date: s.date || '',
        status: s.status || 'scheduled',
        total: s.netAmount,
        paidAt: null,
        utr: null,
      });
    }
  }

  // Check for paid payouts with UTR
  const { data: paidRows } = await supabase
    .from('coach_payouts')
    .select('scheduled_date, paid_at, payment_reference, payment_method')
    .eq('coach_id', coachId)
    .eq('status', 'paid')
    .eq('payout_period', month)
    .limit(10);

  for (const p of paidRows || []) {
    const entries = Array.from(payoutMap.values());
    for (const v of entries) {
      if (v.date === p.scheduled_date && v.status === 'paid') {
        v.paidAt = p.paid_at || null;
        v.utr = p.payment_reference || null;
      }
    }
  }

  const payouts = Array.from(payoutMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  // 5. Available months
  const { data: monthRows } = await supabase
    .from('coach_payouts')
    .select('payout_period')
    .eq('coach_id', coachId)
    .not('payout_period', 'is', null);

  const availableMonths = Array.from(new Set((monthRows || []).map(r => r.payout_period).filter(Boolean)))
    .sort((a, b) => (b as string).localeCompare(a as string));

  return NextResponse.json({
    month,
    summary,
    sessions,
    payouts,
    availableMonths,
  });
}, { auth: 'coach' });
