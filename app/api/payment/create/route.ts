// ============================================================
// FILE: app/api/payment/create/route.ts
// ============================================================
// HARDENED VERSION - Production Ready
// Server-Side Pricing, Coupon Validation, Rate Limiting
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { Database } from '@/lib/supabase/database.types';
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';
import crypto from 'crypto';
import { loadPaymentConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// NOTE: Pricing comes ONLY from pricing_plans table
// No hardcoded fallbacks - if product not found, return error

// --- 1. VALIDATION SCHEMA ---
const CreateOrderSchema = z.object({
  // Product Selection
  productCode: z.enum(['starter', 'continuation', 'full']).default('full'),

  // Child Info
  childId: z.string().uuid().optional().nullable(),
  childName: z.string().min(1, 'Child name required').max(100),
  childAge: z.union([z.string(), z.number()])
    .transform((val) => {
      const num = parseInt(String(val));
      return isNaN(num) ? null : num;
    })
    .optional()
    .nullable(),

  // Parent Info
  parentId: z.string().uuid().optional().nullable(),
  parentName: z.string().min(1, 'Parent name required').max(100),
  parentEmail: z.string().email('Invalid email').transform((v) => v.toLowerCase().trim()),
  parentPhone: phoneSchemaOptional,

  // Coupon/Discount
  couponCode: z.string().max(20).optional().nullable(),

  // Referral Credit
  useReferralCredit: z.boolean().default(false),
  referralCreditAmount: z.number().min(0).max(10000).default(0),

  // Coach/Lead Source
  coachId: z.string().uuid().optional().nullable(),
  leadSource: z.enum(['yestoryd', 'coach']).default('yestoryd'),
  leadSourceCoachId: z.string().uuid().optional().nullable(),

  // Scheduling
  requestedStartDate: z.string().optional().nullable(),
});

// --- 2. TYPES ---
interface CouponValidationResult {
  valid: boolean;
  discountAmount: number;
  discountPercent: number;
  couponId?: string;
  couponType?: string;
  error?: string;
}

interface PricingResult {
  basePrice: number;
  couponDiscount: number;
  referralCreditUsed: number;
  finalAmount: number;
  couponCode?: string;
  couponId?: string;
  productId?: string;
  productCode?: string;
  sessionsTotal?: number;
}

interface ProductInfo {
  id: string;
  slug: string;
  name: string;
  discounted_price: number;
  sessions_included: number;
  sessions_coaching: number;
  sessions_skill_building: number;
  sessions_checkin: number;
  duration_months: number;
}

// --- 3. HELPER FUNCTIONS ---

/**
 * Get Product by slug from pricing_plans (Server-Controlled)
 */
async function getProductBySlug(
  productCode: string,
  requestId: string
): Promise<ProductInfo | { locked: true; message: string } | null> {
  const { data: product, error } = await supabase
    .from('pricing_plans')
    .select('id, slug, name, discounted_price, sessions_included, sessions_coaching, sessions_skill_building, sessions_checkin, duration_months, is_locked, lock_message')
    .eq('slug', productCode)
    .eq('is_active', true)
    .single();

  if (error || !product) {
    console.error(JSON.stringify({
      requestId,
      event: 'product_not_found',
      productCode,
      error: error?.message,
    }));
    return null;
  }

  // Check if product is locked (coming soon)
  if (product.is_locked) {
    console.log(JSON.stringify({
      requestId,
      event: 'product_locked',
      productCode,
      lockMessage: product.lock_message,
    }));
    return { locked: true, message: product.lock_message || 'This product is not available yet' };
  }

  console.log(JSON.stringify({
    requestId,
    event: 'product_fetched',
    productCode,
    productId: product.id,
    price: product.discounted_price,
    sessions: product.sessions_included,
  }));

  return product as ProductInfo;
}

/**
 * Check if child has completed starter enrollment
 */
async function checkStarterCompleted(
  childId: string,
  requestId: string
): Promise<{ completed: boolean; starterEnrollmentId: string | null }> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status, enrollment_type, starter_completed_at')
    .eq('child_id', childId)
    .eq('enrollment_type', 'starter')
    .in('status', ['completed', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!enrollment) {
    console.log(JSON.stringify({ requestId, event: 'no_starter_found', childId }));
    return { completed: false, starterEnrollmentId: null };
  }

  const isCompleted = enrollment.status === 'completed' || enrollment.starter_completed_at !== null;

  console.log(JSON.stringify({
    requestId,
    event: 'starter_check',
    childId,
    completed: isCompleted,
    enrollmentId: enrollment.id,
  }));

  return { completed: isCompleted, starterEnrollmentId: enrollment.id };
}

// REMOVED: getProgramPrice() - was deprecated, pricing comes from pricing_plans table only

/**
 * Validate Coupon and Calculate Discount (Server-Side)
 */
async function validateCoupon(
  couponCode: string,
  basePrice: number,
  parentEmail: string,
  productCode: string,
  requestId: string
): Promise<CouponValidationResult> {
  try {
    // 1. Find coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select(`
        id, code, coupon_type, discount_type, discount_value,
        min_order_value, max_discount, max_uses, current_uses,
        valid_from, valid_until, is_active, applicable_to, per_user_limit
      `)
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Invalid coupon code' };
    }

    // 1b. Check if coupon applies to this product
    const applicableTo = coupon.applicable_to || [];
    if (applicableTo.length > 0 && !applicableTo.includes(productCode)) {
      console.log(JSON.stringify({
        requestId,
        event: 'coupon_not_applicable',
        code: couponCode,
        productCode,
        applicableTo,
      }));
      return { valid: false, discountAmount: 0, discountPercent: 0, error: `Coupon not valid for ${productCode} product` };
    }

    // 2. Check validity period
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon not yet active' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon expired' };
    }

    // 3. Check usage limits
    if (coupon.max_uses && (coupon.current_uses ?? 0) >= coupon.max_uses) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon usage limit reached' };
    }

    // 4. Check per-user limit
    if (coupon.per_user_limit) {
      const { count: userUses } = await supabase
        .from('coupon_uses')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_email', parentEmail);

      if (userUses && userUses >= coupon.per_user_limit) {
        return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon usage limit reached for this user' };
      }
    }

    // 5. Check minimum order amount
    if (coupon.min_order_value && basePrice < coupon.min_order_value) {
      return { 
        valid: false, 
        discountAmount: 0, 
        discountPercent: 0, 
        error: `Minimum order ₹${coupon.min_order_value} required` 
      };
    }

    // 6. Calculate discount
    let discountAmount = 0;
    let discountPercent = 0;

    // Debug: Log coupon details
    console.log(JSON.stringify({
      requestId,
      event: 'coupon_details',
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      applicable_to: coupon.applicable_to,
      productCode,
      basePrice,
    }));

    // Handle different discount types
    if (coupon.discount_type === 'percentage' || coupon.discount_type === 'percent') {
      discountPercent = coupon.discount_value || 0;
      discountAmount = Math.round((basePrice * discountPercent) / 100);
    } else if (coupon.discount_type === 'fixed' || coupon.discount_type === 'fixed_discount' || coupon.discount_type === 'amount') {
      // Fixed amount discount (in rupees)
      discountAmount = coupon.discount_value || 0;
      discountPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;
    } else {
      // Default: treat as fixed amount for backwards compatibility
      discountAmount = coupon.discount_value || 0;
      discountPercent = basePrice > 0 ? Math.round((discountAmount / basePrice) * 100) : 0;
    }

    // 7. Apply max discount cap
    if (coupon.max_discount && discountAmount > coupon.max_discount) {
      discountAmount = coupon.max_discount;
    }

    // 8. Ensure discount doesn't exceed price
    if (discountAmount > basePrice) {
      discountAmount = basePrice;
    }

    console.log(JSON.stringify({
      requestId,
      event: 'coupon_validated',
      code: couponCode,
      discountAmount,
      discountPercent,
    }));

    return {
      valid: true,
      discountAmount,
      discountPercent,
      couponId: coupon.id,
      couponType: coupon.coupon_type,
    };

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'coupon_validation_error',
      error: error.message,
    }));
    return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon validation failed' };
  }
}

/**
 * Validate Referral Credit Balance
 */
async function validateReferralCredit(
  parentEmail: string,
  requestedAmount: number,
  requestId: string
): Promise<{ valid: boolean; availableCredit: number; usableAmount: number }> {
  const { data: parent } = await supabase
    .from('parents')
    .select('id, referral_credit_balance, referral_credit_expires_at')
    .eq('email', parentEmail)
    .single();

  if (!parent || !parent.referral_credit_balance) {
    return { valid: false, availableCredit: 0, usableAmount: 0 };
  }

  // Check expiry
  if (parent.referral_credit_expires_at) {
    const expiry = new Date(parent.referral_credit_expires_at);
    if (expiry < new Date()) {
      console.log(JSON.stringify({ requestId, event: 'referral_credit_expired' }));
      return { valid: false, availableCredit: 0, usableAmount: 0 };
    }
  }

  const availableCredit = parent.referral_credit_balance;
  const usableAmount = Math.min(requestedAmount, availableCredit);

  console.log(JSON.stringify({
    requestId,
    event: 'referral_credit_validated',
    available: availableCredit,
    usable: usableAmount,
  }));

  return { valid: true, availableCredit, usableAmount };
}

/**
 * Get or Create Parent (Race-Safe with UPSERT)
 */
async function getOrCreateParent(
  email: string,
  name: string,
  phone: string | null | undefined,
  requestId: string
): Promise<string> {
  const { data: parent, error } = await supabase
    .from('parents')
    .upsert(
      {
        email,
        name,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
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

/**
 * Get or Create Child (Race-Safe)
 */
async function getOrCreateChild(
  childId: string | null | undefined,
  childName: string,
  childAge: number | null | undefined,
  parentId: string,
  parentEmail: string,
  requestId: string
): Promise<string> {
  // If childId provided, verify it exists
  if (childId) {
    const { data: existing } = await supabase
      .from('children')
      .select('id')
      .eq('id', childId)
      .single();

    if (existing) {
      // Update parent link if needed
      await supabase
        .from('children')
        .update({ parent_id: parentId, parent_email: parentEmail })
        .eq('id', childId);
      return existing.id;
    }
  }

  // Check if child exists for this parent with same name
  const { data: existingChild } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', parentId)
    .eq('child_name', childName) // Correct column name!
    .maybeSingle();

  if (existingChild) {
    return existingChild.id;
  }

  // Create new child
  const { data: newChild, error } = await supabase
    .from('children')
    .insert({
      child_name: childName, // Correct column name!
      age: childAge,
      parent_id: parentId,
      parent_email: parentEmail,
      lead_status: 'payment_initiated',
    })
    .select('id')
    .single();

  if (error || !newChild) {
    console.error(JSON.stringify({ requestId, event: 'child_create_error', error: error?.message }));
    throw new Error('Failed to create child record');
  }

  return newChild.id;
}

/**
 * Simple In-Memory Rate Limiting (for basic protection)
 * For production, use Upstash Rate Limit or similar
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(email: string, maxRequests: number, windowSeconds: number): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);
  const windowMs = windowSeconds * 1000;

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

// --- 4. MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Parse JSON Safely
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 2. Validate Input
    const validation = CreateOrderSchema.safeParse(rawBody);
    if (!validation.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors: validation.error.format(),
      }));
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Load payment config from database
    const paymentConfig = await loadPaymentConfig();

    console.log(JSON.stringify({
      requestId,
      event: 'create_order_start',
      childName: body.childName,
      parentEmail: body.parentEmail,
      productCode: body.productCode,
      couponCode: body.couponCode || 'none',
    }));

    // 3. Rate Limiting
    if (!checkRateLimit(body.parentEmail, paymentConfig.rateLimitRequests, paymentConfig.rateLimitWindowSeconds)) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        email: body.parentEmail,
      }));
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // 4. Get Product from Database (Server-Controlled)
    const productResult = await getProductBySlug(body.productCode, requestId);

    if (!productResult) {
      return NextResponse.json(
        { success: false, error: 'Invalid product selected', code: 'INVALID_PRODUCT' },
        { status: 400 }
      );
    }

    // Check if product is locked
    if ('locked' in productResult && productResult.locked) {
      return NextResponse.json(
        { success: false, error: productResult.message, code: 'PRODUCT_LOCKED' },
        { status: 400 }
      );
    }

    const product = productResult as ProductInfo;
    const basePrice = product.discounted_price;

    // 4a. Validate Continuation Eligibility
    if (body.productCode === 'continuation') {
      if (!body.childId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Child ID required for continuation enrollment',
            code: 'CHILD_ID_REQUIRED',
          },
          { status: 400 }
        );
      }

      const starterCheck = await checkStarterCompleted(body.childId, requestId);

      if (!starterCheck.completed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Starter program must be completed before enrolling in continuation',
            code: 'STARTER_NOT_COMPLETED',
          },
          { status: 400 }
        );
      }
    }

    // 5. Calculate Pricing with Discounts
    let pricing: PricingResult = {
      basePrice,
      couponDiscount: 0,
      referralCreditUsed: 0,
      finalAmount: basePrice,
      productId: product.id,
      productCode: body.productCode,
      sessionsTotal: product.sessions_included,
    };

    // 5a. Apply Coupon Discount (only if user manually provides a coupon code)
    // Note: Full program discount (₹500 off) is already reflected in discounted_price
    const couponToApply = body.couponCode;
    if (couponToApply) {
      const couponResult = await validateCoupon(
        couponToApply,
        basePrice,
        body.parentEmail,
        body.productCode,
        requestId
      );

      if (couponResult.valid) {
        pricing.couponDiscount = couponResult.discountAmount;
        pricing.couponCode = couponToApply;
        pricing.couponId = couponResult.couponId;
      } else if (body.couponCode) {
        // Only return error if user explicitly provided a coupon
        return NextResponse.json(
          {
            success: false,
            error: couponResult.error || 'Invalid coupon',
            code: 'INVALID_COUPON',
          },
          { status: 400 }
        );
      }
      // If auto-applied coupon fails, silently continue without discount
    }

    // 5c. Apply Referral Credit
    if (body.useReferralCredit && body.referralCreditAmount > 0) {
      const creditResult = await validateReferralCredit(
        body.parentEmail,
        body.referralCreditAmount,
        requestId
      );

      if (creditResult.valid) {
        pricing.referralCreditUsed = creditResult.usableAmount;
      }
    }

    // 5d. Calculate Final Amount
    pricing.finalAmount = basePrice - pricing.couponDiscount - pricing.referralCreditUsed;

    // Ensure minimum amount (Razorpay requires at least ₹1)
    if (pricing.finalAmount < 1) {
      pricing.finalAmount = 1;
    }

    console.log(JSON.stringify({
      requestId,
      event: 'pricing_calculated',
      productCode: body.productCode,
      productId: product.id,
      basePriceRupees: basePrice,
      couponCode: pricing.couponCode || 'none',
      couponDiscountRupees: pricing.couponDiscount,
      referralCreditRupees: pricing.referralCreditUsed,
      finalAmountRupees: pricing.finalAmount,
      finalAmountPaise: pricing.finalAmount * 100,
      sessionsTotal: product.sessions_included,
    }));

    // 6. Get or Create Parent (Race-Safe)
    const parentId = await getOrCreateParent(
      body.parentEmail,
      body.parentName,
      body.parentPhone,
      requestId
    );

    // 7. Get or Create Child (Race-Safe)
    const childId = await getOrCreateChild(
      body.childId,
      body.childName,
      body.childAge,
      parentId,
      body.parentEmail,
      requestId
    );

    // 8. Create Razorpay Order (with SERVER-CONTROLLED amount!)
    const receiptId = `${paymentConfig.receiptPrefix}${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const order = await razorpay.orders.create({
      amount: pricing.finalAmount * 100, // Convert to paise
      currency: paymentConfig.currency,
      receipt: receiptId,
      notes: {
        requestId,
        childId,
        childName: body.childName,
        parentId,
        parentEmail: body.parentEmail,
        // Product info
        productCode: body.productCode,
        productId: product.id,
        sessionsTotal: String(product.sessions_included),
        // Pricing info
        basePrice: String(basePrice),
        couponCode: pricing.couponCode || '',
        couponDiscount: String(pricing.couponDiscount),
        referralCreditUsed: String(pricing.referralCreditUsed),
        // Lead source
        leadSource: body.leadSource,
        coachId: body.coachId || '',
      },
    });

    console.log(JSON.stringify({
      requestId,
      event: 'razorpay_order_created',
      orderId: order.id,
      amountRupees: pricing.finalAmount,
      amountPaise: pricing.finalAmount * 100,
    }));

    // 9. Save Booking Record (for webhook to find)
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
            child_name: body.childName,
            parent_email: body.parentEmail,
            parent_name: body.parentName,
            parent_phone: body.parentPhone,
            // Product info
            product_code: body.productCode,
            product_id: product.id,
            sessions_total: product.sessions_included,
            // Pricing info
            original_amount: basePrice,
            coupon_code: pricing.couponCode,
            coupon_discount: pricing.couponDiscount,
            referral_credit_used: pricing.referralCreditUsed,
            // Lead source
            lead_source: body.leadSource,
            lead_source_coach_id: body.leadSourceCoachId,
            requested_start_date: body.requestedStartDate,
            receipt_id: receiptId,
            request_id: requestId,
          },
      })
      .select('id')
      .single();

    if (bookingError) {
      console.error(JSON.stringify({
        requestId,
        event: 'booking_save_error',
        error: bookingError.message,
      }));
      // Don't fail - order was created
    }

    // 10. Update Child Status
    await supabase
      .from('children')
      .update({
        lead_status: 'payment_initiated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', childId);

    // 11. Record Coupon Use (if applicable)
    if (pricing.couponId) {
      await supabase.from('coupon_uses').insert({
        coupon_id: pricing.couponId,
        user_email: body.parentEmail,
        order_id: order.id,
        discount_amount: pricing.couponDiscount,
      });
    }

    // 12. Final Response
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'create_order_complete',
      orderId: order.id,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: pricing.finalAmount,
      currency: order.currency,
      // Product info
      product: {
        code: body.productCode,
        id: product.id,
        name: product.name,
        sessionsIncluded: product.sessions_included,
        durationMonths: product.duration_months,
      },
      // Pricing breakdown (for UI display)
      pricing: {
        basePrice,
        couponDiscount: pricing.couponDiscount,
        referralCreditUsed: pricing.referralCreditUsed,
        finalAmount: pricing.finalAmount,
        couponCode: pricing.couponCode,
      },
      // IDs for verify route
      bookingId: booking?.id,
      childId,
      parentId,
      // Razorpay key for frontend (safe to expose)
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'create_order_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    // Handle Razorpay-specific errors
    if (error.statusCode === 401) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway configuration error' },
        { status: 500 }
      );
    }

    if (error.error?.description) {
      return NextResponse.json(
        { success: false, error: error.error.description },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}

// --- 5. OPTIONAL: GET handler for testing ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Payment create endpoint. Use POST to create orders.',
  });
}





