// ============================================================
// FILE: app/api/enrollment/calculate-revenue/route.ts
// ============================================================
// HARDENED VERSION - Enrollment Revenue Calculator
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Internal-only access (payment webhook or admin)
// - UUID validation
// - Latest-wins config pattern (no race condition)
// - Audit logging
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
// Auth handled by api-auth.ts
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION (Lazy initialization) ---
// Using getServiceSupabase from api-auth.ts

// Internal API key for webhook-to-API calls
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// --- HELPER: UUID validation ---
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// --- VALIDATION SCHEMA ---
const revenueRequestSchema = z.object({
  enrollment_id: z.string().refine(isValidUUID, 'Invalid enrollment_id format'),
  total_amount: z.number().int().positive().max(100000, 'Amount too large'),
  lead_source: z.enum(['yestoryd', 'coach', 'referral']),
  lead_source_coach_id: z.string().refine(isValidUUID, 'Invalid lead_source_coach_id').optional().nullable(),
  coaching_coach_id: z.string().refine(isValidUUID, 'Invalid coaching_coach_id'),
  child_id: z.string().refine(isValidUUID, 'Invalid child_id'),
  child_name: z.string().min(1).max(100),
});

// --- HELPER: Verify internal call ---
function isInternalCall(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-internal-api-key');
  return !!(INTERNAL_API_KEY && apiKey === INTERNAL_API_KEY);
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // =================================================================
    // 1. AUTHORIZATION: Internal call OR Admin only
    // This route should ONLY be called by:
    // - Payment webhook (internal API key)
    // - Admin manually (session auth)
    // =================================================================
    
    const isInternal = isInternalCall(request);
    let adminEmail: string | null = null;

    if (!isInternal) {
      // Check for admin session
      const auth = await requireAdmin();
      if (!auth.authorized) {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: auth.error || 'No session or internal key',
        }));

        return NextResponse.json(
          { success: false, error: 'Unauthorized. Internal or admin access required.' },
          { status: 401 }
        );
      }

      if (auth.role !== 'admin') {
        console.log(JSON.stringify({
          requestId,
          event: 'auth_failed',
          error: 'Non-admin tried to calculate revenue',
          userEmail: auth.email,
        }));

        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        );
      }

      adminEmail = auth.email || null;
    }

    // =================================================================
    // 2. PARSE AND VALIDATE BODY
    // =================================================================
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = revenueRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      enrollment_id,
      total_amount,
      lead_source,
      lead_source_coach_id,
      coaching_coach_id,
      child_id,
      child_name,
    } = validationResult.data;

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_calculation_request',
      source: isInternal ? 'internal' : 'admin',
      adminEmail,
      enrollment_id,
      total_amount,
      lead_source,
    }));

    const supabase = getServiceSupabase();

    // =================================================================
    // 3. GET ACTIVE REVENUE CONFIG (Latest-wins pattern)
    // =================================================================
    const { data: config, error: configError } = await supabase
      .from('revenue_split_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching config:', configError);
    }

    const activeConfig = config || {
      lead_cost_percent: 20,
      coach_cost_percent: 50,
      platform_fee_percent: 30,
      tds_rate_percent: 10,
      tds_threshold_annual: 30000,
      payout_day_of_month: 7,
    };

    // =================================================================
    // 4. CHECK IF ALREADY CALCULATED (Idempotency)
    // =================================================================
    const { data: existing } = await supabase
      .from('enrollment_revenue')
      .select('id')
      .eq('enrollment_id', enrollment_id)
      .single();

    if (existing) {
      console.log(JSON.stringify({
        requestId,
        event: 'revenue_already_exists',
        enrollment_id,
        existing_id: existing.id,
      }));

      return NextResponse.json({
        success: false,
        error: 'Revenue already calculated for this enrollment',
        enrollment_revenue_id: existing.id,
      }, { status: 400 });
    }

    // =================================================================
    // 5. CALCULATE SPLIT AMOUNTS
    // =================================================================
    const leadCostAmount = Math.round(total_amount * activeConfig.lead_cost_percent / 100);
    const coachCostAmount = Math.round(total_amount * activeConfig.coach_cost_percent / 100);
    const platformFeeAmount = total_amount - leadCostAmount - coachCostAmount;

    // =================================================================
    // 6. CHECK TDS APPLICABILITY FOR COACHING COACH
    // =================================================================
    const { data: coach } = await supabase
      .from('coaches')
      .select('tds_cumulative_fy, pan_number, name')
      .eq('id', coaching_coach_id)
      .single();

    if (!coach) {
      return NextResponse.json(
        { success: false, error: 'Coaching coach not found' },
        { status: 404 }
      );
    }

    const coachYTD = (coach.tds_cumulative_fy || 0) + coachCostAmount;
    const tdsApplicable = coachYTD > activeConfig.tds_threshold_annual;
    const tdsAmount = tdsApplicable
      ? Math.round(coachCostAmount * activeConfig.tds_rate_percent / 100)
      : 0;

    // =================================================================
    // 7. CALCULATE NET AMOUNTS
    // =================================================================
    const netToCoach = coachCostAmount - tdsAmount;
    const netToLeadSource = lead_source === 'coach' ? leadCostAmount : 0;
    const netRetainedByPlatform = platformFeeAmount + tdsAmount +
      (lead_source === 'yestoryd' || lead_source === 'referral' ? leadCostAmount : 0);

    // =================================================================
    // 8. STORE ENROLLMENT REVENUE
    // =================================================================
    const { data: enrollmentRevenue, error: revenueError } = await supabase
      .from('enrollment_revenue')
      .insert({
        enrollment_id,
        lead_source,
        lead_source_coach_id: lead_source === 'coach' ? lead_source_coach_id : null,
        coaching_coach_id,
        total_amount,
        lead_cost_amount: leadCostAmount,
        coach_cost_amount: coachCostAmount,
        platform_fee_amount: platformFeeAmount,
        tds_applicable: tdsApplicable,
        tds_rate_applied: tdsApplicable ? activeConfig.tds_rate_percent : null,
        tds_amount: tdsAmount,
        net_to_coach: netToCoach,
        net_to_lead_source: netToLeadSource,
        net_retained_by_platform: netRetainedByPlatform,
        config_snapshot: activeConfig,
        status: 'pending',
      })
      .select()
      .single();

    if (revenueError) throw revenueError;

    // =================================================================
    // 9. CALCULATE PAYOUT SCHEDULE (Monthly for 3 months)
    // =================================================================
    const payoutDayOfMonth = activeConfig.payout_day_of_month || 7;
    const today = new Date();
    const payoutSchedule: Date[] = [];

    for (let i = 1; i <= 3; i++) {
      const payoutDate = new Date(today.getFullYear(), today.getMonth() + i, payoutDayOfMonth);
      payoutSchedule.push(payoutDate);
    }

    // =================================================================
    // 10. CREATE STAGGERED PAYOUT ENTRIES
    // =================================================================
    const monthlyCoachCost = Math.round(coachCostAmount / 3);
    const monthlyTds = Math.round(tdsAmount / 3);

    const coachPayouts: any[] = [];
    
    for (let month = 1; month <= 3; month++) {
      // Adjust last month to handle rounding
      const thisMonthCoachCost = month === 3
        ? coachCostAmount - (monthlyCoachCost * 2)
        : monthlyCoachCost;
      const thisMonthTds = month === 3
        ? tdsAmount - (monthlyTds * 2)
        : monthlyTds;

      coachPayouts.push({
        enrollment_revenue_id: enrollmentRevenue.id,
        coach_id: coaching_coach_id,
        child_id,
        child_name,
        payout_month: month,
        payout_type: 'coach_cost',
        gross_amount: thisMonthCoachCost,
        tds_amount: thisMonthTds,
        net_amount: thisMonthCoachCost - thisMonthTds,
        scheduled_date: payoutSchedule[month - 1].toISOString().split('T')[0],
        status: 'scheduled',
      });
    }

    // =================================================================
    // 11. IF COACH-SOURCED, SCHEDULE LEAD BONUS PAYOUTS
    // =================================================================
    if (lead_source === 'coach' && lead_source_coach_id) {
      // Validate lead source coach exists
      const { data: leadCoach } = await supabase
        .from('coaches')
        .select('id, tds_cumulative_fy')
        .eq('id', lead_source_coach_id)
        .single();

      if (!leadCoach) {
        console.warn(`Lead source coach ${lead_source_coach_id} not found, skipping lead bonus`);
      } else {
        const monthlyLeadBonus = Math.round(leadCostAmount / 3);
        
        // Check TDS for lead source coach
        const leadCoachYTD = (leadCoach.tds_cumulative_fy || 0) + leadCostAmount;
        const leadBonusTdsApplicable = leadCoachYTD > activeConfig.tds_threshold_annual;
        const leadBonusTds = leadBonusTdsApplicable
          ? Math.round(monthlyLeadBonus * activeConfig.tds_rate_percent / 100)
          : 0;

        for (let month = 1; month <= 3; month++) {
          const thisMonthBonus = month === 3
            ? leadCostAmount - (monthlyLeadBonus * 2)
            : monthlyLeadBonus;
          const thisMonthTds = month === 3 && leadBonusTdsApplicable
            ? Math.round(leadCostAmount * activeConfig.tds_rate_percent / 100) - (leadBonusTds * 2)
            : leadBonusTds;

          coachPayouts.push({
            enrollment_revenue_id: enrollmentRevenue.id,
            coach_id: lead_source_coach_id,
            child_id,
            child_name,
            payout_month: month,
            payout_type: 'lead_bonus',
            gross_amount: thisMonthBonus,
            tds_amount: thisMonthTds,
            net_amount: thisMonthBonus - thisMonthTds,
            scheduled_date: payoutSchedule[month - 1].toISOString().split('T')[0],
            status: 'scheduled',
          });
        }

        // Update lead source coach cumulative TDS
        await supabase
          .from('coaches')
          .update({ tds_cumulative_fy: leadCoachYTD })
          .eq('id', lead_source_coach_id);
      }
    }

    // =================================================================
    // 12. INSERT ALL PAYOUTS
    // =================================================================
    const { error: payoutsError } = await supabase
      .from('coach_payouts')
      .insert(coachPayouts);

    if (payoutsError) throw payoutsError;

    // =================================================================
    // 13. UPDATE COACH CUMULATIVE TDS TRACKER
    // =================================================================
    await supabase
      .from('coaches')
      .update({ tds_cumulative_fy: coachYTD })
      .eq('id', coaching_coach_id);

    // =================================================================
    // 14. AUDIT LOG
    // =================================================================
    await supabase.from('activity_log').insert({
      user_email: adminEmail || 'engage@yestoryd.com',
      action: 'enrollment_revenue_calculated',
      details: {
        request_id: requestId,
        enrollment_id,
        enrollment_revenue_id: enrollmentRevenue.id,
        total_amount,
        lead_source,
        coaching_coach_id,
        breakdown: {
          lead_cost: leadCostAmount,
          coach_cost: coachCostAmount,
          platform_fee: platformFeeAmount,
          tds: tdsAmount,
        },
        payouts_created: coachPayouts.length,
        source: isInternal ? 'payment_webhook' : 'admin_manual',
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_calculated',
      enrollment_id,
      enrollment_revenue_id: enrollmentRevenue.id,
      payouts_created: coachPayouts.length,
      duration: `${duration}ms`,
    }));

    // =================================================================
    // 15. RETURN SUCCESS RESPONSE
    // =================================================================
    return NextResponse.json({
      success: true,
      requestId,
      enrollment_revenue_id: enrollmentRevenue.id,
      breakdown: {
        total_amount,
        lead_cost: {
          amount: leadCostAmount,
          percent: activeConfig.lead_cost_percent,
          recipient: lead_source === 'coach' ? 'Coach (Lead Bonus)' : 'Yestoryd',
        },
        coach_cost: {
          amount: coachCostAmount,
          percent: activeConfig.coach_cost_percent,
          gross: coachCostAmount,
          tds: tdsAmount,
          net: netToCoach,
          tds_applicable: tdsApplicable,
        },
        platform_fee: {
          amount: platformFeeAmount,
          percent: activeConfig.platform_fee_percent,
        },
        net_to_coach: netToCoach,
        net_to_lead_source: netToLeadSource,
        net_retained_by_platform: netRetainedByPlatform,
      },
      payouts_scheduled: payoutSchedule.map((date, i) => ({
        month: i + 1,
        date: date.toISOString().split('T')[0],
        coach_cost: coachPayouts.find(p => p.payout_month === i + 1 && p.payout_type === 'coach_cost')?.net_amount || 0,
        lead_bonus: coachPayouts.find(p => p.payout_month === i + 1 && p.payout_type === 'lead_bonus')?.net_amount || 0,
      })),
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'revenue_calculation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Failed to calculate revenue', requestId },
      { status: 500 }
    );
  }
}
