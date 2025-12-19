// file: app/api/payouts/process/route.ts
// Process pending payouts via Razorpay Payouts API
// Can be called manually or via cron job

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Razorpay auth
function getRazorpayAuth(): string {
  return Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');
}

// Get financial year
function getFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 3) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

// Get quarter
function getQuarter(): string {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) return 'Q1';
  if (month >= 6 && month <= 8) return 'Q2';
  if (month >= 9 && month <= 11) return 'Q3';
  return 'Q4';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = 'preview', payout_ids } = body;

    // Get due payouts
    const today = new Date().toISOString().split('T')[0];

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
      .lte('scheduled_date', today);

    // If specific payout IDs provided
    if (payout_ids && payout_ids.length > 0) {
      query = query.in('id', payout_ids);
    }

    const { data: payouts, error: payoutsError } = await query;

    if (payoutsError) throw payoutsError;

    if (!payouts || payouts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending payouts found',
        processed: 0,
      });
    }

    console.log(`📊 Found ${payouts.length} pending payouts`);

    // Group by coach for batch processing
    const payoutsByCoach = new Map<string, typeof payouts>();
    for (const payout of payouts) {
      const coachId = payout.coach_id;
      if (!payoutsByCoach.has(coachId)) {
        payoutsByCoach.set(coachId, []);
      }
      payoutsByCoach.get(coachId)!.push(payout);
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Process each coach's payouts
    for (const [coachId, coachPayouts] of Array.from(payoutsByCoach.entries())) {
      const coach = coachPayouts[0].coaches;

      if (!coach) {
        errors.push({ coachId, error: 'Coach not found' });
        continue;
      }

      // Check if payout is enabled
      if (!coach.payout_enabled) {
        errors.push({
          coachId,
          coachName: coach.name,
          error: 'Payout not enabled - coach needs to complete onboarding',
        });
        continue;
      }

      // Check bank details
      if (!coach.bank_account_number || !coach.bank_ifsc) {
        errors.push({
          coachId,
          coachName: coach.name,
          error: 'Missing bank details',
        });
        continue;
      }

      // Check PAN (required for TDS)
      if (!coach.pan_number) {
        errors.push({
          coachId,
          coachName: coach.name,
          error: 'Missing PAN number - required for TDS compliance',
        });
        continue;
      }

      // Calculate total for this coach
      const totalGross = coachPayouts.reduce((sum, p) => sum + p.gross_amount, 0);
      const totalTds = coachPayouts.reduce((sum, p) => sum + p.tds_amount, 0);
      const totalNet = coachPayouts.reduce((sum, p) => sum + p.net_amount, 0);

      console.log(`💰 Coach ${coach.name}: ₹${totalNet} (${coachPayouts.length} payouts)`);

      // Preview mode - don't actually process
      if (mode === 'preview') {
        results.push({
          coach_id: coachId,
          coach_name: coach.name,
          payout_count: coachPayouts.length,
          gross_amount: totalGross,
          tds_amount: totalTds,
          net_amount: totalNet,
          bank: `${coach.bank_name} - XXXX${coach.bank_account_number?.slice(-4)}`,
          status: 'preview',
        });
        continue;
      }

      // LIVE MODE - Process via Razorpay Payouts
      try {
        const razorpayAuth = getRazorpayAuth();

        // Ensure fund account exists
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

        // Create payout
        const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${razorpayAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Your Razorpay X account
            fund_account_id: fundAccountId,
            amount: totalNet * 100, // In paise
            currency: 'INR',
            mode: 'IMPS', // or 'NEFT'
            purpose: 'payout',
            queue_if_low_balance: true,
            reference_id: `PAYOUT-${coachId.slice(0, 8)}-${Date.now()}`,
            narration: `Yestoryd Coach Payout`,
            notes: {
              coach_id: coachId,
              coach_name: coach.name,
              payout_count: coachPayouts.length,
              month: new Date().toISOString().slice(0, 7),
            },
          }),
        });

        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          const utr = payoutData.utr || payoutData.id;

          // Update all payouts for this coach
          for (const payout of coachPayouts) {
            await supabase
              .from('coach_payouts')
              .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                payment_reference: utr,
                payment_method: 'razorpay_payout',
              })
              .eq('id', payout.id);

            // Create TDS ledger entry if applicable
            if (payout.tds_amount > 0) {
              await supabase.from('tds_ledger').insert({
                coach_id: coachId,
                coach_name: coach.name,
                coach_pan: coach.pan_number,
                financial_year: getFinancialYear(),
                quarter: getQuarter(),
                section: '194J',
                gross_amount: payout.gross_amount,
                tds_rate: 10,
                tds_amount: payout.tds_amount,
                payout_id: payout.id,
              });
            }
          }

          results.push({
            coach_id: coachId,
            coach_name: coach.name,
            payout_count: coachPayouts.length,
            gross_amount: totalGross,
            tds_amount: totalTds,
            net_amount: totalNet,
            utr: utr,
            status: 'success',
          });

          console.log(`✅ Payout successful for ${coach.name}: UTR ${utr}`);

        } else {
          const errorText = await payoutRes.text();
          throw new Error(`Razorpay payout failed: ${errorText}`);
        }

      } catch (payoutError: any) {
        console.error(`❌ Payout failed for ${coach.name}:`, payoutError);

        // Mark payouts as failed
        for (const payout of coachPayouts) {
          await supabase
            .from('coach_payouts')
            .update({
              status: 'failed',
              notes: payoutError.message,
            })
            .eq('id', payout.id);
        }

        errors.push({
          coach_id: coachId,
          coach_name: coach.name,
          error: payoutError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      summary: {
        total_payouts: payouts.length,
        coaches_processed: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: errors.length,
        total_amount: results.reduce((sum, r) => sum + r.net_amount, 0),
      },
      results,
      errors,
    });

  } catch (error: any) {
    console.error('❌ Payout processing error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Payout processing failed' },
      { status: 500 }
    );
  }
}

// GET: Preview pending payouts
export async function GET() {
  try {
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

    // Group by coach
    const summary = new Map<string, { name: string; count: number; amount: number; enabled: boolean }>();

    for (const payout of payouts || []) {
      const coach = payout.coaches;
      const coachId = payout.coach_id;

      if (!summary.has(coachId)) {
        summary.set(coachId, {
          name: coach?.name || 'Unknown',
          count: 0,
          amount: 0,
          enabled: coach?.payout_enabled && !!coach?.bank_account_number,
        });
      }

      const s = summary.get(coachId)!;
      s.count++;
      s.amount += payout.net_amount;
    }

    return NextResponse.json({
      success: true,
      total_pending: payouts?.length || 0,
      total_amount: payouts?.reduce((sum, p) => sum + p.net_amount, 0) || 0,
      by_coach: Array.from(summary.entries()).map(([id, data]) => ({
        coach_id: id,
        ...data,
      })),
    });

  } catch (error: any) {
    console.error('Error fetching pending payouts:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
