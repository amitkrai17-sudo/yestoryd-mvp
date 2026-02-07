// ============================================================
// FILE: app/api/admin/tds/route.ts
// ============================================================
// HARDENED VERSION - TDS Compliance Dashboard
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: PAN masking, input validation, audit logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- HELPER: Mask PAN number ---
function maskPAN(pan: string | null): string | null {
  if (!pan) return null;
  if (pan.length < 5) return '****';
  return pan.slice(0, 2) + '****' + pan.slice(-3);
}

// --- HELPER: Validate financial year format ---
function isValidFY(fy: string): boolean {
  return /^\d{4}-\d{2}$/.test(fy);
}

// --- VALIDATION SCHEMAS ---
const getQuerySchema = z.object({
  fy: z.string().refine(val => !val || isValidFY(val), 'Invalid FY format (use YYYY-YY)').optional(),
  coach_id: z.string().uuid('Invalid coach ID').optional(),
});

const markDepositedSchema = z.object({
  action: z.literal('mark_deposited'),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  financial_year: z.string().refine(isValidFY, 'Invalid financial year format (use YYYY-YY)'),
  challan_number: z.string().max(50).optional(),
  deposit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
  entry_ids: z.array(z.string().uuid()).max(100).optional(),
});

// --- GET: TDS summary and details ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'tds_get_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getQuerySchema.safeParse({
      fy: searchParams.get('fy') || undefined,
      coach_id: searchParams.get('coach_id') || undefined,
    });

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { fy, coach_id: coachId } = validation.data;

    // Get current financial year if not specified
    const now = new Date();
    const currentFY = now.getMonth() >= 3
      ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
      : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

    const financialYear = fy || currentFY;

    console.log(JSON.stringify({ requestId, event: 'tds_get_request', adminEmail: auth.email, financialYear, coachId: coachId || 'all' }));

    const supabase = getServiceSupabase();

    // Get quarterly summary
    const { data: quarterlyData, error: quarterlyError } = await supabase
      .from('tds_ledger')
      .select('quarter, tds_amount, deposited')
      .eq('financial_year', financialYear);

    if (quarterlyError) throw quarterlyError;

    const quarterlySummary = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const quarterEntries = quarterlyData?.filter(e => e.quarter === q) || [];
      const totalDeducted = quarterEntries.reduce((sum, e) => sum + (e.tds_amount || 0), 0);
      const totalDeposited = quarterEntries.filter(e => e.deposited).reduce((sum, e) => sum + (e.tds_amount || 0), 0);
      const pending = totalDeducted - totalDeposited;

      const fyStart = parseInt(financialYear.split('-')[0]);
      const dueDates: Record<string, string> = {
        Q1: `Jul 7, ${fyStart}`,
        Q2: `Oct 7, ${fyStart}`,
        Q3: `Jan 7, ${fyStart + 1}`,
        Q4: `Apr 30, ${fyStart + 1}`,
      };

      return {
        quarter: q,
        deducted: totalDeducted,
        deposited: totalDeposited,
        pending,
        due_date: dueDates[q],
        status: totalDeducted === 0 ? 'n/a' : pending === 0 ? 'complete' : 'pending',
      };
    });

    // Get coach-wise TDS
    let coachQuery = supabase
      .from('tds_ledger')
      .select('coach_id, coach_name, coach_pan, gross_amount, tds_amount')
      .eq('financial_year', financialYear);

    if (coachId) {
      coachQuery = coachQuery.eq('coach_id', coachId);
    }

    const { data: coachData, error: coachError } = await coachQuery;
    if (coachError) throw coachError;

    // Aggregate by coach
    const coachMap = new Map<string, { coach_id: string; coach_name: string; coach_pan: string | null; total_paid: number; tds_deducted: number }>();

    coachData?.forEach(entry => {
      const existing = coachMap.get(entry.coach_id);
      if (existing) {
        existing.total_paid += entry.gross_amount || 0;
        existing.tds_deducted += entry.tds_amount || 0;
      } else {
        coachMap.set(entry.coach_id, {
          coach_id: entry.coach_id,
          coach_name: entry.coach_name || 'Unknown',
          coach_pan: entry.coach_pan,
          total_paid: entry.gross_amount || 0,
          tds_deducted: entry.tds_amount || 0,
        });
      }
    });

    // MASK PAN NUMBERS in response
    const coachWise = Array.from(coachMap.values()).map(c => ({
      coach_id: c.coach_id,
      coach_name: c.coach_name,
      coach_pan_masked: maskPAN(c.coach_pan),
      pan_status: c.coach_pan ? 'verified' : 'pending',
      total_paid: c.total_paid,
      tds_deducted: c.tds_deducted,
      tds_rate: c.total_paid > 0 ? ((c.tds_deducted / c.total_paid) * 100).toFixed(1) : '0',
    }));

    // Get coaches needing PAN
    const { data: coachesNeedingPan } = await supabase
      .from('coaches')
      .select('id, name, tds_cumulative_fy')
      .is('pan_number', null)
      .gt('tds_cumulative_fy', 0);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'tds_get_success', financialYear, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      financial_year: financialYear,
      quarterly_summary: quarterlySummary,
      coach_wise: coachWise,
      alerts: {
        coaches_needing_pan: coachesNeedingPan?.map(c => ({ id: c.id, name: c.name, earnings_ytd: c.tds_cumulative_fy })) || [],
      },
      totals: {
        total_deducted: quarterlySummary.reduce((sum, q) => sum + q.deducted, 0),
        total_deposited: quarterlySummary.reduce((sum, q) => sum + q.deposited, 0),
        total_pending: quarterlySummary.reduce((sum, q) => sum + q.pending, 0),
      },
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'tds_get_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Failed to fetch TDS data', requestId }, { status: 500 });
  }
}

// --- POST: Mark TDS as deposited ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'tds_post_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.action !== 'mark_deposited') {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    const validation = markDepositedSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const validated = validation.data;

    console.log(JSON.stringify({ requestId, event: 'tds_deposit_request', adminEmail: auth.email, quarter: validated.quarter, financialYear: validated.financial_year }));

    const supabase = getServiceSupabase();

    // Get pending entries
    let countQuery = supabase
      .from('tds_ledger')
      .select('id, tds_amount', { count: 'exact' })
      .eq('quarter', validated.quarter)
      .eq('financial_year', validated.financial_year)
      .eq('deposited', false);

    if (validated.entry_ids?.length) {
      countQuery = countQuery.in('id', validated.entry_ids);
    }

    const { count: pendingCount, data: pendingEntries } = await countQuery;

    if (!pendingCount || pendingCount === 0) {
      return NextResponse.json({ success: true, requestId, message: 'No pending TDS entries', entries_updated: 0 });
    }

    // Update entries
    let updateQuery = supabase
      .from('tds_ledger')
      .update({
        deposited: true,
        deposit_date: validated.deposit_date || new Date().toISOString().split('T')[0],
        challan_number: validated.challan_number || null,
      });

    if (validated.entry_ids?.length) {
      updateQuery = updateQuery.in('id', validated.entry_ids);
    } else {
      updateQuery = updateQuery
        .eq('quarter', validated.quarter)
        .eq('financial_year', validated.financial_year)
        .eq('deposited', false);
    }

    const { data, error } = await updateQuery.select('id');
    if (error) throw error;

    const totalDeposited = pendingEntries?.reduce((sum, e) => sum + (e.tds_amount || 0), 0) || 0;

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'tds_marked_deposited',
      details: {
        request_id: requestId,
        quarter: validated.quarter,
        financial_year: validated.financial_year,
        entries_updated: data?.length || 0,
        total_amount: totalDeposited,
        challan_number: validated.challan_number || null,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'tds_deposit_success', entriesUpdated: data?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `${data?.length || 0} TDS entries marked as deposited`,
      entries_updated: data?.length || 0,
      total_amount: totalDeposited,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'tds_post_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Failed to update TDS', requestId }, { status: 500 });
  }
}
