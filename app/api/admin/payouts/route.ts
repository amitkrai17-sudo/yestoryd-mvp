// file: app/api/admin/payouts/route.ts
// API for managing coach payouts
// GET: List payouts | POST: Process payouts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// GET: List payouts with filters
// Query params: status, month, coach_id
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const month = searchParams.get('month'); // Format: YYYY-MM
    const coachId = searchParams.get('coach_id');
    const summary = searchParams.get('summary') === 'true';

    // If summary requested, return aggregated stats
    if (summary) {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      
      // Get payouts due this month
      const { data: duePayouts } = await supabase
        .from('coach_payouts')
        .select('net_amount, status')
        .lte('scheduled_date', now.toISOString().split('T')[0])
        .in('status', ['scheduled', 'processing']);

      const dueThisMonth = duePayouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;
      const dueCount = duePayouts?.length || 0;

      // Get pending approval
      const { data: pendingPayouts } = await supabase
        .from('coach_payouts')
        .select('net_amount')
        .eq('status', 'scheduled');

      const pendingAmount = pendingPayouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;
      const pendingCount = pendingPayouts?.length || 0;

      // Get paid this month
      const monthStart = `${currentMonth}-01`;
      const { data: paidPayouts } = await supabase
        .from('coach_payouts')
        .select('net_amount')
        .eq('status', 'paid')
        .gte('paid_at', monthStart);

      const paidThisMonth = paidPayouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;
      const paidCount = paidPayouts?.length || 0;

      // Get TDS to deposit
      const { data: tdsEntries } = await supabase
        .from('tds_ledger')
        .select('tds_amount')
        .eq('deposited', false);

      const tdsToDeposit = tdsEntries?.reduce((sum, t) => sum + t.tds_amount, 0) || 0;

      // Get current quarter
      const getQuarter = (date: Date) => {
        const month = date.getMonth();
        if (month >= 3 && month <= 5) return 'Q1';
        if (month >= 6 && month <= 8) return 'Q2';
        if (month >= 9 && month <= 11) return 'Q3';
        return 'Q4';
      };
      const currentQuarter = getQuarter(now);
      const fy = now.getMonth() >= 3 
        ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
        : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

      return NextResponse.json({
        success: true,
        summary: {
          due_this_month: { amount: dueThisMonth, count: dueCount },
          pending_approval: { amount: pendingAmount, count: pendingCount },
          paid_this_month: { amount: paidThisMonth, count: paidCount },
          tds_to_deposit: { amount: tdsToDeposit, quarter: currentQuarter, fy },
        },
      });
    }

    // Build query
    let query = supabase
      .from('coach_payouts')
      .select(`
        *,
        coaches:coach_id (name, email, pan_number, bank_account_number, bank_ifsc, bank_name)
      `)
      .order('scheduled_date', { ascending: true });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (coachId) {
      query = query.eq('coach_id', coachId);
    }
    if (month) {
      const startDate = `${month}-01`;
      const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
        .toISOString().split('T')[0];
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      payouts: data,
      count: data.length,
    });

  } catch (error: unknown) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Process selected payouts
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payout_ids, payment_method, payment_reference } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action required' },
        { status: 400 }
      );
    }

    // Mark payouts as paid
    if (action === 'mark_paid') {
      if (!payout_ids || !Array.isArray(payout_ids) || payout_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'payout_ids array required' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      // Update payouts
      const { data: updatedPayouts, error: updateError } = await supabase
        .from('coach_payouts')
        .update({
          status: 'paid',
          paid_at: now,
          payment_method: payment_method || 'manual',
          payment_reference: payment_reference || null,
        })
        .in('id', payout_ids)
        .select(`
          *,
          coaches:coach_id (name, pan_number)
        `);

      if (updateError) throw updateError;

      // Create TDS ledger entries for payouts with TDS
      const tdsEntries = updatedPayouts
        ?.filter(p => p.tds_amount > 0)
        .map(p => {
          const now = new Date();
          const getQuarter = (date: Date) => {
            const month = date.getMonth();
            if (month >= 3 && month <= 5) return 'Q1';
            if (month >= 6 && month <= 8) return 'Q2';
            if (month >= 9 && month <= 11) return 'Q3';
            return 'Q4';
          };
          const fy = now.getMonth() >= 3 
            ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
            : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

          return {
            coach_id: p.coach_id,
            coach_name: p.coaches?.name,
            coach_pan: p.coaches?.pan_number,
            financial_year: fy,
            quarter: getQuarter(now),
            section: '194J',
            gross_amount: p.gross_amount,
            tds_rate: 10,
            tds_amount: p.tds_amount,
            payout_id: p.id,
          };
        });

      if (tdsEntries && tdsEntries.length > 0) {
        await supabase.from('tds_ledger').insert(tdsEntries);
      }

      return NextResponse.json({
        success: true,
        message: `${updatedPayouts?.length} payouts marked as paid`,
        payouts: updatedPayouts,
        tds_entries_created: tdsEntries?.length || 0,
      });
    }

    // Cancel payouts
    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('coach_payouts')
        .update({ status: 'cancelled' })
        .in('id', payout_ids)
        .select();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `${data.length} payouts cancelled`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error: unknown) {
    console.error('Error processing payouts:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process payouts' },
      { status: 500 }
    );
  }
}
