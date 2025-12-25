// ============================================================
// FILE: app/api/payment/verify/route.ts
// ============================================================
// Payment verification with REVENUE SPLIT integration
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
    // Supabase returns array for joined tables, take first element
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
    const platformFee = amount - leadCost - coachCost; // Remainder

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

    // TDS on coach cost
    const tdsOnCoachCost = tdsApplicable ? Math.round(coachCost * tdsRate / 100) : 0;

    // TDS on lead bonus if coach-sourced
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

    // Coach cost payouts
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

    // Lead bonus payouts (if coach-sourced)
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

// Helper: Calculate payout dates
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
      // NEW: Lead source tracking (from frontend/cookie)
      leadSource = 'yestoryd',
      leadSourceCoachId = null,
      referralCodeUsed = null,
    } = body;

    console.log('🔐 Verifying payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      childName,
      leadSource,
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
          enrollment_status: 'enrolled',
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

    // Update child status
    await supabase
      .from('children')
      .update({
        enrollment_status: 'enrolled',
        coach_id: coachId,
        parent_id: parent.id,
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

    // Fallback to Rucha (UPDATED EMAIL)
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
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        parent_id: parent.id,
        child_id: child.id,
        razorpay_order_id,
        razorpay_payment_id,
        amount: 5999,
        currency: 'INR',
        status: 'captured',
        captured_at: new Date().toISOString(),
      });

    if (paymentError) {
      console.error('⚠️ Payment record error:', paymentError);
    }

    // ============================================
    // STEP 6: Create Enrollment Record (WITH LEAD SOURCE)
    // ============================================
    const programStart = new Date();
    const programEnd = new Date();
    programEnd.setMonth(programEnd.getMonth() + 3);

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        child_id: child.id,
        parent_id: parent.id,
        coach_id: coach.id,
        payment_id: razorpay_payment_id,
        amount: 5999,
        status: 'active',
        program_start: programStart.toISOString(),
        program_end: programEnd.toISOString(),
        schedule_confirmed: false,
        sessions_scheduled: 0,
        // NEW: Lead source tracking
        lead_source: leadSource,
        lead_source_coach_id: leadSourceCoachId,
        referral_code_used: referralCodeUsed,
      })
      .select()
      .single();

    if (enrollmentError) {
      console.error('❌ Enrollment creation failed:', enrollmentError);
      throw new Error('Failed to create enrollment record');
    }

    console.log('📝 Enrollment created:', enrollment.id);

    // ============================================
    // STEP 7: 🆕 CALCULATE REVENUE SPLIT
    // ============================================
    const revenueResult = await calculateRevenueSplit(
      enrollment.id,
      5999,
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
    // STEP 8: Queue Background Job
    // ============================================
    let queueResult: { success: boolean; messageId: string | null } = {
      success: false,
      messageId: null,
    };

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

    // ============================================
    // STEP 9: Return Success
    // ============================================
    const duration = Date.now() - startTime;
    console.log(`✅ Payment verified in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
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
      scheduling: {
        status: queueResult.success ? 'queued' : 'pending',
        messageId: queueResult.messageId,
        note: 'Calendar sessions and confirmation email are being processed.',
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