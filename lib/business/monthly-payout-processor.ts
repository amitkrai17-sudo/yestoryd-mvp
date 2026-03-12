// =============================================================================
// MONTHLY PAYOUT PROCESSOR (V3)
// lib/business/monthly-payout-processor.ts
//
// Called by /api/cron/monthly-payouts on 7th of month.
// 6 phases: sessions (differentiated rates) → lead costs → (coaching bonus: no-op) →
//           re-enrollment → external referrer payouts → insert coach_payout records
//
// All business values from loadPayoutConfig() — zero hardcoding.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import {
  loadPayoutConfig,
  loadCoachGroup,
  calculateTDS,
  type SessionType,
} from '@/lib/config/payout-config';

// =============================================================================
// TYPES
// =============================================================================

interface CoachLineItem {
  coach_id: string;
  session_type: string; // 'coaching' | 'skill_building' | 'lead_cost' | 'coaching_bonus' | 'reenrollment_bonus'
  gross_amount: number;
  description: string;
  enrollment_revenue_id?: string;
}

interface PhaseResult {
  phase: string;
  count: number;
  amount: number;
  errors: string[];
}

export interface MonthlyPayoutResult {
  payout_period: string;
  phases: PhaseResult[];
  total_coaches: number;
  total_payout_amount: number;
  total_line_items: number;
  errors: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function getFinancialYearStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
}

async function getCoachYTDEarnings(coachId: string, fyStart: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('coach_payouts')
    .select('gross_amount')
    .eq('coach_id', coachId)
    .gte('created_at', fyStart)
    .in('status', ['scheduled', 'paid']);

  return (data || []).reduce((sum, r) => sum + (Number(r.gross_amount) || 0), 0);
}

async function hasFirstSessionCompleted(enrollmentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('scheduled_sessions')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'completed')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// =============================================================================
// MAIN PROCESSOR
// =============================================================================

export async function processMonthlyPayouts(requestId: string): Promise<MonthlyPayoutResult> {
  const config = await loadPayoutConfig();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const startOfPrev = new Date(prevYear, prevMonth, 1).toISOString();
  const startOfThis = new Date(year, month, 1).toISOString();
  const payoutPeriod = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  const fyStart = getFinancialYearStart();
  const today = new Date().toISOString().split('T')[0];

  const allLineItems: CoachLineItem[] = [];
  const phases: PhaseResult[] = [];
  const globalErrors: string[] = [];

  // =====================================================================
  // PHASE 1: Per-session coach payouts
  // =====================================================================
  const phase1: PhaseResult = { phase: 'per_session_payouts', count: 0, amount: 0, errors: [] };

  try {
    const { data: sessions } = await supabaseAdmin
      .from('scheduled_sessions')
      .select('id, enrollment_id, coach_id, session_type, completed_at')
      .eq('status', 'completed')
      .eq('payout_processed', false)
      .gte('completed_at', startOfPrev)
      .lt('completed_at', startOfThis);

    if (sessions && sessions.length > 0) {
      // Group by coach
      type SessionRow = (typeof sessions)[number];
      const coachSessions = new Map<string, SessionRow[]>();
      for (const s of sessions) {
        if (!s.coach_id || !s.enrollment_id) continue;
        const existing = coachSessions.get(s.coach_id) || [];
        existing.push(s);
        coachSessions.set(s.coach_id, existing);
      }

      // Get all enrollment revenues in one batch (only columns that exist in DB)
      const enrollmentIds = Array.from(new Set(
        sessions.map(s => s.enrollment_id).filter(Boolean),
      )) as string[];
      const { data: revenues } = await supabaseAdmin
        .from('enrollment_revenue')
        .select('id, enrollment_id, coach_cost_amount, total_amount')
        .in('enrollment_id', enrollmentIds);

      type RevenueRow = NonNullable<typeof revenues>[number];
      const revenueMap = new Map<string, RevenueRow>();
      for (const r of revenues || []) {
        revenueMap.set(r.enrollment_id, r);
      }

      // Batch-fetch session type counts per enrollment from scheduled_sessions
      const { data: allScheduledSessions } = await supabaseAdmin
        .from('scheduled_sessions')
        .select('enrollment_id, session_type')
        .in('enrollment_id', enrollmentIds);

      const enrollmentCoachingCountMap = new Map<string, number>();
      for (const s of allScheduledSessions || []) {
        if (!s.enrollment_id) continue;
        if (s.session_type !== 'skill_building') {
          enrollmentCoachingCountMap.set(
            s.enrollment_id,
            (enrollmentCoachingCountMap.get(s.enrollment_id) || 0) + 1,
          );
        }
      }

      for (const [coachId, coachSessionList] of Array.from(coachSessions.entries())) {
        // Load coach group to check internal
        const group = await loadCoachGroup(coachId);
        if (group?.is_internal) {
          // Mark sessions as processed but skip payout
          const sessionIds = coachSessionList.map(s => s.id);
          await supabaseAdmin
            .from('scheduled_sessions')
            .update({ payout_processed: true, payout_processed_at: new Date().toISOString() })
            .in('id', sessionIds);
          continue;
        }

        for (const session of coachSessionList) {
          const rev = revenueMap.get(session.enrollment_id!);
          if (!rev) {
            phase1.errors.push(`No enrollment_revenue for enrollment ${session.enrollment_id}`);
            continue;
          }

          // Differentiated rates: coaching_rate = coach_cost ÷ coaching sessions
          // skill_building_rate = coaching_rate × multiplier (0.5)
          const sessionType: SessionType = (session.session_type === 'skill_building') ? 'skill_building' : 'coaching';
          const coachingSessions = enrollmentCoachingCountMap.get(session.enrollment_id!) || 12;
          const coachingRate = coachingSessions > 0
            ? Math.round(rev.coach_cost_amount / coachingSessions)
            : 0;
          const rate = sessionType === 'skill_building'
            ? Math.round(coachingRate * config.skill_building_rate_multiplier)
            : coachingRate;

          allLineItems.push({
            coach_id: coachId,
            session_type: sessionType,
            gross_amount: rate,
            description: `${sessionType} session ${session.id.slice(0, 8)}`,
            enrollment_revenue_id: rev.id,
          });

          phase1.count++;
          phase1.amount += rate;
        }

        // Mark sessions as processed
        const sessionIds = coachSessionList.map(s => s.id);
        await supabaseAdmin
          .from('scheduled_sessions')
          .update({ payout_processed: true, payout_processed_at: new Date().toISOString() })
          .in('id', sessionIds);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    phase1.errors.push(`Phase 1 error: ${msg}`);
    globalErrors.push(`Phase 1: ${msg}`);
  }

  phases.push(phase1);

  // =====================================================================
  // PHASE 2: Lead cost releases
  // =====================================================================
  const phase2: PhaseResult = { phase: 'lead_cost_releases', count: 0, amount: 0, errors: [] };

  try {
    const { data: leadRevenues } = await supabaseAdmin
      .from('enrollment_revenue')
      .select('id, enrollment_id, referrer_id, lead_cost_amount, coaching_coach_id')
      .eq('lead_cost_paid', false)
      .not('referrer_id', 'is', null)
      .gt('lead_cost_amount', 0);

    for (const rev of leadRevenues || []) {
      // Check timing: first session must be completed
      if (config.lead_cost_timing === 'after_first_session') {
        const completed = await hasFirstSessionCompleted(rev.enrollment_id);
        if (!completed) continue;
      }

      const leadAmount = Number(rev.lead_cost_amount) || 0;

      // Look up referrer to determine type
      const { data: referrer } = await supabaseAdmin
        .from('referrers')
        .select('id, referrer_type, coach_id')
        .eq('id', rev.referrer_id!)
        .single();

      if (!referrer) {
        phase2.errors.push(`Referrer ${rev.referrer_id} not found for revenue ${rev.id}`);
        continue;
      }

      if (referrer.referrer_type === 'coach' && referrer.coach_id) {
        // Coach referrer → add to coach payout line items
        allLineItems.push({
          coach_id: referrer.coach_id,
          session_type: 'lead_cost',
          gross_amount: leadAmount,
          description: `Lead cost for enrollment ${rev.enrollment_id?.slice(0, 8)}`,
          enrollment_revenue_id: rev.id,
        });
      } else {
        // External/parent/influencer → update referral_conversions + increment pending
        await supabaseAdmin
          .from('referral_conversions')
          .update({ referrer_payout_status: 'approved' })
          .eq('referrer_id', referrer.id)
          .eq('enrollment_id', rev.enrollment_id);

        // Increment referrer pending balance via RPC
        await supabaseAdmin.rpc('increment_referrer_pending', {
          p_referrer_id: referrer.id,
          p_amount: leadAmount,
        });
      }

      // Mark lead cost as paid
      await supabaseAdmin
        .from('enrollment_revenue')
        .update({
          lead_cost_paid: true,
          lead_cost_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rev.id);

      phase2.count++;
      phase2.amount += leadAmount;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    phase2.errors.push(`Phase 2 error: ${msg}`);
    globalErrors.push(`Phase 2: ${msg}`);
  }

  phases.push(phase2);

  // =====================================================================
  // PHASE 3: Coaching bonuses (eliminated — replaced by SB payments)
  // =====================================================================
  const phase3: PhaseResult = { phase: 'coaching_bonuses', count: 0, amount: 0, errors: [] };
  // No-op: coaching_bonus_percent is now 0. SB sessions are paid via
  // differentiated per-session rates in Phase 1 instead.
  phases.push(phase3);

  // =====================================================================
  // PHASE 4: Re-enrollment bonuses
  // =====================================================================
  const phase4: PhaseResult = { phase: 'reenrollment_bonuses', count: 0, amount: 0, errors: [] };

  try {
    if (config.reenrollment_coach_bonus_enabled) {
      const { data: reenrollments } = await supabaseAdmin
        .from('enrollments')
        .select('id, coach_id, enrollment_type, reenrollment_bonus_paid')
        .eq('enrollment_type', 'reenrollment')
        .eq('reenrollment_bonus_paid', false)
        .gte('created_at', startOfPrev)
        .lt('created_at', startOfThis);

      for (const enrollment of reenrollments || []) {
        const coachId = enrollment.coach_id;
        if (!coachId) continue;

        const bonus = config.reenrollment_coach_bonus;

        allLineItems.push({
          coach_id: coachId,
          session_type: 'reenrollment_bonus',
          gross_amount: bonus,
          description: `Re-enrollment bonus for ${enrollment.id.slice(0, 8)}`,
        });

        await supabaseAdmin
          .from('enrollments')
          .update({ reenrollment_bonus_paid: true })
          .eq('id', enrollment.id);

        phase4.count++;
        phase4.amount += bonus;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    phase4.errors.push(`Phase 4 error: ${msg}`);
    globalErrors.push(`Phase 4: ${msg}`);
  }

  phases.push(phase4);

  // =====================================================================
  // PHASE 5: External referrer payouts (flag for admin)
  // =====================================================================
  const phase5: PhaseResult = { phase: 'external_referrer_payouts', count: 0, amount: 0, errors: [] };

  try {
    const minPayout = config.external_referral_min_payout;

    const { data: eligibleReferrers } = await supabaseAdmin
      .from('referrers')
      .select('id, name, phone, referrer_type, total_pending, upi_id')
      .in('referrer_type', ['external', 'parent', 'influencer'])
      .gt('total_pending', minPayout - 1)
      .eq('is_active', true);

    for (const referrer of eligibleReferrers || []) {
      if (config.external_referral_auto_approve) {
        // TODO: Queue for RazorpayX payout
        // For now, update status to 'approved' on their conversions
        await supabaseAdmin
          .from('referral_conversions')
          .update({ referrer_payout_status: 'approved' })
          .eq('referrer_id', referrer.id)
          .eq('referrer_payout_status', 'pending');
      }

      // TODO: If upi_id is null, send WhatsApp asking for UPI ID

      phase5.count++;
      phase5.amount += Number(referrer.total_pending) || 0;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    phase5.errors.push(`Phase 5 error: ${msg}`);
    globalErrors.push(`Phase 5: ${msg}`);
  }

  phases.push(phase5);

  // =====================================================================
  // PHASE 6: Insert coach_payout records
  // =====================================================================
  const phase6: PhaseResult = { phase: 'insert_coach_payouts', count: 0, amount: 0, errors: [] };

  try {
    // Aggregate line items by coach
    const coachTotals = new Map<string, {
      items: CoachLineItem[];
      gross: number;
    }>();

    for (const item of allLineItems) {
      const entry = coachTotals.get(item.coach_id) || { items: [], gross: 0 };
      entry.items.push(item);
      entry.gross += item.gross_amount;
      coachTotals.set(item.coach_id, entry);
    }

    for (const [coachId, { items, gross }] of Array.from(coachTotals.entries())) {
      if (gross <= 0) continue;

      // Idempotency: check if payout already exists for this period + coach
      const { data: existing } = await supabaseAdmin
        .from('coach_payouts')
        .select('id')
        .eq('coach_id', coachId)
        .eq('payout_month_label', payoutPeriod)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Calculate TDS on the coach aggregate
      const ytd = await getCoachYTDEarnings(coachId, fyStart);
      const tds = calculateTDS(gross, ytd, config);

      // Session subtotals
      const sessionEarnings = items
        .filter(i => i.session_type === 'coaching' || i.session_type === 'skill_building')
        .reduce((s, i) => s + i.gross_amount, 0);
      const leadBonus = items
        .filter(i => i.session_type === 'lead_cost')
        .reduce((s, i) => s + i.gross_amount, 0);
      const reenrollBonus = items
        .filter(i => i.session_type === 'reenrollment_bonus')
        .reduce((s, i) => s + i.gross_amount, 0);
      const sessionsCount = items
        .filter(i => i.session_type === 'coaching' || i.session_type === 'skill_building')
        .length;

      const netAmount = gross - tds.tds_amount;
      const description = [
        sessionsCount > 0 ? `${sessionsCount} sessions` : '',
        leadBonus > 0 ? `lead ₹${leadBonus}` : '',
        reenrollBonus > 0 ? `re-enroll bonus ₹${reenrollBonus}` : '',
      ].filter(Boolean).join(', ');

      const { error: insertErr } = await supabaseAdmin.from('coach_payouts').insert({
        coach_id: coachId,
        gross_amount: gross,
        net_amount: netAmount,
        tds_amount: tds.tds_amount,
        tds_rate: tds.tds_applicable ? tds.tds_rate : 0,
        session_earnings: sessionEarnings,
        lead_bonus: leadBonus + reenrollBonus,
        sessions_count: sessionsCount,
        payout_month: 0,
        payout_month_label: payoutPeriod,
        payout_period: payoutPeriod,
        payout_type: 'monthly_coaching',
        session_type: 'coaching', // primary type
        description,
        scheduled_date: today,
        status: 'scheduled',
      });

      if (insertErr) {
        phase6.errors.push(`Insert failed for coach ${coachId}: ${insertErr.message}`);
        continue;
      }

      // Update coach TDS cumulative if applicable
      if (tds.tds_applicable) {
        const { data: coachData } = await supabaseAdmin
          .from('coaches')
          .select('tds_cumulative_fy')
          .eq('id', coachId)
          .single();

        await supabaseAdmin.from('coaches').update({
          tds_cumulative_fy: (Number(coachData?.tds_cumulative_fy) || 0) + gross,
          updated_at: new Date().toISOString(),
        }).eq('id', coachId);
      }

      phase6.count++;
      phase6.amount += netAmount;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    phase6.errors.push(`Phase 6 error: ${msg}`);
    globalErrors.push(`Phase 6: ${msg}`);
  }

  phases.push(phase6);

  return {
    payout_period: payoutPeriod,
    phases,
    total_coaches: phase6.count,
    total_payout_amount: phase6.amount,
    total_line_items: allLineItems.length,
    errors: globalErrors,
  };
}
