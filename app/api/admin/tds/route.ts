// file: app/api/admin/tds/route.ts
// TDS compliance API for dashboard and reporting

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// GET: TDS summary and details
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fy = searchParams.get('fy'); // Financial year like '2025-26'
    const coachId = searchParams.get('coach_id');

    // Get current financial year if not specified
    const now = new Date();
    const currentFY = now.getMonth() >= 3 
      ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
      : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;
    
    const financialYear = fy || currentFY;

    // Get quarterly summary
    const { data: quarterlyData, error: quarterlyError } = await supabase
      .from('tds_ledger')
      .select('quarter, tds_amount, deposited')
      .eq('financial_year', financialYear);

    if (quarterlyError) throw quarterlyError;

    const quarterlySummary = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const quarterEntries = quarterlyData?.filter(e => e.quarter === q) || [];
      const totalDeducted = quarterEntries.reduce((sum, e) => sum + e.tds_amount, 0);
      const totalDeposited = quarterEntries
        .filter(e => e.deposited)
        .reduce((sum, e) => sum + e.tds_amount, 0);
      const pending = totalDeducted - totalDeposited;

      // Due dates based on quarter
      const dueDates: Record<string, string> = {
        Q1: `Jul 7, ${financialYear.split('-')[0]}`,
        Q2: `Oct 7, ${financialYear.split('-')[0]}`,
        Q3: `Jan 7, ${parseInt(financialYear.split('-')[0]) + 1}`,
        Q4: `Apr 30, ${parseInt(financialYear.split('-')[0]) + 1}`,
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

    // Aggregate by coach
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
        existing.total_paid += entry.gross_amount;
        existing.tds_deducted += entry.tds_amount;
      } else {
        coachMap.set(entry.coach_id, {
          coach_id: entry.coach_id,
          coach_name: entry.coach_name || 'Unknown',
          coach_pan: entry.coach_pan,
          total_paid: entry.gross_amount,
          tds_deducted: entry.tds_amount,
        });
      }
    });

    const coachWise = Array.from(coachMap.values()).map(c => ({
      ...c,
      tds_rate: c.total_paid > 0 ? ((c.tds_deducted / c.total_paid) * 100).toFixed(1) : '0',
      pan_status: c.coach_pan ? 'verified' : 'pending',
    }));

    // Get pending PAN coaches from coaches table
    const { data: coachesNeedingPan } = await supabase
      .from('coaches')
      .select('id, name, pan_number, tds_cumulative_fy')
      .is('pan_number', null)
      .gt('tds_cumulative_fy', 0);

    return NextResponse.json({
      success: true,
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

  } catch (error: unknown) {
    console.error('Error fetching TDS data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch TDS data' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Mark TDS as deposited
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, quarter, financial_year, challan_number, deposit_date, entry_ids } = body;

    if (action === 'mark_deposited') {
      if (!quarter || !financial_year) {
        return NextResponse.json(
          { success: false, error: 'Quarter and financial year required' },
          { status: 400 }
        );
      }

      let updateQuery = supabase
        .from('tds_ledger')
        .update({
          deposited: true,
          deposit_date: deposit_date || new Date().toISOString().split('T')[0],
          challan_number: challan_number || null,
        });

      if (entry_ids && entry_ids.length > 0) {
        updateQuery = updateQuery.in('id', entry_ids);
      } else {
        updateQuery = updateQuery
          .eq('quarter', quarter)
          .eq('financial_year', financial_year)
          .eq('deposited', false);
      }

      const { data, error } = await updateQuery.select();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `${data.length} TDS entries marked as deposited`,
        entries: data,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error: unknown) {
    console.error('Error updating TDS:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update TDS' },
      { status: 500 }
    );
  }
}
