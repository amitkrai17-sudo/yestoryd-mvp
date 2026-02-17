// ============================================================
// FILE: app/api/payment/webhook/route.ts
// ============================================================
// HARDENED VERSION v2 - With Race Condition Fix
// Incorporates feedback: Graceful unique constraint handling
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { queueEnrollmentComplete } from '@/lib/qstash';
import { loadCoachConfig, loadPaymentConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

// --- 1. VALIDATION SCHEMAS ---

const PaymentEntitySchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number(),
  currency: z.string().default('INR'),
  status: z.string(),
  method: z.string().optional(),
  email: z.string().email().optional(),
  contact: z.string().optional(),
  error_code: z.string().optional().nullable(),
  error_description: z.string().optional().nullable(),
  notes: z.record(z.any()).optional(),
});

const RefundEntitySchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  amount: z.number(),
  status: z.string(),
  notes: z.record(z.any()).optional(),
});

const WebhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: PaymentEntitySchema,
    }).optional(),
    refund: z.object({
      entity: RefundEntitySchema,
    }).optional(),
  }),
  created_at: z.number().optional(),
});

// --- 2. TYPES ---
interface ProcessingResult {
  status: 'success' | 'already_processed' | 'skipped' | 'error';
  enrollmentId?: string;
  message?: string;
}

// --- 3. SECURITY HELPERS ---

function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error(JSON.stringify({ event: 'webhook_secret_missing' }));
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

async function checkAndRecordWebhook(
  webhookId: string,
  eventType: string,
  requestId: string
): Promise<{ isDuplicate: boolean }> {
  const { error } = await supabase
    .from('processed_webhooks')
    .insert({
      webhook_id: webhookId,
      event_type: eventType,
      processed_at: new Date().toISOString(),
      request_id: requestId,
    });

  if (error?.code === '23505') {
    console.log(JSON.stringify({ requestId, event: 'webhook_duplicate', webhookId }));
    return { isDuplicate: true };
  }

  return { isDuplicate: false };
}

// --- 4. BUSINESS LOGIC ---

async function getCoachId(
  coachId: string | null | undefined,
  requestId: string
): Promise<string | null> {
  if (coachId) {
    const { data } = await supabase
      .from('coaches')
      .select('id')
      .eq('id', coachId)
      .single();
    if (data) return data.id;
  }

  const coachConfig = await loadCoachConfig();
  const { data: defaultCoach } = await supabase
    .from('coaches')
    .select('id')
    .eq('id', coachConfig.defaultCoachId)
    .single();

  if (!defaultCoach) {
    console.error(JSON.stringify({ requestId, event: 'no_default_coach' }));
    return null;
  }

  return defaultCoach.id;
}

async function processPaymentCaptured(
  payment: z.infer<typeof PaymentEntitySchema>,
  requestId: string
): Promise<ProcessingResult> {
  const { id: paymentId, order_id: orderId, amount: amountPaise } = payment;
  const amount = amountPaise / 100;

  console.log(JSON.stringify({
    requestId,
    event: 'processing_payment',
    paymentId,
    orderId,
    amount,
  }));

  // 1. Check existing enrollment (first line of defense)
  const { data: existingEnrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('payment_id', paymentId)
    .maybeSingle();

  if (existingEnrollment) {
    console.log(JSON.stringify({
      requestId,
      event: 'already_processed_via_verify',
      enrollmentId: existingEnrollment.id,
    }));
    return { status: 'already_processed', enrollmentId: existingEnrollment.id };
  }

  // 2. Check payment record
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  if (existingPayment) {
    return { status: 'already_processed', message: 'Payment already recorded' };
  }

  // 3. Find booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, child_id, parent_id, coach_id, metadata')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();

  if (!booking) {
    console.log(JSON.stringify({ requestId, event: 'booking_not_found', orderId }));
    return { status: 'skipped', message: 'No booking found for order' };
  }

  // Extract metadata
  const meta = (booking.metadata as Record<string, any>) || {};
  const bookingData = {
    child_name: meta.child_name || 'Child',
    parent_name: meta.parent_name || 'Parent',
    parent_email: meta.parent_email || '',
    parent_phone: meta.parent_phone || '',
    lead_source: meta.lead_source || 'yestoryd',
    lead_source_coach_id: meta.lead_source_coach_id || null,
    coupon_code: meta.coupon_code || null,
  };

  // 4. Get coach
  const finalCoachId = await getCoachId(booking.coach_id, requestId);
  if (!finalCoachId) {
    return { status: 'error', message: 'No coach available' };
  }

  // 5. Update booking (with optimistic lock)
  await supabase
    .from('bookings')
    .update({
      status: 'paid',
      payment_id: paymentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .eq('status', 'pending');

  // 6. Create payment record
  await supabase.from('payments').insert({
    parent_id: booking.parent_id,
    child_id: booking.child_id,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    amount: amount,
    currency: (await loadPaymentConfig()).currency,
    status: 'captured',
    captured_at: new Date().toISOString(),
    source: 'webhook',
    coupon_code: bookingData.coupon_code,
  });

  // 7. Create enrollment (with unique constraint handling)
  const programStart = new Date();
  const programEnd = new Date();
  programEnd.setMonth(programEnd.getMonth() + 3);

  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .insert({
      child_id: booking.child_id,
      parent_id: booking.parent_id,
      coach_id: finalCoachId,
      payment_id: paymentId,
      amount: amount,
      status: 'active',
      program_start: programStart.toISOString(),
      program_end: programEnd.toISOString(),
      schedule_confirmed: false,
      sessions_scheduled: 0,
      lead_source: bookingData.lead_source,
      lead_source_coach_id: bookingData.lead_source === 'coach' ? bookingData.lead_source_coach_id : null,
      referral_code_used: bookingData.coupon_code,
      source: 'webhook',
    })
    .select('id')
    .single();

  // ============================================================
  // RACE CONDITION FIX: Handle unique constraint violation
  // If /verify route already created enrollment, gracefully handle
  // ============================================================
  if (enrollmentError) {
    // PostgreSQL unique violation = 23505
    if (enrollmentError.code === '23505') {
      console.log(JSON.stringify({
        requestId,
        event: 'enrollment_race_condition_handled',
        paymentId,
        message: 'Enrollment already created by /verify route',
      }));

      // Fetch the existing enrollment
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('payment_id', paymentId)
        .single();

      return {
        status: 'already_processed',
        enrollmentId: existingEnrollment?.id,
        message: 'Race condition handled - enrollment exists',
      };
    }

    // Other errors = actual failure
    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_create_error',
      error: enrollmentError.message,
      code: enrollmentError.code,
    }));
    return { status: 'error', message: 'Failed to create enrollment' };
  }

  console.log(JSON.stringify({
    requestId,
    event: 'enrollment_created_via_webhook',
    enrollmentId: enrollment.id,
  }));

  // 8. Update child status
  if (booking.child_id) {
    await supabase
      .from('children')
      .update({
        enrollment_status: 'enrolled',
        lead_status: 'enrolled',
        coach_id: finalCoachId,
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.child_id);
  }

  // 9. Queue background job
  try {
    const { data: coach } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', finalCoachId)
      .single();

    if (coach) {
      const queueResult = await queueEnrollmentComplete({
        enrollmentId: enrollment.id,
        childId: booking.child_id ?? '',
        childName: bookingData.child_name,
        parentId: booking.parent_id ?? '',
        parentEmail: bookingData.parent_email,
        parentName: bookingData.parent_name,
        parentPhone: bookingData.parent_phone,
        coachId: coach.id,
        coachEmail: coach.email,
        coachName: coach.name,
        source: 'webhook',
      });

      console.log(JSON.stringify({
        requestId,
        event: 'background_job_queued',
        messageId: queueResult.messageId,
      }));
    }
  } catch (queueError: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'queue_error',
      error: queueError.message,
    }));
  }

  // 10. Log webhook event
  await supabase.from('enrollment_events').insert({
    enrollment_id: enrollment.id,
    event_type: 'created_via_webhook',
    event_data: {
      payment_id: paymentId,
      order_id: orderId,
      amount,
      request_id: requestId,
    },
    triggered_by: 'razorpay_webhook',
  });

  return { status: 'success', enrollmentId: enrollment.id };
}

async function processPaymentFailed(
  payment: z.infer<typeof PaymentEntitySchema>,
  requestId: string
): Promise<ProcessingResult> {
  const { id: paymentId, order_id: orderId, amount: amountPaise, error_code, error_description } = payment;

  console.log(JSON.stringify({
    requestId,
    event: 'payment_failed',
    paymentId,
    orderId,
    errorCode: error_code,
    reason: error_description,
  }));

  // 1. Update booking status
  await supabase
    .from('bookings')
    .update({
      status: 'failed',
      failure_reason: error_description || 'Payment failed',
      updated_at: new Date().toISOString(),
    })
    .eq('razorpay_order_id', orderId);

  // 2. Find booking to get parent/child details
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, child_id, parent_id, amount, metadata')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();

  if (!booking) {
    console.log(JSON.stringify({ requestId, event: 'failed_payment_no_booking', orderId }));
    return { status: 'success', message: 'Failure recorded - no booking found' };
  }

  // Extract metadata for failed payment handling
  const failedMeta = (booking.metadata as Record<string, any>) || {};
  const bookingData = {
    child_name: failedMeta.child_name || 'Child',
    parent_name: failedMeta.parent_name || 'Parent',
    parent_email: failedMeta.parent_email || '',
    parent_phone: failedMeta.parent_phone || '',
  };

  // 3. Check for existing failed_payment record (increment attempt_count)
  const { data: existingFailed } = await supabase
    .from('failed_payments')
    .select('id, attempt_count')
    .eq('razorpay_order_id', orderId)
    .maybeSingle();

  if (existingFailed) {
    await supabase
      .from('failed_payments')
      .update({
        razorpay_payment_id: paymentId,
        error_code: error_code || null,
        error_description: error_description || null,
        attempt_count: (existingFailed.attempt_count ?? 0) + 1,
      })
      .eq('id', existingFailed.id);
  } else {
    // 4. Generate retry token
    const retryToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const productCode = (failedMeta.product_code as string) || 'full';

    const { data: tokenRecord } = await supabase
      .from('payment_retry_tokens')
      .insert({
        token: retryToken,
        booking_id: booking.id,
        parent_id: booking.parent_id,
        child_id: booking.child_id,
        razorpay_order_id: orderId,
        amount: booking.amount,
        product_code: productCode,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    // 5. Create failed_payment record
    await supabase.from('failed_payments').insert({
      booking_id: booking.id,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      parent_id: booking.parent_id,
      child_id: booking.child_id,
      amount: (amountPaise || 0) / 100,
      error_code: error_code || null,
      error_description: error_description || null,
      retry_token_id: tokenRecord?.id || null,
    });

    // 6. Queue parent notification with retry link via QStash
    try {
      const { qstash: qstashClient } = await import('@/lib/qstash');
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

      if (qstashClient) {
        await qstashClient.publishJSON({
          url: `${APP_URL}/api/jobs/send-communication`,
          body: {
            templateCode: 'payment_failed_retry',
            recipientType: 'parent',
            recipientId: booking.parent_id ?? '',
            recipientPhone: bookingData.parent_phone,
            recipientEmail: bookingData.parent_email,
            recipientName: bookingData.parent_name,
            variables: {
              parent_name: bookingData.parent_name || 'there',
              child_name: bookingData.child_name || 'your child',
              amount: String(booking.amount ?? 0),
              retry_link: `${APP_URL}/payment/retry?token=${retryToken}`,
              error_reason: error_description || 'Payment could not be processed',
            },
            relatedEntityType: 'booking',
            relatedEntityId: booking.id,
          },
          retries: 3,
        });

        // Mark as notified
        await supabase
          .from('failed_payments')
          .update({ notified: true, notified_at: new Date().toISOString() })
          .eq('razorpay_order_id', orderId);

        console.log(JSON.stringify({
          requestId,
          event: 'failed_payment_notification_queued',
          parentEmail: bookingData.parent_email,
          retryToken,
        }));
      }
    } catch (notifyErr: any) {
      console.error(JSON.stringify({
        requestId,
        event: 'failed_payment_notification_error',
        error: notifyErr.message,
      }));
    }
  }

  return { status: 'success', message: 'Failure recorded with retry token' };
}

// --- 4b. REFUND HANDLERS ---

async function processRefundProcessed(
  refund: z.infer<typeof RefundEntitySchema>,
  requestId: string
): Promise<ProcessingResult> {
  console.log(JSON.stringify({
    requestId,
    event: 'refund_processed',
    refundId: refund.id,
    paymentId: refund.payment_id,
    amount: refund.amount / 100,
  }));

  const { error } = await supabase
    .from('enrollment_terminations')
    .update({
      refund_status: 'completed',
      refund_completed_at: new Date().toISOString(),
    })
    .eq('razorpay_refund_id', refund.id);

  if (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'refund_status_update_failed',
      refundId: refund.id,
      error: error.message,
    }));
    return { status: 'error', message: 'Failed to update termination record' };
  }

  return { status: 'success', message: 'Refund completion recorded' };
}

async function processRefundFailed(
  refund: z.infer<typeof RefundEntitySchema>,
  requestId: string
): Promise<ProcessingResult> {
  console.error(JSON.stringify({
    requestId,
    event: 'refund_failed',
    refundId: refund.id,
    paymentId: refund.payment_id,
  }));

  const { error } = await supabase
    .from('enrollment_terminations')
    .update({
      refund_status: 'failed',
      refund_failure_reason: `Razorpay refund failed (${refund.status})`,
    })
    .eq('razorpay_refund_id', refund.id);

  if (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'refund_failure_update_failed',
      refundId: refund.id,
      error: error.message,
    }));
  }

  return { status: 'success', message: 'Refund failure recorded' };
}

// --- 5. MAIN HANDLER ---

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    console.log(JSON.stringify({
      requestId,
      event: 'webhook_received',
      hasSignature: !!signature,
    }));

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error(JSON.stringify({ requestId, event: 'invalid_signature' }));
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = WebhookPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.error(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors: validation.error.format(),
      }));
      return NextResponse.json({ status: 'validation_failed' });
    }

    const { event, payload: eventPayload } = validation.data;
    const isRefundEvent = event.startsWith('refund.');
    const refundEntity = eventPayload.refund?.entity;
    const payment = eventPayload.payment?.entity;

    // Determine entity ID for idempotency
    const entityId = isRefundEvent ? refundEntity?.id : payment?.id;
    if (!entityId) {
      return NextResponse.json({ status: 'validation_failed', message: 'No entity ID found' });
    }

    // Idempotency check
    const webhookId = `${entityId}_${event}`;
    const { isDuplicate } = await checkAndRecordWebhook(webhookId, event, requestId);

    if (isDuplicate) {
      return NextResponse.json({ status: 'already_processed', webhookId });
    }

    // Route to handler
    let result: ProcessingResult;

    switch (event) {
      case 'payment.captured':
        result = payment
          ? await processPaymentCaptured(payment, requestId)
          : { status: 'error', message: 'Missing payment entity' };
        break;
      case 'payment.failed':
        result = payment
          ? await processPaymentFailed(payment, requestId)
          : { status: 'error', message: 'Missing payment entity' };
        break;
      case 'payment.authorized':
        result = { status: 'success', message: 'Authorized - awaiting capture' };
        break;
      case 'order.paid':
        result = { status: 'skipped', message: 'Handled via payment.captured' };
        break;
      case 'refund.processed':
        result = refundEntity
          ? await processRefundProcessed(refundEntity, requestId)
          : { status: 'error', message: 'Missing refund entity' };
        break;
      case 'refund.failed':
        result = refundEntity
          ? await processRefundFailed(refundEntity, requestId)
          : { status: 'error', message: 'Missing refund entity' };
        break;
      default:
        result = { status: 'skipped', message: `Unhandled event: ${event}` };
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'webhook_complete',
      eventType: event,
      result: result.status,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      status: result.status,
      message: result.message,
      enrollmentId: result.enrollmentId,
      requestId,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'webhook_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      status: 'error',
      message: 'Processing error - logged for review',
      requestId,
    });
  }
}