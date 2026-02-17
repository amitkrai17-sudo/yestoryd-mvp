// ============================================================
// FILE: app/api/payouts/process/route.ts
// ============================================================
// HARDENED VERSION - Process Coach Payouts via Razorpay
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Internal API key OR Admin authentication
// - Idempotency (prevents double-processing)
// - Batch processing with cursor (avoids timeout)
// - Audit logging for all financial operations
// - PII masking in responses
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
// Using getServiceSupabase from api-auth.ts

// --- CONSTANTS ---
const BATCH_SIZE = 20; // Max coaches per request (prevents timeout)
const RAZORPAY_RATE_LIMIT_DELAY = 100; // ms between Razorpay calls

// --- HELPER: Razorpay auth ---
function getRazorpayAuth(): string {
  return Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');
}

// --- HELPER: Get financial year ---
function getFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

// --- HELPER: Get quarter ---
function getQuarter(): string {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) return 'Q1';
  if (month >= 6 && month <= 8) return 'Q2';
  if (month >= 9 && month <= 11) return 'Q3';
  return 'Q4';
}

// --- HELPER: Mask bank account ---
function maskBankAccount(account: string | null): string | null {
  if (!account) return null;
  if (account.length < 4) return '****';
  return '****' + account.slice(-4);
}

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- HELPER: Verify authorization ---
async function verifyAuth(request: NextRequest): Promise<{ 
  isValid: boolean; 
  source: 'internal' | 'admin' | 'none';
  adminEmail?: string;
}> {
  // 1. Check internal API key (from cron job)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 2. Check admin session (manual trigger)
  const auth = await requireAdmin();
  if (auth.authorized && auth.role === 'admin') {
    return { isValid: true, source: 'admin', adminEmail: auth.email };
  }

  return { isValid: false, source: 'none' };
}

// --- VALIDATION SCHEMA ---
const processPayoutSchema = z.object({
  mode: z.enum(['preview', 'live']).default('preview'),
  payout_ids: z.array(z.string().uuid()).max(100).optional(),
  cursor: z.string().uuid().optional(), // For batch continuation
  triggered_by: z.string().optional(),
  request_id: z.string().optional(),
});

// ============================================================
// POST: Process pending payouts
// ============================================================
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. AUTHORIZATION
    const auth = await verifyAuth(request);
    
    if (!auth.isValid) {
      console.error(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Unauthorized payout request',
      }));
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Internal or admin access required.' },
        { status: 401 }
      );
    }

    // 2. PARSE AND VALIDATE BODY
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = processPayoutSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { mode, payout_ids, cursor, triggered_by } = validationResult.data;

    console.log(JSON.stringify({
      requestId,
      event: 'payout_process_started',
      source: auth.source,
      adminEmail: auth.adminEmail,
      mode,
      payoutIdsCount: payout_ids?.length || 'all',
      cursor,
      triggeredBy: triggered_by,
    }));

    const supabase = getServiceSupabase();
    const today = new Date().toISOString().split('T')[0];

    // 3. FETCH DUE PAYOUTS (with batch limit)
    let query = supabase
      .from('coach_payouts')
      .select(`
        *,
        coaches:coach_id (
          id, name, email, pan_number,
          bank_account_number, bank_ifsc, bank_name, bank_account_holder,
          razorpay_contact_id, razorpay_fund_account_id,
          payout_enabled, tds_cumulative_fy
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_date', today)
      .order('coach_id', { ascending: true });

    // Specific payout IDs
    if (payout_ids && payout_ids.length > 0) {
      query = query.in('id', payout_ids);
    }

    // Cursor for batch continuation
    if (cursor) {
      query = query.gt('coach_id', cursor);
    }

    const { data: payouts, error: payoutsError } = await query;

    if (payoutsError) throw payoutsError;

    if (!payouts || payouts.length === 0) {
      return NextResponse.json({
        success: true,
        requestId,
        message: 'No pending payouts found',
        processed: 0,
      });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'payouts_fetched',
      count: payouts.length,
    }));

    // 4. GROUP BY COACH (with batch limit)
    const payoutsByCoach = new Map<string, typeof payouts>();
    for (const payout of payouts) {
      const coachId = payout.coach_id;
      if (!payoutsByCoach.has(coachId)) {
        payoutsByCoach.set(coachId, []);
      }
      payoutsByCoach.get(coachId)!.push(payout);
    }

    // Apply batch limit
    const coachIds = Array.from(payoutsByCoach.keys()).slice(0, BATCH_SIZE);
    const hasMore = payoutsByCoach.size > BATCH_SIZE;
    const nextCursor = hasMore ? coachIds[coachIds.length - 1] : null;

    const results: any[] = [];
    const errors: any[] = [];

    // 5. PROCESS EACH COACH'S PAYOUTS
    for (const coachId of coachIds) {
      const coachPayouts = payoutsByCoach.get(coachId)!;
      const coach = coachPayouts[0].coaches;

      if (!coach) {
        errors.push({ coachId, error: 'Coach not found' });
        continue;
      }

      // 5a. Validation checks
      if (!coach.payout_enabled) {
        errors.push({
          coachId,
          coachName: coach.name,
          error: 'Payout not enabled - coach needs to complete onboarding',
        });
        continue;
      }

      if (!coach.bank_account_number || !coach.bank_ifsc) {
        errors.push({
          coachId,
          coachName: coach.name,
          error: 'Missing bank details',
        });
        continue;
      }

      if (!coach.pan_number) {
        errors.push({
          coachId,
          coachName: coach.name,
          error: 'Missing PAN number - required for TDS compliance',
        });
        continue;
      }

      // 5b. Calculate totals
      const totalGross = coachPayouts.reduce((sum, p) => sum + p.gross_amount, 0);
      const totalTds = coachPayouts.reduce((sum, p) => sum + (p.tds_amount ?? 0), 0);
      const totalNet = coachPayouts.reduce((sum, p) => sum + p.net_amount, 0);

      // 5c. IDEMPOTENCY CHECK - Skip if any payout already processed
      const alreadyProcessed = coachPayouts.some(p => 
        p.status === 'paid' || p.status === 'processing'
      );
      
      if (alreadyProcessed) {
        console.log(JSON.stringify({
          requestId,
          event: 'skipping_duplicate',
          coachId,
          reason: 'Some payouts already processed',
        }));
        continue;
      }

      // 5d. Preview mode - don't actually process
      if (mode === 'preview') {
        results.push({
          coach_id: coachId,
          coach_name: coach.name,
          payout_count: coachPayouts.length,
          gross_amount: totalGross,
          tds_amount: totalTds,
          net_amount: totalNet,
          bank: `${coach.bank_name} - ${maskBankAccount(coach.bank_account_number)}`,
          status: 'preview',
        });
        continue;
      }

      // 5e. LIVE MODE - Mark as processing first (idempotency)
      const payoutIds = coachPayouts.map(p => p.id);
      await supabase
        .from('coach_payouts')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .in('id', payoutIds);

      try {
        const razorpayAuth = getRazorpayAuth();

        // 5f. Ensure fund account exists
        let fundAccountId = coach.razorpay_fund_account_id;

        if (!fundAccountId) {
          // Create contact first if needed
          let contactId = coach.razorpay_contact_id;

          if (!contactId) {
            const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${razorpayAuth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: coach.bank_account_holder || coach.name,
                email: coach.email,
                type: 'vendor',
                reference_id: coachId,
              }),
            });

            if (contactRes.ok) {
              const contactData = await contactRes.json();
              contactId = contactData.id;

              await supabase
                .from('coaches')
                .update({ razorpay_contact_id: contactId })
                .eq('id', coachId);
            } else {
              throw new Error('Failed to create Razorpay contact');
            }
          }

          // Create fund account
          const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${razorpayAuth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contact_id: contactId,
              account_type: 'bank_account',
              bank_account: {
                name: coach.bank_account_holder || coach.name,
                ifsc: coach.bank_ifsc,
                account_number: coach.bank_account_number,
              },
            }),
          });

          if (fundRes.ok) {
            const fundData = await fundRes.json();
            fundAccountId = fundData.id;

            await supabase
              .from('coaches')
              .update({ razorpay_fund_account_id: fundAccountId })
              .eq('id', coachId);
          } else {
            throw new Error('Failed to create Razorpay fund account');
          }
        }

        // 5g. Create Razorpay payout
        const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${razorpayAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
            fund_account_id: fundAccountId,
            amount: totalNet * 100, // In paise
            currency: 'INR',
            mode: 'IMPS',
            purpose: 'payout',
            queue_if_low_balance: true,
            reference_id: `PAYOUT-${coachId.slice(0, 8)}-${Date.now()}`,
            narration: 'Yestoryd Coach Payout',
            notes: {
              coach_id: coachId,
              coach_name: coach.name,
              payout_count: coachPayouts.length,
              month: new Date().toISOString().slice(0, 7),
              request_id: requestId,
            },
          }),
        });

        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          const utr = payoutData.utr || payoutData.id;

          // 5h. BATCH UPDATE all payouts for this coach
          await supabase
            .from('coach_payouts')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              payment_reference: utr,
              payment_method: 'razorpay_payout',
            })
            .in('id', payoutIds);

          // 5i. BATCH INSERT TDS ledger entries
          const tdsEntries = coachPayouts
            .filter(p => (p.tds_amount ?? 0) > 0)
            .map(p => ({
              coach_id: coachId,
              coach_name: coach.name,
              coach_pan: coach.pan_number,
              financial_year: getFinancialYear(),
              quarter: getQuarter(),
              section: '194J',
              gross_amount: p.gross_amount,
              tds_rate: 10,
              tds_amount: p.tds_amount ?? 0,
              payout_id: p.id,
            }));

          if (tdsEntries.length > 0) {
            await supabase.from('tds_ledger').insert(tdsEntries);
          }

          // 5j. Audit log
          await supabase.from('activity_log').insert({
            user_email: auth.adminEmail || 'engage@yestoryd.com',
      user_type: 'system',
            action: 'payout_processed',
            metadata: {
              request_id: requestId,
              coach_id: coachId,
              coach_name: coach.name,
              payout_count: coachPayouts.length,
              gross_amount: totalGross,
              tds_amount: totalTds,
              net_amount: totalNet,
              utr,
              source: auth.source,
              triggered_by,
              timestamp: new Date().toISOString(),
            },
            created_at: new Date().toISOString(),
          });

          results.push({
            coach_id: coachId,
            coach_name: coach.name,
            payout_count: coachPayouts.length,
            gross_amount: totalGross,
            tds_amount: totalTds,
            net_amount: totalNet,
            utr,
            status: 'success',
          });

          console.log(JSON.stringify({
            requestId,
            event: 'payout_success',
            coachId,
            coachName: coach.name,
            netAmount: totalNet,
            utr,
          }));

        } else {
          const errorText = await payoutRes.text();
          throw new Error(`Razorpay payout failed: ${errorText}`);
        }

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, RAZORPAY_RATE_LIMIT_DELAY));

      } catch (payoutError: any) {
        console.error(JSON.stringify({
          requestId,
          event: 'payout_failed',
          coachId,
          coachName: coach.name,
          error: payoutError.message,
        }));

        // Revert to scheduled (so it can be retried)
        await supabase
          .from('coach_payouts')
          .update({
            status: 'failed',
            notes: payoutError.message,
            updated_at: new Date().toISOString(),
          })
          .in('id', payoutIds);

        // Audit log failure
        await supabase.from('activity_log').insert({
          user_email: auth.adminEmail || 'engage@yestoryd.com',
      user_type: 'system',
          action: 'payout_failed',
          metadata: {
            request_id: requestId,
            coach_id: coachId,
            coach_name: coach.name,
            error: payoutError.message,
            source: auth.source,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });

        errors.push({
          coach_id: coachId,
          coach_name: coach.name,
          error: payoutError.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'payout_process_complete',
      mode,
      coachesProcessed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: errors.length,
      hasMore,
      nextCursor,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      mode,
      summary: {
        total_payouts: payouts.length,
        coaches_processed: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: errors.length,
        total_amount: results.reduce((sum, r) => sum + (r.net_amount || 0), 0),
      },
      results,
      errors,
      // Pagination for large batches
      pagination: {
        hasMore,
        nextCursor,
        batchSize: BATCH_SIZE,
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'payout_process_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message || 'Payout processing failed' },
      { status: 500 }
    );
  }
}

// ============================================================
// GET: Preview pending payouts (Admin only)
// ============================================================
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 1. AUTHORIZATION
    const auth = await verifyAuth(request);
    
    if (!auth.isValid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();
    const today = new Date().toISOString().split('T')[0];

    const { data: payouts, error } = await supabase
      .from('coach_payouts')
      .select(`
        *,
        coaches:coach_id (name, email, payout_enabled, bank_account_number)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_date', today)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    // Group by coach with MASKED bank details
    const summary = new Map<string, { 
      name: string; 
      count: number; 
      amount: number; 
      enabled: boolean;
      bank_masked: string | null;
    }>();

    for (const payout of payouts || []) {
      const coach = payout.coaches;
      const coachId = payout.coach_id;

      if (!summary.has(coachId)) {
        summary.set(coachId, {
          name: coach?.name || 'Unknown',
          count: 0,
          amount: 0,
          enabled: !!(coach?.payout_enabled && coach?.bank_account_number),
          bank_masked: maskBankAccount(coach?.bank_account_number),
        });
      }

      const s = summary.get(coachId)!;
      s.count++;
      s.amount += payout.net_amount;
    }

    return NextResponse.json({
      success: true,
      requestId,
      total_pending: payouts?.length || 0,
      total_amount: payouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0,
      by_coach: Array.from(summary.entries()).map(([id, data]) => ({
        coach_id: id,
        ...data,
      })),
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'pending_payouts_error',
      error: error.message,
    }));

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
