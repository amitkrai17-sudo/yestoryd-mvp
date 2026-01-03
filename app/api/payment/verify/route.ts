// ============================================================
// FILE: app/api/payment/verify/route.ts
// ============================================================
// Payment verification with REVENUE SPLIT + DELAYED START + REFERRAL CREDIT support
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { queueEnrollmentComplete } from '@/lib/qstash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// TYPES
// ============================================
interface CoachGroup {
  id: string;
  name: string;
  display_name: string;
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
  is_internal: boolean;
}

interface RevenueResult {
  success: boolean;
  enrollment_revenue_id?: string;
  lead_cost?: number;
  coach_cost?: number;
  platform_fee?: number;
  tds_amount?: number;
  net_to_coach?: number;
  payouts_scheduled?: number;
  error?: string;
}

interface CreditAwardResult {
  success: boolean;
  creditAwarded?: number;
  referrerParentId?: string;
  error?: string;
}

// ============================================
// REFERRAL CREDIT AWARD FUNCTION
// ============================================
async function awardReferralCredit(
  couponCode: string,
  enrollmentId: string,
  referredParentId: string,
  programAmount: number
): Promise<CreditAwardResult> {
  try {
    if (!couponCode) {
      return { success: false, error: 'No coupon code provided' };
    }

    // 1. Find the coupon and check if it's a parent referral
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('id, code, coupon_type, parent_id')
      .eq('code', couponCode.toUpperCase())
      .eq('coupon_type', 'parent_referral')
      .single();

    if (couponError || !coupon) {
      console.log('ℹ️ Not a parent referral coupon, skipping credit award');
      return { success: false, error: 'Not a parent referral coupon' };
    }

    if (!coupon.parent_id) {
      console.log('⚠️ Parent referral coupon has no parent_id');
      return { success: false, error: 'Coupon has no linked parent' };
    }

    // 2. Get referral credit percentage from settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['parent_referral_credit_percent', 'referral_credit_percent', 'referral_credit_expiry_days']);

    let creditPercent = 10; // Default 10%
    let expiryDays = 30; // Default 30 days

    settings?.forEach((s) => {
      const val = String(s.value).replace(/"/g, '');
      if (s.key === 'parent_referral_credit_percent' || s.key === 'referral_credit_percent') {
        creditPercent = parseInt(val) || 10;
      }
      if (s.key === 'referral_credit_expiry_days') {
        expiryDays = parseInt(val) || 30;
      }
    });

    // 3. Calculate credit amount
    const creditAmount = Math.round((programAmount * creditPercent) / 100);

    // 4. Get current balance of referrer
    const { data: referrer, error: referrerError } = await supabase
      .from('parents')
      .select('id, name, referral_credit_balance, referral_credit_expires_at')
      .eq('id', coupon.parent_id)
      .single();

    if (referrerError || !referrer) {
      console.error('❌ Referrer parent not found:', couponError);
      return { success: false, error: 'Referrer parent not found' };
    }

    // 5. Calculate new balance and expiry
    const currentBalance = referrer.referral_credit_balance || 0;
    const newBalance = currentBalance + creditAmount;

    // Extend expiry from today (each new referral extends the window)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    // 6. Update referrer's credit balance
    const { error: updateError } = await supabase
      .from('parents')
      .update({
        referral_credit_balance: newBalance,
        referral_credit_expires_at: expiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', referrer.id);

    if (updateError) {
      console.error('❌ Failed to update referrer balance:', updateError);
      return { success: false, error: 'Failed to update credit balance' };
    }

    // 7. Create transaction record
    const { error: transactionError } = await supabase
      .from('referral_credit_transactions')
      .insert({
        parent_id: referrer.id,
        type: 'earned',
        amount: creditAmount,
        balance_after: newBalance,
        description: `Referral credit for enrollment`,
        enrollment_id: enrollmentId,
        coupon_code: couponCode,
        referred_parent_id: referredParentId,
        expires_at: expiryDate.toISOString(),
      });

    if (transactionError) {
      console.error('⚠️ Transaction record failed (non-fatal):', transactionError);
    }

    // 8. Update coupon stats
    await supabase
      .from('coupons')
      .update({
        current_uses: (coupon as any).current_uses ? (coupon as any).current_uses + 1 : 1,
        successful_conversions: (coupon as any).successful_conversions ? (coupon as any).successful_conversions + 1 : 1,
        total_referrals: (coupon as any).total_referrals ? (coupon as any).total_referrals + 1 : 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coupon.id);

    console.log(`✅ Referral credit awarded: ₹${creditAmount} to parent ${referrer.id} (new balance: ₹${newBalance})`);

    return {
      success: true,
      creditAwarded: creditAmount,
      referrerParentId: referrer.id,
    };

  } catch (error: any) {
    console.error('❌ Credit award error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// REVENUE SPLIT CALCULATION
// ============================================
async function calculateRevenueSplit(
  enrollmentId: string,
  amount: number,
  coachId: string,
  leadSource: 'yestoryd' | 'coach',
  leadSourceCoachId: string | null,
  childId: string,
  childName: string
): Promise<RevenueResult> {
  try {
    // 1. Get coach with their group
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select(`
        id, name, email, tds_cumulative_fy,
        group_id,
        coach_groups (
          id, name, display_name,
          lead_cost_percent, coach_cost_percent, platform_fee_percent,
          is_internal
        )
      `)
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      console.error('❌ Coach not found for revenue calc:', coachError);
      return { success: false, error: 'Coach not found' };
    }

    // Default to Rising Coach if no group assigned
    const coachGroupArray = coach.coach_groups as unknown as CoachGroup[] | null;
    const coachGroup = Array.isArray(coachGroupArray) ? coachGroupArray[0] : coachGroupArray;
    const group: CoachGroup = coachGroup || {
      id: null as any,
      name: 'rising',
      display_name: 'Rising Coach',
      lead_cost_percent: 20,
      coach_cost_percent: 50,
      platform_fee_percent: 30,
      is_internal: false,
    };

    // 2. If internal coach (Rucha), all goes to platform
    if (group.is_internal) {
      const { data: revenue, error: revenueError } = await supabase
        .from('enrollment_revenue')
        .insert({
          enrollment_id: enrollmentId,
          lead_source: leadSource,
          lead_source_coach_id: leadSourceCoachId,
          coaching_coach_id: coachId,
          total_amount: amount,
          lead_cost_amount: 0,
          coach_cost_amount: 0,
          platform_fee_amount: amount,
          tds_applicable: false,
          tds_amount: 0,
          net_to_coach: 0,
          net_to_lead_source: 0,
          net_retained_by_platform: amount,
          coach_group_id: group.id,
          coach_group_name: group.name,
          config_snapshot: { group, note: 'Internal coach - 100% to platform' },
          status: 'completed',
        })
        .select()
        .single();

      if (revenueError) {
        console.error('❌ enrollment_revenue insert failed:', revenueError);
        return { success: false, error: revenueError.message };
      }

      console.log('✅ Revenue (internal):', { platform: amount });
      return {
        success: true,
        enrollment_revenue_id: revenue.id,
        lead_cost: 0,
        coach_cost: 0,
        platform_fee: amount,
        tds_amount: 0,
        net_to_coach: 0,
        payouts_scheduled: 0,
      };
    }

    // 3. Calculate amounts based on group percentages
    const leadCost = Math.round(amount * group.lead_cost_percent / 100);
    const coachCost = Math.round(amount * group.coach_cost_percent / 100);
    const platformFee = amount - leadCost - coachCost;

    // 4. Get TDS config
    const { data: config } = await supabase
      .from('revenue_split_config')
      .select('tds_rate_percent, tds_threshold_annual, payout_day_of_month')
      .eq('is_active', true)
      .single();

    const tdsRate = config?.tds_rate_percent || 10;
    const tdsThreshold = config?.tds_threshold_annual || 30000;
    const payoutDay = config?.payout_day_of_month || 7;

    // 5. Check TDS applicability
    const coachCumulativeFY = coach.tds_cumulative_fy || 0;
    const projectedCumulative = coachCumulativeFY + coachCost;
    const tdsApplicable = projectedCumulative > tdsThreshold;

    const tdsOnCoachCost = tdsApplicable ? Math.round(coachCost * tdsRate / 100) : 0;

    let tdsOnLeadBonus = 0;
    if (leadSource === 'coach' && leadSourceCoachId && tdsApplicable) {
      tdsOnLeadBonus = Math.round(leadCost * tdsRate / 100);
    }

    const totalTds = tdsOnCoachCost + tdsOnLeadBonus;

    // 6. Calculate net amounts
    const netToCoach = coachCost - tdsOnCoachCost;
    const netToLeadSource = leadSource === 'coach' ? leadCost - tdsOnLeadBonus : 0;
    const netToPlatform = platformFee + (leadSource === 'yestoryd' ? leadCost : 0) + totalTds;

    // 7. Create enrollment_revenue record
    const { data: revenue, error: revenueError } = await supabase
      .from('enrollment_revenue')
      .insert({
        enrollment_id: enrollmentId,
        lead_source: leadSource,
        lead_source_coach_id: leadSourceCoachId,
        lead_bonus_coach_id: leadSource === 'coach' ? leadSourceCoachId : null,
        coaching_coach_id: coachId,
        total_amount: amount,
        lead_cost_amount: leadCost,
        coach_cost_amount: coachCost,
        platform_fee_amount: platformFee,
        tds_applicable: tdsApplicable,
        tds_rate_applied: tdsApplicable ? tdsRate : null,
        tds_amount: totalTds,
        net_to_coach: netToCoach,
        net_to_lead_source: netToLeadSource,
        net_retained_by_platform: netToPlatform,
        coach_group_id: group.id,
        coach_group_name: group.name,
        config_snapshot: {
          group,
          tds_rate: tdsRate,
          tds_threshold: tdsThreshold,
          coach_cumulative_before: coachCumulativeFY,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (revenueError) {
      console.error('❌ enrollment_revenue insert failed:', revenueError);
      return { success: false, error: revenueError.message };
    }

    // 8. Create monthly payout schedule (3 months)
    const payoutDates = calculatePayoutDates(payoutDay);
    let payoutsCreated = 0;

    const monthlyCoachCost = Math.round(coachCost / 3);
    const monthlyCoachTds = Math.round(tdsOnCoachCost / 3);

    for (let month = 1; month <= 3; month++) {
      const { error } = await supabase.from('coach_payouts').insert({
        enrollment_revenue_id: revenue.id,
        coach_id: coachId,
        child_id: childId,
        child_name: childName,
        payout_month: month,
        payout_type: 'coach_cost',
        gross_amount: monthlyCoachCost,
        tds_amount: monthlyCoachTds,
        net_amount: monthlyCoachCost - monthlyCoachTds,
        scheduled_date: payoutDates[month - 1],
        status: 'scheduled',
      });
      if (!error) payoutsCreated++;
    }

    if (leadSource === 'coach' && leadSourceCoachId) {
      const monthlyLeadBonus = Math.round(leadCost / 3);
      const monthlyLeadTds = Math.round(tdsOnLeadBonus / 3);

      for (let month = 1; month <= 3; month++) {
        const { error } = await supabase.from('coach_payouts').insert({
          enrollment_revenue_id: revenue.id,
          coach_id: leadSourceCoachId,
          child_id: childId,
          child_name: childName,
          payout_month: month,
          payout_type: 'lead_bonus',
          gross_amount: monthlyLeadBonus,
          tds_amount: monthlyLeadTds,
          net_amount: monthlyLeadBonus - monthlyLeadTds,
          scheduled_date: payoutDates[month - 1],
          status: 'scheduled',
        });
        if (!error) payoutsCreated++;
      }
    }

    // 9. Update coach's cumulative TDS
    await supabase
      .from('coaches')
      .update({
        tds_cumulative_fy: projectedCumulative,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    console.log('✅ Revenue split:', {
      lead_cost: leadCost,
      coach_cost: coachCost,
      platform_fee: platformFee,
      tds: totalTds,
      payouts: payoutsCreated,
    });

    return {
      success: true,
      enrollment_revenue_id: revenue.id,
      lead_cost: leadCost,
      coach_cost: coachCost,
      platform_fee: platformFee,
      tds_amount: totalTds,
      net_to_coach: netToCoach,
      payouts_scheduled: payoutsCreated,
    };

  } catch (error: any) {
    console.error('❌ Revenue calculation error:', error);
    return { success: false, error: error.message };
  }
}

function calculatePayoutDates(payoutDay: number): string[] {
  const dates: string[] = [];
  const now = new Date();

  for (let i = 1; i <= 3; i++) {
    const payoutDate = new Date(now.getFullYear(), now.getMonth() + i, payoutDay);
    dates.push(payoutDate.toISOString().split('T')[0]);
  }

  return dates;
}

// ============================================
// MAIN HANDLER
// ============================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      childName,
      childAge,
      childId,
      parentName,
      parentEmail,
      parentPhone,
      coachId,
      leadSource = 'yestoryd',
      leadSourceCoachId = null,
      // ==================== Coupon/Referral Support ====================
      couponCode = null,
      originalAmount = 5999,
      discountAmount = 0,
      // ==================== Delayed Start Support ====================
      requestedStartDate = null, // null means "start immediately"
    } = body;

    // Use couponCode or legacy referralCodeUsed
    const referralCodeUsed = couponCode || body.referralCodeUsed || null;

    console.log('🔐 Verifying payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      childName,
      leadSource,
      couponCode: referralCodeUsed,
      requestedStartDate: requestedStartDate || 'immediate',
    });

    // ============================================
    // STEP 1: Verify Razorpay Signature
    // ============================================
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Invalid payment signature');
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    console.log('✅ Signature verified');

    // ============================================
    // STEP 2: Get or Create Parent
    // ============================================
    let parent;
    const { data: existingParent } = await supabase
      .from('parents')
      .select('*')
      .eq('email', parentEmail.toLowerCase().trim())
      .single();

    if (existingParent) {
      parent = existingParent;
      console.log('👤 Found existing parent:', parent.id);
    } else {
      const { data: newParent, error: parentError } = await supabase
        .from('parents')
        .insert({
          email: parentEmail.toLowerCase().trim(),
          name: parentName,
          phone: parentPhone,
        })
        .select()
        .single();

      if (parentError) {
        console.error('❌ Failed to create parent:', parentError);
        throw new Error('Failed to create parent record');
      }
      parent = newParent;
      console.log('👤 Created new parent:', parent.id);
    }

    // ============================================
    // STEP 3: Get or Create Child
    // ============================================
    let child;
    if (childId) {
      const { data: existingChild } = await supabase
        .from('children')
        .select('*')
        .eq('id', childId)
        .single();

      if (existingChild) {
        child = existingChild;
        console.log('👶 Found existing child:', child.id);
      }
    }

    if (!child) {
      const { data: newChild, error: childError } = await supabase
        .from('children')
        .insert({
          name: childName,
          age: parseInt(childAge) || null,
          parent_id: parent.id,
          parent_email: parentEmail.toLowerCase().trim(),
          enrollment_status: 'enrolled',
          lead_status: 'enrolled',
        })
        .select()
        .single();

      if (childError) {
        console.error('❌ Failed to create child:', childError);
        throw new Error('Failed to create child record');
      }
      child = newChild;
      console.log('👶 Created new child:', child.id);
    }

    // Update child status and ensure parent_email is set
    await supabase
      .from('children')
      .update({
        enrollment_status: 'enrolled',
        lead_status: 'enrolled',
        coach_id: coachId,
        parent_id: parent.id,
        parent_email: parentEmail.toLowerCase().trim(),
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', child.id);

    // ============================================
    // STEP 4: Get Coach Details
    // ============================================
    let coach;

    if (coachId) {
      const { data: foundCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', coachId)
        .single();
      coach = foundCoach;
    }

    if (!coach) {
      const { data: defaultCoach } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', 'rucha.rai@yestoryd.com')
        .single();

      coach = defaultCoach || {
        id: coachId || 'default',
        email: 'rucha.rai@yestoryd.com',
        name: 'Rucha Rai',
      };
    }

    console.log('👩‍🏫 Coach assigned:', coach.name);

    // ============================================
    // STEP 5: Create Payment Record
    // ============================================
    const finalAmount = originalAmount - discountAmount;
    
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        parent_id: parent.id,
        child_id: child.id,
        razorpay_order_id,
        razorpay_payment_id,
        amount: finalAmount,
        currency: 'INR',
        status: 'captured',
        captured_at: new Date().toISOString(),
        // Track discount info
        original_amount: originalAmount,
        discount_amount: discountAmount,
        coupon_code: referralCodeUsed,
      });

    if (paymentError) {
      console.error('⚠️ Payment record error:', paymentError);
    }

    // ============================================
    // STEP 6: Determine Start Mode (IMMEDIATE vs DELAYED)
    // ============================================
    const startImmediately = !requestedStartDate;
    
    const programStart = startImmediately 
      ? new Date() 
      : new Date(requestedStartDate);
    
    const programEnd = new Date(programStart);
    programEnd.setMonth(programEnd.getMonth() + 3);

    const enrollmentStatus = startImmediately ? 'active' : 'pending_start';

    console.log(`📅 Start mode: ${startImmediately ? 'IMMEDIATE' : 'DELAYED'}`);
    if (!startImmediately) {
      console.log(`📅 Requested start date: ${requestedStartDate}`);
    }

    // ============================================
    // STEP 7: Create Enrollment Record
    // ============================================
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: child.id,
        parent_id: parent.id,
        coach_id: coach.id,
        payment_id: razorpay_payment_id,
        amount: finalAmount,
        status: enrollmentStatus,
        program_start: programStart.toISOString(),
        program_end: programEnd.toISOString(),
        schedule_confirmed: false,
        sessions_scheduled: 0,
        lead_source: leadSource,
        lead_source_coach_id: leadSourceCoachId,
        referral_code_used: referralCodeUsed,
        requested_start_date: requestedStartDate || null,
        actual_start_date: startImmediately ? new Date().toISOString().split('T')[0] : null,
        // Track discount
        original_amount: originalAmount,
        discount_amount: discountAmount,
      })
      .select()
      .single();

    if (enrollmentError) {
      console.error('❌ Enrollment creation failed:', enrollmentError);
      throw new Error('Failed to create enrollment record');
    }

    console.log('📝 Enrollment created:', enrollment.id, `(status: ${enrollmentStatus})`);

    // ============================================
    // STEP 8: Award Referral Credit (NEW!)
    // ============================================
    let creditResult: CreditAwardResult = { success: false };
    
    if (referralCodeUsed) {
      creditResult = await awardReferralCredit(
        referralCodeUsed,
        enrollment.id,
        parent.id,
        originalAmount // Use original amount for credit calculation
      );

      if (creditResult.success) {
        console.log(`🎁 Referral credit: ₹${creditResult.creditAwarded} awarded to ${creditResult.referrerParentId}`);
      } else {
        console.log('ℹ️ No referral credit awarded:', creditResult.error);
      }
    }

    // ============================================
    // STEP 9: Calculate Revenue Split
    // ============================================
    const revenueResult = await calculateRevenueSplit(
      enrollment.id,
      finalAmount, // Use final amount after discount
      coach.id,
      leadSource as 'yestoryd' | 'coach',
      leadSourceCoachId,
      child.id,
      child.name
    );

    if (revenueResult.success) {
      console.log('💰 Revenue processed:', {
        coach_gets: revenueResult.net_to_coach,
        platform_keeps: revenueResult.platform_fee,
        tds: revenueResult.tds_amount,
        payouts: revenueResult.payouts_scheduled,
      });
    } else {
      console.error('⚠️ Revenue calc failed (non-fatal):', revenueResult.error);
    }

    // ============================================
    // STEP 10: Queue Background Job (ONLY IF IMMEDIATE START)
    // ============================================
    let queueResult: { success: boolean; messageId: string | null } = {
      success: false,
      messageId: null,
    };

    if (startImmediately) {
      try {
        queueResult = await queueEnrollmentComplete({
          enrollmentId: enrollment.id,
          childId: child.id,
          childName: child.name,
          parentId: parent.id,
          parentEmail: parent.email,
          parentName: parent.name,
          parentPhone: parent.phone || parentPhone,
          coachId: coach.id,
          coachEmail: coach.email,
          coachName: coach.name,
        });

        console.log('📤 Background job queued:', queueResult.messageId);
      } catch (queueError: any) {
        console.error('⚠️ Queue error (non-fatal):', queueError.message);
      }
    } else {
      console.log(`📅 Delayed start: Sessions will be scheduled by cron on ${requestedStartDate}`);
      
      try {
        await supabase.from('enrollment_events').insert({
          enrollment_id: enrollment.id,
          event_type: 'payment_received_delayed_start',
          event_data: {
            requested_start_date: requestedStartDate,
            payment_id: razorpay_payment_id,
            child_name: child.name,
            coach_name: coach.name,
          },
          triggered_by: 'system',
        });
      } catch (eventError) {
        console.error('⚠️ Event logging failed (non-fatal):', eventError);
      }
    }

    // ============================================
    // STEP 11: Return Success Response
    // ============================================
    const duration = Date.now() - startTime;
    console.log(`✅ Payment verified in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      enrollmentId: enrollment.id,
      data: {
        enrollmentId: enrollment.id,
        childId: child.id,
        parentId: parent.id,
        coachId: coach.id,
        coachName: coach.name,
      },
      revenue: revenueResult.success
        ? {
            coach_earnings: revenueResult.net_to_coach,
            platform_fee: revenueResult.platform_fee,
            tds_collected: revenueResult.tds_amount,
            payouts_scheduled: revenueResult.payouts_scheduled,
          }
        : null,
      referral: creditResult.success
        ? {
            creditAwarded: creditResult.creditAwarded,
            referrerParentId: creditResult.referrerParentId,
          }
        : null,
      scheduling: {
        status: startImmediately 
          ? (queueResult.success ? 'queued' : 'pending')
          : 'delayed',
        messageId: queueResult.messageId,
        delayedStart: !startImmediately ? {
          requestedStartDate,
          programStartDate: programStart.toISOString().split('T')[0],
          programEndDate: programEnd.toISOString().split('T')[0],
          note: `Sessions will be automatically scheduled on ${requestedStartDate}. Reminder will be sent 3 days before.`,
        } : null,
        note: startImmediately 
          ? 'Calendar sessions and confirmation email are being processed.'
          : `Program starts on ${requestedStartDate}. Sessions will be scheduled closer to the start date.`,
      },
    });
  } catch (error: any) {
    console.error('❌ Payment verification error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Payment verification failed',
      },
      { status: 500 }
    );
  }
}