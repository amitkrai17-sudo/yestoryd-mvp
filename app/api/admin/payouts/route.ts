// ============================================================
// FILE: app/api/admin/payouts/route.ts
// ============================================================
// HARDENED VERSION - Coach Payouts Management
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin-only authentication
// - UUID validation for payout IDs
// - PAN/Bank masking in responses
// - Comprehensive audit logging
// - Request tracing
// - Lazy initialization
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
// Using getServiceSupabase from api-auth.ts

// --- AUTHENTICATION: Using requireAdmin() from lib/api-auth.ts ---

// --- VALIDATION SCHEMAS ---
const ProcessPayoutsSchema = z.object({
  action: z.enum(['mark_paid', 'cancel'], {
    errorMap: () => ({ message: 'Action must be mark_paid or cancel' }),
  }),
  payout_ids: z.array(z.string().uuid('Invalid payout ID'))
    .min(1, 'At least one payout ID required')
    .max(50, 'Maximum 50 payouts per batch'),
  payment_method: z.enum(['razorpay_payout', 'bank_transfer', 'manual']).optional(),
  payment_reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// --- HELPER: Mask sensitive data ---
function maskPAN(pan: string | null): string | null {
  if (!pan) return null;
  if (pan.length < 5) return '***';
  return pan.slice(0, 2) + '****' + pan.slice(-2);
}

function maskBankAccount(account: string | null): string | null {
  if (!account) return null;
  if (account.length < 4) return '***';
  return '****' + account.slice(-4);
}

// --- HELPER: Get quarter and FY ---
function getQuarterAndFY(date: Date): { quarter: string; fy: string } {
  const month = date.getMonth();
  let quarter: string;
  
  if (month >= 3 && month <= 5) quarter = 'Q1';
  else if (month >= 6 && month <= 8) quarter = 'Q2';
  else if (month >= 9 && month <= 11) quarter = 'Q3';
  else quarter = 'Q4';

  const fy = month >= 3
    ? `${date.getFullYear()}-${(date.getFullYear() + 1).toString().slice(-2)}`
    : `${date.getFullYear() - 1}-${date.getFullYear().toString().slice(-2)}`;

  return { quarter, fy };
}

// ============================================================
// GET: List payouts with filters
// ============================================================
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate - Admin only
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: auth.error,
        email: auth.email,
      }));

      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const month = searchParams.get('month'); // Format: YYYY-MM
    const coachId = searchParams.get('coach_id');
    const summary = searchParams.get('summary') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100

    // Validate month format if provided
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      );
    }

    // Validate coach_id if provided
    if (coachId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(coachId)) {
      return NextResponse.json(
        { error: 'Invalid coach_id format' },
        { status: 400 }
      );
    }

    // Validate pagination
    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'payouts_list_request',
      adminEmail: auth.email,
      filters: { status, month, coachId, summary, page, limit },
    }));

    const supabase = getServiceSupabase();

    // 3. If summary requested, return aggregated stats
    if (summary) {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      const { quarter, fy } = getQuarterAndFY(now);

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

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        requestId,
        summary: {
          due_this_month: { amount: dueThisMonth, count: dueCount },
          pending_approval: { amount: pendingAmount, count: pendingCount },
          paid_this_month: { amount: paidThisMonth, count: paidCount },
          tds_to_deposit: { amount: tdsToDeposit, quarter, fy },
        },
      }, {
        headers: { 'X-Request-Id': requestId },
      });
    }

    // 4. Build query for full list with pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // First get total count for pagination metadata
    let countQuery = supabase
      .from('coach_payouts')
      .select('id', { count: 'exact', head: true });

    // Apply same filters to count query
    if (status) countQuery = countQuery.eq('status', status);
    if (coachId) countQuery = countQuery.eq('coach_id', coachId);
    if (month) {
      const startDate = `${month}-01`;
      const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
        .toISOString().split('T')[0];
      countQuery = countQuery.gte('scheduled_date', startDate).lte('scheduled_date', endDate);
    }

    const { count: totalCount } = await countQuery;

    // Now get paginated data
    let query = supabase
      .from('coach_payouts')
      .select(`
        id,
        coach_id,
        enrollment_revenue_id,
        payout_month,
        gross_amount,
        tds_amount,
        net_amount,
        status,
        scheduled_date,
        paid_at,
        payment_method,
        payment_reference,
        created_at,
        coaches:coach_id (id, name, email, pan_number, bank_account_number, bank_ifsc, bank_name)
      `)
      .order('scheduled_date', { ascending: true })
      .range(start, end);

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

    const { data, error } = await query as { data: any[] | null; error: any };

    if (error) throw error;

    // 5. Mask sensitive data in response
    const maskedPayouts = data?.map((payout: any) => {
      const coach = payout.coaches as any;
      return {
        ...payout,
        coaches: coach ? {
          id: coach.id,
          name: coach.name,
          email: coach.email,
          pan_number: maskPAN(coach.pan_number),
          bank_account_masked: maskBankAccount(coach.bank_account_number),
          bank_ifsc: coach.bank_ifsc,
          bank_name: coach.bank_name,
          // Don't expose full bank_account_number
        } : null,
      };
    }) || [];

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'payouts_listed',
      count: maskedPayouts.length,
      totalCount,
      page,
      duration: `${duration}ms`,
    }));

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      success: true,
      requestId,
      payouts: maskedPayouts,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasMore: page < totalPages,
      },
    }, {
      headers: { 'X-Request-Id': requestId },
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'payouts_list_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Failed to fetch payouts', requestId },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Process selected payouts
// ============================================================
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate - Admin only
    const auth = await requireAdmin();

    if (!auth.authorized) {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: auth.error,
        email: auth.email,
      }));

      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validation = ProcessPayoutsSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);

      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors,
      }));

      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const { action, payout_ids, payment_method, payment_reference, notes } = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'process_payouts_request',
      adminEmail: auth.email,
      action,
      payoutCount: payout_ids.length,
    }));

    const supabase = getServiceSupabase();

    // 3. Verify all payout IDs exist and are in processable state
    const { data: existingPayouts, error: checkError } = await supabase
      .from('coach_payouts')
      .select('id, status, net_amount, coach_id')
      .in('id', payout_ids);

    if (checkError) throw checkError;

    if (!existingPayouts || existingPayouts.length !== payout_ids.length) {
      const foundIds = new Set(existingPayouts?.map(p => p.id) || []);
      const missingIds = payout_ids.filter(id => !foundIds.has(id));

      return NextResponse.json(
        { error: 'Some payout IDs not found', missingIds },
        { status: 404 }
      );
    }

    // Check if payouts are in valid state for the action
    const invalidPayouts = existingPayouts.filter(p => {
      if (action === 'mark_paid') {
        return !['scheduled', 'processing'].includes(p.status || '');
      }
      if (action === 'cancel') {
        return !['scheduled'].includes(p.status || '');
      }
      return true;
    });

    if (invalidPayouts.length > 0) {
      return NextResponse.json({
        error: `Some payouts cannot be ${action === 'mark_paid' ? 'marked as paid' : 'cancelled'}`,
        invalidPayouts: invalidPayouts.map(p => ({ id: p.id, status: p.status })),
      }, { status: 400 });
    }

    // 4. Process based on action
    if (action === 'mark_paid') {
      const now = new Date();
      const nowISO = now.toISOString();
      const { quarter, fy } = getQuarterAndFY(now);

      // ATOMIC TRANSACTION: Use Supabase RPC for true atomicity
      // If RPC not available, use two-phase commit pattern
      
      // Prepare TDS entries first (before any updates)
      const payoutsWithCoaches = await supabase
        .from('coach_payouts')
        .select(`
          id, coach_id, gross_amount, tds_amount, net_amount,
          coaches:coach_id (name, pan_number)
        `)
        .in('id', payout_ids);

      if (payoutsWithCoaches.error) throw payoutsWithCoaches.error;

      const tdsEntries = payoutsWithCoaches.data
        ?.filter(p => (p.tds_amount || 0) > 0)
        .map(p => ({
          coach_id: p.coach_id,
          coach_name: (p.coaches as any)?.name,
          coach_pan: (p.coaches as any)?.pan_number,
          financial_year: fy,
          quarter: quarter,
          section: '194J',
          gross_amount: p.gross_amount,
          tds_rate: 10,
          tds_amount: p.tds_amount || 0,
          payout_id: p.id,
          deposited: false,
        })) || [];

      // TWO-PHASE COMMIT PATTERN:
      // Phase 1: Insert TDS entries first (can be rolled back if payout update fails)
      let insertedTdsIds: string[] = [];
      
      if (tdsEntries.length > 0) {
        const { data: insertedTds, error: tdsError } = await supabase
          .from('tds_ledger')
          .insert(tdsEntries)
          .select('id');

        if (tdsError) {
          console.error('TDS insert failed:', tdsError);
          throw new Error('Failed to create TDS entries');
        }
        
        insertedTdsIds = insertedTds?.map(t => t.id) || [];
      }

      // Phase 2: Update payouts
      const { data: updatedPayouts, error: updateError } = await supabase
        .from('coach_payouts')
        .update({
          status: 'paid',
          paid_at: nowISO,
          payment_method: payment_method || 'manual',
          payment_reference: payment_reference || null,
        })
        .in('id', payout_ids)
        .select('id, net_amount, coach_id');

      if (updateError) {
        // ROLLBACK: Delete TDS entries if payout update failed
        if (insertedTdsIds.length > 0) {
          console.log('Rolling back TDS entries due to payout update failure');
          await supabase
            .from('tds_ledger')
            .delete()
            .in('id', insertedTdsIds);
        }
        throw updateError;
      }

      // 5. Audit log (non-critical, don't fail if this fails)
      const totalAmount = updatedPayouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0;

      try {
        await supabase.from('activity_log').insert({
          user_email: auth.email || 'unknown',
      user_type: 'admin',
          action: 'payouts_marked_paid',
          metadata: {
            request_id: requestId,
            payout_ids,
            payout_count: updatedPayouts?.length,
            total_amount: totalAmount,
            payment_method: payment_method || 'manual',
            payment_reference,
            notes,
            tds_entries_created: tdsEntries.length,
            timestamp: nowISO,
          },
          created_at: nowISO,
        });
      } catch (auditError) {
        console.error('Audit log failed (non-critical):', auditError);
      }

      const duration = Date.now() - startTime;

      console.log(JSON.stringify({
        requestId,
        event: 'payouts_marked_paid',
        count: updatedPayouts?.length,
        totalAmount,
        tdsEntriesCreated: tdsEntries.length,
        duration: `${duration}ms`,
      }));

      return NextResponse.json({
        success: true,
        requestId,
        message: `${updatedPayouts?.length} payouts marked as paid`,
        total_amount: totalAmount,
        tds_entries_created: tdsEntries.length,
      }, {
        headers: { 'X-Request-Id': requestId },
      });
    }

    if (action === 'cancel') {
      const nowISO = new Date().toISOString();

      const { data, error } = await supabase
        .from('coach_payouts')
        .update({ status: 'cancelled' })
        .in('id', payout_ids)
        .select('id, net_amount');

      if (error) throw error;

      const totalCancelled = data?.reduce((sum, p) => sum + p.net_amount, 0) || 0;

      // Audit log
      await supabase.from('activity_log').insert({
        user_email: auth.email || 'unknown',
      user_type: 'admin',
        action: 'payouts_cancelled',
        metadata: {
          request_id: requestId,
          payout_ids,
          payout_count: data?.length,
          total_cancelled: totalCancelled,
          notes,
          timestamp: nowISO,
        },
        created_at: nowISO,
      });

      const duration = Date.now() - startTime;

      console.log(JSON.stringify({
        requestId,
        event: 'payouts_cancelled',
        count: data?.length,
        totalCancelled,
        duration: `${duration}ms`,
      }));

      return NextResponse.json({
        success: true,
        requestId,
        message: `${data?.length} payouts cancelled`,
        total_cancelled: totalCancelled,
      }, {
        headers: { 'X-Request-Id': requestId },
      });
    }

    // Should never reach here due to Zod validation
    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'process_payouts_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Failed to process payouts', requestId },
      { status: 500 }
    );
  }
}
