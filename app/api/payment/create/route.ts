// ============================================================
// FILE: app/api/payment/create/route.ts
// ============================================================
// HARDENED VERSION - Production Ready
// Server-Side Pricing, Coupon Validation, Rate Limiting
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default price if not in settings (fallback)
const DEFAULT_PROGRAM_PRICE = 5999;

// --- 1. VALIDATION SCHEMA ---
const CreateOrderSchema = z.object({
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
  parentPhone: z.string()
    .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')
    .optional()
    .nullable(),
  
  // Coupon/Discount
  couponCode: z.string().max(20).optional().nullable(),
  
  // Referral Credit
  useReferralCredit: z.boolean().default(false),
  referralCreditAmount: z.number().min(0).max(5999).default(0),
  
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
}

// --- 3. HELPER FUNCTIONS ---

/**
 * Get Program Price from Database (Server-Controlled)
 */
async function getProgramPrice(requestId: string): Promise<number> {
  const { data: priceSetting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'program_price')
    .single();

  if (priceSetting?.value) {
    const price = parseInt(String(priceSetting.value).replace(/[^0-9]/g, ''));
    if (price > 0) {
      console.log(JSON.stringify({ requestId, event: 'price_fetched', price }));
      return price;
    }
  }

  console.log(JSON.stringify({ 
    requestId, 
    event: 'price_fallback', 
    price: DEFAULT_PROGRAM_PRICE 
  }));
  return DEFAULT_PROGRAM_PRICE;
}

/**
 * Validate Coupon and Calculate Discount (Server-Side)
 */
async function validateCoupon(
  couponCode: string,
  basePrice: number,
  parentEmail: string,
  requestId: string
): Promise<CouponValidationResult> {
  try {
    // 1. Find coupon
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select(`
        id, code, coupon_type, discount_type, discount_value,
        min_order_amount, max_discount_amount, max_uses, current_uses,
        valid_from, valid_until, is_active, one_time_per_user
      `)
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Invalid coupon code' };
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
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon usage limit reached' };
    }

    // 4. Check one-time-per-user
    if (coupon.one_time_per_user) {
      const { data: existingUse } = await supabase
        .from('coupon_uses')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_email', parentEmail)
        .maybeSingle();

      if (existingUse) {
        return { valid: false, discountAmount: 0, discountPercent: 0, error: 'Coupon already used' };
      }
    }

    // 5. Check minimum order amount
    if (coupon.min_order_amount && basePrice < coupon.min_order_amount) {
      return { 
        valid: false, 
        discountAmount: 0, 
        discountPercent: 0, 
        error: `Minimum order ₹${coupon.min_order_amount} required` 
      };
    }

    // 6. Calculate discount
    let discountAmount = 0;
    let discountPercent = 0;

    if (coupon.discount_type === 'percent') {
      discountPercent = coupon.discount_value || 0;
      discountAmount = Math.round((basePrice * discountPercent) / 100);
    } else {
      // Fixed amount
      discountAmount = coupon.discount_value || 0;
      discountPercent = Math.round((discountAmount / basePrice) * 100);
    }

    // 7. Apply max discount cap
    if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
      discountAmount = coupon.max_discount_amount;
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
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 orders per minute per email

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
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

    console.log(JSON.stringify({
      requestId,
      event: 'create_order_start',
      childName: body.childName,
      parentEmail: body.parentEmail,
      couponCode: body.couponCode || 'none',
    }));

    // 3. Rate Limiting
    if (!checkRateLimit(body.parentEmail)) {
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

    // 4. Get Server-Side Price (NEVER trust client!)
    const basePrice = await getProgramPrice(requestId);

    // 5. Calculate Pricing with Discounts
    let pricing: PricingResult = {
      basePrice,
      couponDiscount: 0,
      referralCreditUsed: 0,
      finalAmount: basePrice,
    };

    // 5a. Apply Coupon Discount
    if (body.couponCode) {
      const couponResult = await validateCoupon(
        body.couponCode,
        basePrice,
        body.parentEmail,
        requestId
      );

      if (couponResult.valid) {
        pricing.couponDiscount = couponResult.discountAmount;
        pricing.couponCode = body.couponCode;
        pricing.couponId = couponResult.couponId;
      } else {
        // Return error for invalid coupon (don't silently ignore)
        return NextResponse.json(
          { 
            success: false, 
            error: couponResult.error || 'Invalid coupon',
            code: 'INVALID_COUPON'
          },
          { status: 400 }
        );
      }
    }

    // 5b. Apply Referral Credit
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

    // 5c. Calculate Final Amount
    pricing.finalAmount = basePrice - pricing.couponDiscount - pricing.referralCreditUsed;
    
    // Ensure minimum amount (Razorpay requires at least ₹1)
    if (pricing.finalAmount < 1) {
      pricing.finalAmount = 1;
    }

    console.log(JSON.stringify({
      requestId,
      event: 'pricing_calculated',
      basePrice,
      couponDiscount: pricing.couponDiscount,
      referralCredit: pricing.referralCreditUsed,
      finalAmount: pricing.finalAmount,
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
    const receiptId = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const order = await razorpay.orders.create({
      amount: pricing.finalAmount * 100, // Convert to paise
      currency: 'INR',
      receipt: receiptId,
      notes: {
        requestId,
        childId,
        childName: body.childName,
        parentId,
        parentEmail: body.parentEmail,
        couponCode: pricing.couponCode || '',
        couponDiscount: String(pricing.couponDiscount),
        referralCreditUsed: String(pricing.referralCreditUsed),
        basePrice: String(basePrice),
        leadSource: body.leadSource,
        coachId: body.coachId || '',
      },
    });

    console.log(JSON.stringify({
      requestId,
      event: 'razorpay_order_created',
      orderId: order.id,
      amount: pricing.finalAmount,
    }));

    // 9. Save Booking Record (for webhook to find)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        razorpay_order_id: order.id,
        child_id: childId,
        child_name: body.childName,
        parent_id: parentId,
        parent_email: body.parentEmail,
        parent_name: body.parentName,
        parent_phone: body.parentPhone,
        amount: pricing.finalAmount,
        original_amount: basePrice,
        coupon_code: pricing.couponCode,
        coupon_discount: pricing.couponDiscount,
        referral_credit_used: pricing.referralCreditUsed,
        coach_id: body.coachId,
        lead_source: body.leadSource,
        lead_source_coach_id: body.leadSourceCoachId,
        requested_start_date: body.requestedStartDate,
        status: 'pending',
        receipt_id: receiptId,
        request_id: requestId,
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