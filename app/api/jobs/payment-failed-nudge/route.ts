// ============================================================
// FILE: app/api/jobs/payment-failed-nudge/route.ts
// ============================================================
// 30-minute nudge for failed payments.
// Queued from app/api/payment/webhook/route.ts (processPaymentFailed)
// with delay=1800 right after the immediate failure notification.
//
// Sequence:
//   1. Verify QStash signature (memory: Apr 22 outage was missing this).
//   2. Lookup failed_payments by id; bail if missing or already converted.
//   3. Check whether the parent retried successfully — if any payments row
//      with status='captured' exists for this order_id, mark converted_at
//      and skip the nudge.
//   4. Resolve child_name from children table.
//   5. Send parent_payment_retry_nudge_v1 via canonical sendNotification().
//      contextId = razorpay_payment_id → matches the immediate-failure hash
//      family for per-incident dedup.
//   6. Log outcome to activity_log either way (per B2.3 addition #1).
//
// Failure handling: any logical failure returns 200 to QStash so we don't
// trigger the retry-3x storm. Only signature/parse failures return 4xx.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { sendNotification } from '@/lib/communication/notify';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface NudgePayload {
  failedPaymentId: string;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Verify QStash signature
  const rawBody = await request.text();
  const auth = await verifyCronRequest(request, rawBody);
  if (!auth.isValid) {
    console.warn(JSON.stringify({
      requestId, event: 'nudge_unauthorized', error: auth.error,
    }));
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Parse body
  let payload: NudgePayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const failedPaymentId = payload?.failedPaymentId;
  if (!failedPaymentId || typeof failedPaymentId !== 'string') {
    return NextResponse.json({ error: 'Missing failedPaymentId' }, { status: 400 });
  }

  const supabase = createAdminClient();

  console.log(JSON.stringify({
    requestId, event: 'nudge_start', failedPaymentId,
  }));

  // 3. Lookup failed_payments row
  const { data: failed, error: fetchErr } = await supabase
    .from('failed_payments')
    .select('id, razorpay_payment_id, razorpay_order_id, parent_id, child_id, parent_email, retry_token_id, converted_at')
    .eq('id', failedPaymentId)
    .maybeSingle();

  if (fetchErr) {
    console.error(JSON.stringify({
      requestId, event: 'nudge_lookup_error', failedPaymentId, error: fetchErr.message,
    }));
    return NextResponse.json({ status: 'lookup_error' });
  }

  if (!failed) {
    console.log(JSON.stringify({
      requestId, event: 'nudge_failed_payment_not_found', failedPaymentId,
    }));
    return NextResponse.json({ status: 'not_found' });
  }

  if (failed.converted_at) {
    console.log(JSON.stringify({
      requestId, event: 'nudge_already_converted',
      failedPaymentId, convertedAt: failed.converted_at,
    }));
    return NextResponse.json({ status: 'already_converted' });
  }

  // 4. Check whether parent retried successfully (any captured payment for this order_id)
  const { data: capturedRow } = await supabase
    .from('payments')
    .select('id, captured_at')
    .eq('razorpay_order_id', failed.razorpay_order_id)
    .eq('status', 'captured')
    .limit(1)
    .maybeSingle();

  if (capturedRow) {
    await supabase
      .from('failed_payments')
      .update({ converted_at: new Date().toISOString() })
      .eq('id', failed.id);

    console.log(JSON.stringify({
      requestId, event: 'nudge_converted_before_send',
      failedPaymentId, capturedPaymentId: capturedRow.id,
    }));
    return NextResponse.json({ status: 'converted_before_nudge' });
  }

  // 5. Resolve child name
  let childName = 'your child';
  if (failed.child_id) {
    const { data: child } = await supabase
      .from('children')
      .select('child_name, name')
      .eq('id', failed.child_id)
      .maybeSingle();
    childName = child?.child_name || child?.name || 'your child';
  }

  // 6. Send the nudge
  if (!failed.parent_id) {
    console.log(JSON.stringify({
      requestId, event: 'nudge_no_parent_id', failedPaymentId,
    }));
    return NextResponse.json({ status: 'no_parent_id' });
  }

  // (B2.4) NUDGE DEBOUNCE: one nudge per order per 24h.
  //   When a parent retries the SAME order N times and each retry fails, B2.3
  //   queues N nudges. Suppress all but the first to actually fire here.
  //   The captured-payment check above already short-circuits on success;
  //   this 24h-window check covers the still-failing case.
  //
  //   Fail-safe policy is INVERTED vs. the immediate-notification debounce:
  //   on debounce-check error, SKIP the nudge. Cost asymmetry: missing the
  //   first failure is bad (parent stuck); missing a duplicate nudge is fine.
  const twentyFourHoursAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: priorNudges, error: nudgeErr } = await supabase
    .from('activity_log')
    .select('id, created_at')
    .eq('action', 'payment_failed_nudge_sent')
    .filter('metadata->>razorpay_order_id', 'eq', failed.razorpay_order_id)
    .gte('created_at', twentyFourHoursAgoIso)
    .limit(1);

  if (nudgeErr) {
    console.error(JSON.stringify({
      requestId, event: 'nudge_debounce_check_error',
      failedPaymentId, error: nudgeErr.message,
    }));
    return NextResponse.json({ status: 'debounce_check_failed' }, { status: 200 });
  }

  if (priorNudges && priorNudges.length > 0) {
    await supabase.from('activity_log').insert({
      action: 'payment_failed_nudge_debounced',
      user_email: 'system',
      user_type: 'system',
      metadata: {
        razorpay_order_id: failed.razorpay_order_id,
        razorpay_payment_id: failed.razorpay_payment_id,
        failed_payment_id: failedPaymentId,
        parent_id: failed.parent_id,
        prior_nudge_at: priorNudges[0].created_at,
        reason: 'already_nudged_within_24h',
      },
    });
    console.log(JSON.stringify({
      requestId, event: 'nudge_debounced',
      failedPaymentId, priorNudgeAt: priorNudges[0].created_at,
    }));
    return NextResponse.json({ status: 'nudge_debounced' }, { status: 200 });
  }

  // (B2.5) Fetch canonical parent_name + retry token. Validator's
  // resolveDerivations() will produce parent_first_name / child_first_name
  // from these. We never pass first names directly.
  const { data: parentRow } = await supabase
    .from('parents')
    .select('name')
    .eq('id', failed.parent_id)
    .maybeSingle();
  const parentName = parentRow?.name ?? '';

  let retryLink = '';
  if (failed.retry_token_id) {
    const { data: tokenRow } = await supabase
      .from('payment_retry_tokens')
      .select('token')
      .eq('id', failed.retry_token_id)
      .maybeSingle();
    if (tokenRow?.token) {
      retryLink = `https://yestoryd.com/r/${tokenRow.token}`;
    }
  }

  let sendOk = false;
  let sendReason: string | undefined;
  try {
    const result = await sendNotification(
      'parent_payment_retry_nudge_v1',
      failed.parent_id,
      {
        parent_name: parentName,
        child_name: childName,
        retry_link: retryLink,
      },
      {
        contextId: failed.razorpay_payment_id,
        contextType: 'failed_payment_nudge',
        triggeredBy: 'system',
      },
    );
    sendOk = result.success;
    sendReason = result.reason;
  } catch (err: unknown) {
    sendOk = false;
    sendReason = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      requestId, event: 'nudge_send_threw', error: sendReason,
    }));
  }

  // 7. Log outcome — success OR failure (per B2.3 addition #1)
  await supabase.from('activity_log').insert({
    action: sendOk ? 'payment_failed_nudge_sent' : 'payment_failed_notification_send_failed',
    user_email: 'system',
    user_type: 'system',
    metadata: {
      razorpay_payment_id: failed.razorpay_payment_id,
      razorpay_order_id: failed.razorpay_order_id,
      parent_id: failed.parent_id,
      failed_payment_id: failed.id,
      job: 'payment_failed_nudge',
      send_success: sendOk,
      reason: sendOk ? null : (sendReason ?? 'unknown'),
    },
  });

  console.log(JSON.stringify({
    requestId, event: sendOk ? 'nudge_sent' : 'nudge_send_failed',
    failedPaymentId, reason: sendReason,
  }));

  // Return 200 either way — logical failures don't trigger QStash retries.
  return NextResponse.json({
    status: sendOk ? 'nudge_sent' : 'nudge_failed',
    reason: sendOk ? undefined : sendReason,
  });
}
