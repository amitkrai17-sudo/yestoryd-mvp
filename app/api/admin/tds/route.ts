// ============================================================
// FILE: app/api/admin/tds/route.ts
// ============================================================
// HARDENED VERSION - TDS Compliance Dashboard
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin-only authentication
// - PAN number masking
// - Input validation
// - Audit logging for deposits
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- HELPER: Mask PAN number ---
function maskPAN(pan: string | null): string | null {
  if (!pan) return null;
  // "ABCDE1234F" → "AB****34F"
  if (pan.length < 5) return '****';
  return pan.slice(0, 2) + '****' + pan.slice(-3);
}

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- HELPER: Validate financial year format ---
function isValidFY(fy: string): boolean {
  // Format: "2025-26"
  return /^\d{4}-\d{2}$/.test(fy);
}

// --- VALIDATION SCHEMA ---
const markDepositedSchema = z.object({
  action: z.literal('mark_deposited'),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  financial_year: z.string().refine(isValidFY, 'Invalid financial year format (use YYYY-YY)'),
  challan_number: z.string().max(50).optional(),
  deposit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
  entry_ids: z.array(z.string().uuid()).max(100).optional(),
});

// ============================================================
// GET: TDS summary and details
// ============================================================
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Admin-only authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if ((session.user as any).role !== 'admin') {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Admin required for TDS data',
        userEmail: session.user.email,
      }));

      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const fy = searchParams.get('fy');
    const coachId = searchParams.get('coach_id');

    // Validate financial year format if provided
    if (fy && !isValidFY(fy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid financial year format (use YYYY-YY)' },
        { status: 400 }
      );
    }

    // Validate coach ID if provided
    if (coachId && !isValidUUID(coachId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid coach ID format' },
        { status: 400 }
      );
    }

    // Get current financial year if not specified
    const now = new Date();
    const currentFY = now.getMonth() >= 3
      ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
      : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

    const financialYear = fy || currentFY;

    console.log(JSON.stringify({
      requestId,
      event: 'tds_summary_request',
      adminEmail: session.user.email,
      financialYear,
      coachId: coachId || 'all',
    }));

    const supabase = getSupabase();

    // 3. Get quarterly summary
    const { data: quarterlyData, error: quarterlyError } = await supabase
      .from('tds_ledger')
      .select('quarter, tds_amount, deposited')
      .eq('financial_year', financialYear);

    if (quarterlyError) throw quarterlyError;

    const quarterlySummary = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const quarterEntries = quarterlyData?.filter(e => e.quarter === q) || [];
      const totalDeducted = quarterEntries.reduce((sum, e) => sum + (e.tds_amount || 0), 0);
      const totalDeposited = quarterEntries
        .filter(e => e.deposited)
        .reduce((sum, e) => sum + (e.tds_amount || 0), 0);
      const pending = totalDeducted - totalDeposited;

      // Due dates based on quarter
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

    // 4. Get coach-wise TDS
    let coachQuery = supabase
      .from('tds_ledger')
      .select(`
        coach_id,
        coach_name,
        coach_pan,
        gross_amount,
        tds_amount
      `)
      .eq('financial_year', financialYear);

    if (coachId) {
      coachQuery = coachQuery.eq('coach_id', coachId);
    }

    const { data: coachData, error: coachError } = await coachQuery;

    if (coachError) throw coachError;

    // 5. Aggregate by coach
    const coachMap = new Map<string, {
      coach_id: string;
      coach_name: string;
      coach_pan: string | null;
      total_paid: number;
      tds_deducted: number;
    }>();

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

    // 6. MASK PAN NUMBERS in response
    const coachWise = Array.from(coachMap.values()).map(c => ({
      coach_id: c.coach_id,
      coach_name: c.coach_name,
      coach_pan_masked: maskPAN(c.coach_pan), // Masked!
      pan_status: c.coach_pan ? 'verified' : 'pending',
      total_paid: c.total_paid,
      tds_deducted: c.tds_deducted,
      tds_rate: c.total_paid > 0 ? ((c.tds_deducted / c.total_paid) * 100).toFixed(1) : '0',
    }));

    // 7. Get coaches needing PAN
    const { data: coachesNeedingPan } = await supabase
      .from('coaches')
      .select('id, name, tds_cumulative_fy')
      .is('pan_number', null)
      .gt('tds_cumulative_fy', 0);

    return NextResponse.json({
      success: true,
      requestId,
      financial_year: financialYear,
      quarterly_summary: quarterlySummary,
      coach_wise: coachWise,
      alerts: {
        coaches_needing_pan: coachesNeedingPan?.map(c => ({
          id: c.id,
          name: c.name,
          earnings_ytd: c.tds_cumulative_fy,
        })) || [],
      },
      totals: {
        total_deducted: quarterlySummary.reduce((sum, q) => sum + q.deducted, 0),
        total_deposited: quarterlySummary.reduce((sum, q) => sum + q.deposited, 0),
        total_pending: quarterlySummary.reduce((sum, q) => sum + q.pending, 0),
      },
    });

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'tds_summary_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

    return NextResponse.json(
      { success: false, error: 'Failed to fetch TDS data', requestId },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Mark TDS as deposited
// ============================================================
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Admin-only authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if ((session.user as any).role !== 'admin') {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Admin required for TDS deposit marking',
        userEmail: session.user.email,
      }));

      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const adminEmail = session.user.email;

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Check action type
    if (body.action !== 'mark_deposited') {
      return NextResponse.json(
        { success: false, error: 'Unknown action' },
        { status: 400 }
      );
    }

    const validationResult = markDepositedSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    console.log(JSON.stringify({
      requestId,
      event: 'tds_deposit_request',
      adminEmail,
      quarter: validated.quarter,
      financialYear: validated.financial_year,
      entryCount: validated.entry_ids?.length || 'all',
    }));

    const supabase = getSupabase();

    // 3. Get current state for audit
    let countQuery = supabase
      .from('tds_ledger')
      .select('id, tds_amount', { count: 'exact' })
      .eq('quarter', validated.quarter)
      .eq('financial_year', validated.financial_year)
      .eq('deposited', false);

    if (validated.entry_ids && validated.entry_ids.length > 0) {
      countQuery = countQuery.in('id', validated.entry_ids);
    }

    const { count: pendingCount, data: pendingEntries } = await countQuery;

    if (!pendingCount || pendingCount === 0) {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No pending TDS entries to mark as deposited',
        entries_updated: 0,
      });
    }

    // 4. Update entries
    let updateQuery = supabase
      .from('tds_ledger')
      .update({
        deposited: true,
        deposit_date: validated.deposit_date || new Date().toISOString().split('T')[0],
        challan_number: validated.challan_number || null,
      });

    if (validated.entry_ids && validated.entry_ids.length > 0) {
      updateQuery = updateQuery.in('id', validated.entry_ids);
    } else {
      updateQuery = updateQuery
        .eq('quarter', validated.quarter)
        .eq('financial_year', validated.financial_year)
        .eq('deposited', false);
    }

    const { data, error } = await updateQuery.select('id');

    if (error) throw error;

    // 5. Calculate total amount deposited
    const totalDeposited = pendingEntries?.reduce((sum, e) => sum + (e.tds_amount || 0), 0) || 0;

    // 6. Audit log
    await supabase.from('activity_log').insert({
      user_email: adminEmail,
      action: 'tds_marked_deposited',
      details: {
        request_id: requestId,
        quarter: validated.quarter,
        financial_year: validated.financial_year,
        entries_updated: data?.length || 0,
        total_amount: totalDeposited,
        challan_number: validated.challan_number || null,
        deposit_date: validated.deposit_date || new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'tds_deposit_complete',
      entriesUpdated: data?.length || 0,
      totalAmount: totalDeposited,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `${data?.length || 0} TDS entries marked as deposited`,
      entries_updated: data?.length || 0,
      total_amount: totalDeposited,
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'tds_deposit_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Failed to update TDS', requestId },
      { status: 500 }
    );
  }
}