// ============================================================
// FILE: app/api/payment/create/route.ts
// PURPOSE: Thin orchestrator — create Razorpay order with server-side pricing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';
import crypto from 'crypto';
import { loadPaymentConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';

import {
  getProductBySlug,
  checkStarterCompleted,
  validateCoupon,
  validateReferralCredit,
  checkRateLimit,
  type ProductInfo,
  type PricingResult,
} from '@/lib/payment/order-builder';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// --- VALIDATION SCHEMA ---
const CreateOrderSchema = z.object({
  productCode: z.enum(['starter', 'continuation', 'full']).default('full'),
  childId: z.string().uuid().optional().nullable(),
  childName: z.string().min(1, 'Child name required').max(100),
  childAge: z.union([z.string(), z.number()])
    .transform((val) => {
      const num = parseInt(String(val));
      return isNaN(num) ? null : num;
    })
    .optional()
    .nullable(),
  parentId: z.string().uuid().optional().nullable(),
  parentName: z.string().min(1, 'Parent name required').max(100),
  parentEmail: z.string().email('Invalid email').transform((v) => v.toLowerCase().trim()),
  parentPhone: phoneSchemaOptional,
  couponCode: z.string().max(20).optional().nullable(),
  useReferralCredit: z.boolean().default(false),
  referralCreditAmount: z.number().min(0).max(10000).default(0),
  coachId: z.string().uuid().optional().nullable(),
  leadSource: z.enum(['yestoryd', 'coach']).default('yestoryd'),
  leadSourceCoachId: z.string().uuid().optional().nullable(),
  requestedStartDate: z.string().optional().nullable(),
});

// --- PARENT/CHILD HELPERS (create-specific, simpler than verify route) ---

async function getOrCreateParent(
  email: string,
  name: string,
  phone: string | null | undefined,
  requestId: string
): Promise<string> {
  const { data: parent, error } = await supabase
    .from('parents')
    .upsert(
      { email, name, phone: phone || null, updated_at: new Date().toISOString() },
      { onConflict: 'email' }
    )
    .select('id')
    .single();

  if (error || !parent) {
    console.error(JSON.stringify({ requestId, event: 'parent_upsert_error', error: error?.message }));
    throw new Error('Failed to create parent record');
  }
  return parent.id;
}

async function getOrCreateChild(
  childId: string | null | undefined,
  childName: string,
  childAge: number | null | undefined,
  parentId: string,
  parentEmail: string,
  requestId: string
): Promise<string> {
  if (childId) {
    const { data: existing } = await supabase.from('children').select('id').eq('id', childId).single();
    if (existing) {
      await supabase.from('children').update({ parent_id: parentId, parent_email: parentEmail }).eq('id', childId);
      return existing.id;
    }
  }

  const { data: existingChild } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_name', childName)
    .maybeSingle();

  if (existingChild) return existingChild.id;

  const { data: newChild, error } = await supabase
    .from('children')
    .insert({ child_name: childName, age: childAge, parent_id: parentId, parent_email: parentEmail, lead_status: 'payment_initiated' })
    .select('id')
    .single();

  if (error || !newChild) {
    console.error(JSON.stringify({ requestId, event: 'child_create_error', error: error?.message }));
    throw new Error('Failed to create child record');
  }
  return newChild.id;
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = CreateOrderSchema.safeParse(rawBody);
    if (!validation.success) {
      console.log(JSON.stringify({ requestId, event: 'validation_failed', errors: validation.error.format() }));
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }
    const body = validation.data;

    const paymentConfig = await loadPaymentConfig();

    console.log(JSON.stringify({ requestId, event: 'create_order_start', childName: body.childName, parentEmail: body.parentEmail, productCode: body.productCode }));

    // Rate limit
    if (!checkRateLimit(body.parentEmail, paymentConfig.rateLimitRequests, paymentConfig.rateLimitWindowSeconds)) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Get product
    const productResult = await getProductBySlug(body.productCode, requestId);
    if (!productResult) {
      return NextResponse.json({ success: false, error: 'Invalid product selected', code: 'INVALID_PRODUCT' }, { status: 400 });
    }
    if ('locked' in productResult && productResult.locked) {
      return NextResponse.json({ success: false, error: productResult.message, code: 'PRODUCT_LOCKED' }, { status: 400 });
    }

    const product = productResult as ProductInfo;
    const basePrice = product.discounted_price;

    // Validate continuation eligibility
    if (body.productCode === 'continuation') {
      if (!body.childId) {
        return NextResponse.json({ success: false, error: 'Child ID required for continuation enrollment', code: 'CHILD_ID_REQUIRED' }, { status: 400 });
      }
      const starterCheck = await checkStarterCompleted(body.childId, requestId);
      if (!starterCheck.completed) {
        return NextResponse.json({ success: false, error: 'Starter program must be completed before enrolling in continuation', code: 'STARTER_NOT_COMPLETED' }, { status: 400 });
      }
    }

    // Calculate pricing
    let pricing: PricingResult = {
      basePrice,
      couponDiscount: 0,
      referralCreditUsed: 0,
      finalAmount: basePrice,
      productId: product.id,
      productCode: body.productCode,
      sessionsTotal: product.sessions_included,
    };

    // Apply coupon
    if (body.couponCode) {
      const couponResult = await validateCoupon(body.couponCode, basePrice, body.parentEmail, body.productCode, requestId);
      if (couponResult.valid) {
        pricing.couponDiscount = couponResult.discountAmount;
        pricing.couponCode = body.couponCode;
        pricing.couponId = couponResult.couponId;
      } else {
        return NextResponse.json({ success: false, error: couponResult.error || 'Invalid coupon', code: 'INVALID_COUPON' }, { status: 400 });
      }
    }

    // Apply referral credit
    if (body.useReferralCredit && body.referralCreditAmount > 0) {
      const creditResult = await validateReferralCredit(body.parentEmail, body.referralCreditAmount, requestId);
      if (creditResult.valid) {
        pricing.referralCreditUsed = creditResult.usableAmount;
      }
    }

    pricing.finalAmount = Math.max(1, basePrice - pricing.couponDiscount - pricing.referralCreditUsed);

    console.log(JSON.stringify({ requestId, event: 'pricing_calculated', basePriceRupees: basePrice, couponDiscountRupees: pricing.couponDiscount, referralCreditRupees: pricing.referralCreditUsed, finalAmountRupees: pricing.finalAmount }));

    // Parent + Child
    const parentId = await getOrCreateParent(body.parentEmail, body.parentName, body.parentPhone, requestId);
    const childId = await getOrCreateChild(body.childId, body.childName, body.childAge, parentId, body.parentEmail, requestId);

    // Create Razorpay Order
    const receiptId = `${paymentConfig.receiptPrefix}${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const order = await razorpay.orders.create({
      amount: pricing.finalAmount * 100,
      currency: paymentConfig.currency,
      receipt: receiptId,
      notes: {
        requestId, childId, childName: body.childName, parentId, parentEmail: body.parentEmail,
        productCode: body.productCode, productId: product.id, sessionsTotal: String(product.sessions_included),
        basePrice: String(basePrice), couponCode: pricing.couponCode || '', couponDiscount: String(pricing.couponDiscount),
        referralCreditUsed: String(pricing.referralCreditUsed), leadSource: body.leadSource, coachId: body.coachId || '',
      },
    });

    // Save booking record
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        razorpay_order_id: order.id,
        child_id: childId,
        parent_id: parentId,
        amount: pricing.finalAmount,
        coach_id: body.coachId,
        status: 'confirmed',
        metadata: {
          child_name: body.childName, parent_email: body.parentEmail, parent_name: body.parentName, parent_phone: body.parentPhone,
          product_code: body.productCode, product_id: product.id, sessions_total: product.sessions_included,
          original_amount: basePrice, coupon_code: pricing.couponCode, coupon_discount: pricing.couponDiscount,
          referral_credit_used: pricing.referralCreditUsed, lead_source: body.leadSource, lead_source_coach_id: body.leadSourceCoachId,
          requested_start_date: body.requestedStartDate, receipt_id: receiptId, request_id: requestId,
        },
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error(JSON.stringify({ requestId, event: 'booking_save_error', error: bookingError.message }));
    }

    // Update child status
    await supabase.from('children').update({ lead_status: 'payment_initiated', updated_at: new Date().toISOString() }).eq('id', childId);

    // Record coupon usage
    if (pricing.couponId) {
      await supabase.from('coupon_usages').insert({
        coupon_id: pricing.couponId, parent_id: parentId, coupon_discount: pricing.couponDiscount,
        original_amount: basePrice, final_amount: pricing.finalAmount, total_discount: pricing.couponDiscount + pricing.referralCreditUsed,
        product_type: body.productCode,
      });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'create_order_complete', orderId: order.id, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: pricing.finalAmount,
      currency: order.currency,
      product: { code: body.productCode, id: product.id, name: product.name, sessionsIncluded: product.sessions_included, durationMonths: product.duration_months },
      pricing: { basePrice, couponDiscount: pricing.couponDiscount, referralCreditUsed: pricing.referralCreditUsed, finalAmount: pricing.finalAmount, couponCode: pricing.couponCode },
      bookingId: booking?.id,
      childId,
      parentId,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({ requestId, event: 'create_order_error', error: error.message, duration: `${duration}ms` }));

    if (error.statusCode === 401) {
      return NextResponse.json({ success: false, error: 'Payment gateway configuration error' }, { status: 500 });
    }
    if (error.error?.description) {
      return NextResponse.json({ success: false, error: error.error.description }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Failed to create order' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Payment create endpoint. Use POST to create orders.' });
}
