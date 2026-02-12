// ============================================================
// FILE: app/api/cron/payment-reconciliation/route.ts
// ============================================================
// Payment Reconciliation Cron - Finds orphaned Razorpay payments
// Schedule via QStash: 30 17 * * * (11 PM IST daily)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

// --- VERIFICATION ---
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
async function fetchRazorpayPayments(fromTs: number, toTs: number) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const payments: any[] = [];
  let skip = 0;

  while (skip < 1000) {
    const url = `https://api.razorpay.com/v1/payments?from=${fromTs}&to=${toTs}&count=100&skip=${skip}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    if (!res.ok) throw new Error(`Razorpay API error: ${res.status}`);

    const data = await res.json();
    const captured = (data.items || []).filter((p: any) => p.status === 'captured');
    payments.push(...captured);

    if ((data.items || []).length < 100) break;
    skip += 100;
  }

  return payments;
}

// --- ADMIN NOTIFICATION ---
async function sendAdminNotification(childName: string, amount: number, paymentId: string) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: 'engage@yestoryd.com', name: 'Yestoryd Admin' }] }],
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd Academy' },
      subject: `Payment Recovered: ${childName} - ₹${amount}`,
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1e293b;">Payment Recovered via Reconciliation</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px;font-weight:bold;">Child</td><td style="padding:8px;">${childName}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Amount</td><td style="padding:8px;">₹${amount}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Payment ID</td><td style="padding:8px;">${paymentId}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Recovered At</td><td style="padding:8px;">${new Date().toISOString()}</td></tr>
            </table>
            <p style="color:#64748b;margin-top:16px;">This payment was automatically recovered by the reconciliation cron.</p>
          </div>`,
      }],
    }),
  });

  if (!response.ok) {
    console.error(`SendGrid admin notification error: ${response.status}`);
  }
}

// --- RECOVERY ---
async function recoverPayment(payment: any, requestId: string) {
  const supabase = getServiceSupabase();

  // Check if already has enrollment
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id')
    .eq('payment_id', payment.id)
    .maybeSingle();

  if (existing) return { status: 'already_enrolled', id: existing.id };

  // Find booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('razorpay_order_id', payment.order_id)
    .maybeSingle();

  if (!booking) return { status: 'no_booking' };

  // Check child already enrolled
  const { data: childEnroll } = await supabase
    .from('enrollments')
    .select('id')
    .eq('child_id', booking.child_id)
    .eq('status', 'active')
    .maybeSingle();

  if (childEnroll) {
    await supabase.from('enrollments').update({ payment_id: payment.id }).eq('id', childEnroll.id);
    return { status: 'already_enrolled', id: childEnroll.id };
  }

  // Get coach
  let coachId = booking.coach_id;
  if (!coachId) {
    const { data: coach } = await supabase
      .from('coaches')
      .select('id')
      .eq('is_active', true)
      .order('current_students')
      .limit(1)
      .single();
    coachId = coach?.id;
  }

  if (!coachId) return { status: 'no_coach' };

  // Update booking
  await supabase.from('bookings').update({ status: 'paid' }).eq('id', booking.id);

  // Create payment record if missing
  const { data: existingPay } = await supabase
    .from('payments')
    .select('id')
    .eq('razorpay_payment_id', payment.id)
    .maybeSingle();

  if (!existingPay) {
    await supabase.from('payments').insert({
      parent_id: booking.parent_id,
      child_id: booking.child_id,
      razorpay_order_id: payment.order_id,
      razorpay_payment_id: payment.id,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: 'captured',
      source: 'reconciliation',
    });
  }

  // Create enrollment
  const programEnd = new Date();
  programEnd.setMonth(programEnd.getMonth() + 3);

  // V2: Fetch child age → age_band_config for dynamic session parameters
  const { data: childData } = await supabase
    .from('children')
    .select('age, age_band')
    .eq('id', booking.child_id)
    .maybeSingle();

  let ageBandConfig: { age_band?: string; total_sessions?: number; session_duration_minutes?: number; sessions_per_week?: number } | null = null;
  if (childData?.age) {
    const { data: config } = await supabase
      .from('age_band_config')
      .select('age_band, total_sessions, session_duration_minutes, sessions_per_week')
      .lte('min_age', childData.age)
      .gte('max_age', childData.age)
      .maybeSingle();
    ageBandConfig = config;
  }

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .insert({
      child_id: booking.child_id,
      parent_id: booking.parent_id,
      coach_id: coachId,
      payment_id: payment.id,
      status: 'active',
      program_start: new Date().toISOString(),
      program_end: programEnd.toISOString(),
      total_sessions: ageBandConfig?.total_sessions || 9,
      session_duration_minutes: ageBandConfig?.session_duration_minutes || 45,
      sessions_per_week: ageBandConfig?.sessions_per_week || null,
      age_band: ageBandConfig?.age_band || childData?.age_band || null,
      season_number: 1,
      sessions_completed: 0,
      source: 'reconciliation',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { status: 'race_condition' };
    return { status: 'error', error: error.message };
  }

  // Update child
  await supabase
    .from('children')
    .update({ enrollment_status: 'enrolled', coach_id: coachId })
    .eq('id', booking.child_id);

  console.log(JSON.stringify({ requestId, event: 'payment_recovered', paymentId: payment.id, enrollmentId: enrollment.id }));

  // Fetch child name for notification
  const { data: child } = await supabase
    .from('children')
    .select('name')
    .eq('id', booking.child_id)
    .maybeSingle();

  const childName = child?.name || `Child ${booking.child_id}`;
  const amount = payment.amount / 100;

  // Send admin email notification
  await sendAdminNotification(childName, amount, payment.id).catch(err =>
    console.error(`Admin notification failed: ${err}`)
  );

  // Log to activity_log
  await supabase.from('activity_log').insert({
    user_email: 'engage@yestoryd.com',
    action: 'payment_recovered',
    details: {
      request_id: requestId,
      payment_id: payment.id,
      child_id: booking.child_id,
      child_name: childName,
      amount,
      enrollment_id: enrollment.id,
    },
  });

  return { status: 'recovered', id: enrollment.id };
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

  try {
    const supabase = getServiceSupabase();
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60;

    // Fetch Razorpay payments
    const razorpayPayments = await fetchRazorpayPayments(sevenDaysAgo, now);

    // Get our DB payments
    const { data: dbPayments } = await supabase
      .from('payments')
      .select('razorpay_payment_id')
      .gte('created_at', new Date(sevenDaysAgo * 1000).toISOString());

    const dbIds = new Set((dbPayments || []).map(p => p.razorpay_payment_id));

    // Find orphaned
    const orphaned = razorpayPayments.filter(p => !dbIds.has(p.id));

    const results = { recovered: 0, already_enrolled: 0, failed: 0, total: orphaned.length };

    for (const payment of orphaned) {
      const result = await recoverPayment(payment, requestId);
      if (result.status === 'recovered') results.recovered++;
      else if (result.status === 'already_enrolled' || result.status === 'race_condition') results.already_enrolled++;
      else results.failed++;
    }

    console.log(JSON.stringify({ requestId, event: 'reconciliation_complete', results }));

    // Summary activity log
    await supabase.from('activity_log').insert({
      user_email: 'engage@yestoryd.com',
      action: 'payment_reconciliation_cron_executed',
      details: {
        request_id: requestId,
        source: auth.source,
        razorpay_payments_checked: razorpayPayments.length,
        orphaned_found: orphaned.length,
        results,
      },
    });

    return NextResponse.json({ success: true, requestId, results });
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'reconciliation_error', error: String(error) }));
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}