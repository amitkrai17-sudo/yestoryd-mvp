// ============================================================
// FILE: app/api/cron/payment-reconciliation/route.ts
// ============================================================
// Payment Reconciliation Cron — Revenue Safety Net
// Detects orphaned Razorpay payments (captured but no enrollment)
// Alerts admins — does NOT auto-create enrollments
// Schedule: 0 17 * * * (5 PM UTC = 10:30 PM IST daily)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import razorpay from '@/lib/razorpay';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// --- TYPES ---

interface OrphanedPayment {
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  captured_at: string;
  has_booking: boolean;
  has_payment_record: boolean;
  has_enrollment: boolean;
  notes: Record<string, string>;
}

// --- AUTH ---

function verifyCronAuth(request: NextRequest): { isValid: boolean; source: string } {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { isValid: true, source: 'vercel_cron' };
  }

  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    return { isValid: true, source: 'qstash' };
  }

  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  return { isValid: false, source: 'none' };
}

// --- RAZORPAY: Fetch Captured Payments ---

async function fetchCapturedPayments(fromTs: number, toTs: number) {
  const payments: any[] = [];
  let skip = 0;

  while (skip < 1000) {
    const batch = await razorpay.payments.all({
      from: fromTs,
      to: toTs,
      count: 100,
      skip,
    });

    const items = (batch as any).items || [];
    const captured = items.filter((p: any) => p.status === 'captured');
    payments.push(...captured);

    if (items.length < 100) break;
    skip += 100;
  }

  return payments;
}

// --- ADMIN ALERT ---

async function sendOrphanAlert(orphans: OrphanedPayment[], requestId: string) {
  if (orphans.length === 0) return;

  const totalAmount = orphans.reduce((sum, o) => sum + o.amount, 0);

  const rows = orphans.map(o => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.razorpay_payment_id}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">₹${o.amount.toLocaleString('en-IN')}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.email || o.phone || 'Unknown'}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.contact_name || '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${new Date(o.captured_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;">
        ${o.has_booking ? 'Booking' : ''}${o.has_payment_record ? ' Payment' : ''}${!o.has_booking && !o.has_payment_record ? 'Nothing' : ''} — No Enrollment
      </td>
    </tr>
  `).join('');

  const { sendEmail } = require('@/lib/email/resend-client');

  const result = await sendEmail({
    to: 'engage@yestoryd.com',
    from: { email: 'engage@yestoryd.com', name: 'Yestoryd System' },
    subject: `⚠️ ${orphans.length} Orphaned Payment${orphans.length > 1 ? 's' : ''} Detected — ₹${totalAmount.toLocaleString('en-IN')}`,
    html: `
          <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
            <h2 style="color:#dc2626;">Orphaned Payments Detected</h2>
            <p style="color:#475569;">
              The payment reconciliation cron found <strong>${orphans.length} captured payment${orphans.length > 1 ? 's' : ''}</strong>
              in Razorpay (totalling <strong>₹${totalAmount.toLocaleString('en-IN')}</strong>) with no matching enrollment in our database.
            </p>
            <p style="color:#475569;">These parents paid but may not have received their enrollment. Please investigate.</p>

            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="text-align:left;padding:8px;">Payment ID</th>
                  <th style="text-align:left;padding:8px;">Amount</th>
                  <th style="text-align:left;padding:8px;">Contact</th>
                  <th style="text-align:left;padding:8px;">Name</th>
                  <th style="text-align:left;padding:8px;">Captured At</th>
                  <th style="text-align:left;padding:8px;">DB Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <p style="margin-top:16px;">
              <a href="https://dashboard.razorpay.com/app/payments" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                Open Razorpay Dashboard
              </a>
              &nbsp;&nbsp;
              <a href="https://yestoryd.com/admin/payments" style="background:#6b7280;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
                Admin Payments
              </a>
            </p>

            <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
              Request ID: ${requestId} | Run at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
          </div>`,
  });

  if (!result.success) {
    console.error(`Email orphan alert error: ${result.error}`);
  }
}

// ============================================================
// GET - Run Reconciliation
// ============================================================
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = verifyCronAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(JSON.stringify({ requestId, event: 'reconciliation_start', source: auth.source }));

  const supabase = createAdminClient();

  try {
    // Look back 48 hours
    const now = Math.floor(Date.now() / 1000);
    const twoDaysAgo = now - 48 * 60 * 60;

    // 1. Fetch all captured payments from Razorpay
    const razorpayPayments = await fetchCapturedPayments(twoDaysAgo, now);
    console.log(JSON.stringify({ requestId, event: 'razorpay_fetched', count: razorpayPayments.length }));

    if (razorpayPayments.length === 0) {
      await logExecution(supabase, requestId, auth.source, { checked: 0, orphans: 0 });
      return NextResponse.json({ success: true, requestId, checked: 0, orphans: 0 });
    }

    // 2. Get all razorpay_payment_ids we have in our payments table
    const rpPaymentIds = razorpayPayments.map((p: any) => p.id);
    const { data: dbPayments } = await supabase
      .from('payments')
      .select('razorpay_payment_id')
      .in('razorpay_payment_id', rpPaymentIds);

    const dbPaymentIdSet = new Set((dbPayments || []).map(p => p.razorpay_payment_id));

    // 3. Get all razorpay_order_ids we have in bookings
    const rpOrderIds = razorpayPayments
      .map((p: any) => p.order_id)
      .filter(Boolean);
    const { data: dbBookings } = await supabase
      .from('bookings')
      .select('razorpay_order_id')
      .in('razorpay_order_id', rpOrderIds);

    const dbBookingOrderSet = new Set((dbBookings || []).map(b => b.razorpay_order_id));

    // 4. Get enrollments that have these payment_ids
    const { data: dbEnrollments } = await supabase
      .from('enrollments')
      .select('payment_id')
      .in('payment_id', rpPaymentIds);

    const enrollmentPaymentSet = new Set((dbEnrollments || []).map(e => e.payment_id));

    // 5. Find orphans: captured in Razorpay but NO enrollment in our DB
    const orphans: OrphanedPayment[] = [];

    for (const payment of razorpayPayments) {
      // Skip if we already have an enrollment for this payment
      if (enrollmentPaymentSet.has(payment.id)) continue;

      const notes = payment.notes || {};

      orphans.push({
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id || null,
        amount: payment.amount / 100, // paise to rupees
        currency: payment.currency || 'INR',
        email: payment.email || notes.parentEmail || null,
        phone: payment.contact || notes.parentPhone || null,
        contact_name: notes.parentName || notes.childName || null,
        captured_at: new Date(payment.created_at * 1000).toISOString(),
        has_booking: dbBookingOrderSet.has(payment.order_id),
        has_payment_record: dbPaymentIdSet.has(payment.id),
        has_enrollment: false,
        notes,
      });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'reconciliation_analysis',
      razorpay_total: razorpayPayments.length,
      orphans_found: orphans.length,
    }));

    // 6. Log each orphan to activity_log for admin visibility
    if (orphans.length > 0) {
      for (const orphan of orphans) {
        await supabase.from('activity_log').insert({
          user_email: 'system@yestoryd.com',
          user_type: 'system',
          action: 'orphaned_payment_detected',
          metadata: {
            request_id: requestId,
            razorpay_payment_id: orphan.razorpay_payment_id,
            razorpay_order_id: orphan.razorpay_order_id,
            amount: orphan.amount,
            currency: orphan.currency,
            email: orphan.email,
            phone: orphan.phone,
            contact_name: orphan.contact_name,
            captured_at: orphan.captured_at,
            has_booking: orphan.has_booking,
            has_payment_record: orphan.has_payment_record,
          },
        });
      }

      // 7. Send admin alert email
      await sendOrphanAlert(orphans, requestId).catch(err =>
        console.error(`Orphan alert email failed: ${err}`)
      );
    }

    // 8. Log cron execution summary
    const summary = {
      checked: razorpayPayments.length,
      orphans: orphans.length,
      total_orphan_amount: orphans.reduce((sum, o) => sum + o.amount, 0),
    };

    await logExecution(supabase, requestId, auth.source, summary);

    return NextResponse.json({
      success: true,
      requestId,
      ...summary,
      orphaned_payments: orphans,
    });
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'reconciliation_error', error: String(error) }));

    try {
      await supabase.from('activity_log').insert({
        user_email: 'system@yestoryd.com',
        user_type: 'system',
        action: 'payment_reconciliation_error',
        metadata: { request_id: requestId, error: String(error) },
      });
    } catch { /* best-effort logging */ }

    return NextResponse.json({ error: 'Reconciliation failed', requestId }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

// --- HELPERS ---

async function logExecution(
  supabase: ReturnType<typeof createAdminClient>,
  requestId: string,
  source: string,
  summary: { checked: number; orphans: number; total_orphan_amount?: number },
) {
  await supabase.from('activity_log').insert({
    user_email: 'system@yestoryd.com',
    user_type: 'system',
    action: 'payment_reconciliation_completed',
    metadata: {
      request_id: requestId,
      source,
      ...summary,
      completed_at: new Date().toISOString(),
    },
  });
}
