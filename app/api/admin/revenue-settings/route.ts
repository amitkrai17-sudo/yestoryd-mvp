// =============================================================================
// GET/PATCH /api/admin/revenue-settings
// Unified revenue config for all products: coaching, tuition, workshop, payout.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import {
  loadPayoutConfig,
  invalidatePayoutConfigCache,
  getTuitionCoachPercent,
} from '@/lib/config/payout-config';

export const dynamic = 'force-dynamic';

// ---- GET: Read all revenue config ----
export const GET = withApiHandler(async (_req, { supabase }) => {
  const config = await loadPayoutConfig();

  // Coaching tiers from coach_groups
  const { data: groups } = await supabase
    .from('coach_groups')
    .select('id, name, display_name, lead_cost_percent, coach_cost_percent, platform_fee_percent, is_internal, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const coachingTiers = (groups || []).map(g => ({
    id: g.id,
    name: g.name,
    display: g.display_name || g.name,
    leadPercent: Number(g.lead_cost_percent) || 0,
    coachPercent: Number(g.coach_cost_percent) || 0,
    platformPercent: Number(g.platform_fee_percent) || 0,
    isInternal: g.is_internal,
  }));

  // Tuition tiers from site_settings (via config)
  const tuitionTiers = ['rising', 'expert', 'master', 'founding'].map(tier => {
    const coachPct = getTuitionCoachPercent(tier, config);
    const leadPct = config.tuition_lead_cost_percent;
    return {
      name: tier,
      coachPercent: coachPct,
      leadPercent: leadPct,
      platformPercent: 100 - coachPct - leadPct,
    };
  });

  return NextResponse.json({
    coaching: { tiers: coachingTiers, source: 'coach_groups' },
    tuition: {
      tiers: tuitionTiers,
      leadPercent: config.tuition_lead_cost_percent,
      payoutTrigger: config.tuition_payout_trigger,
      guardrails: {
        batch: {
          min: config.tuition_rate_min_batch_per_hour,
          max: config.tuition_rate_max_batch_per_hour,
          warnLow: config.tuition_rate_warn_low_batch,
          warnHigh: config.tuition_rate_warn_high_batch,
        },
        individual: {
          min: config.tuition_rate_min_individual_per_hour,
          max: config.tuition_rate_max_individual_per_hour,
          warnLow: config.tuition_rate_warn_low_individual,
          warnHigh: config.tuition_rate_warn_high_individual,
        },
      },
      source: 'site_settings',
    },
    workshop: {
      defaultCoachPercent: config.workshop_default_coach_percent,
      leadPercent: config.workshop_lead_cost_percent,
      source: 'site_settings',
    },
    payout: {
      dayOfMonth: config.payout_day_of_month,
      tdsRate: config.tds_rate_percent,
      tdsThreshold: config.tds_threshold_annual,
      skillBuildingMultiplier: config.skill_building_rate_multiplier,
      reenrollmentBonus: config.reenrollment_coach_bonus,
      reenrollmentBonusEnabled: config.reenrollment_coach_bonus_enabled,
    },
  });
}, { auth: 'admin' });

// ---- PATCH: Update revenue config ----
export const PATCH = withApiHandler(async (req: NextRequest, { supabase, requestId }) => {
  const body = await req.json();
  const updates: { key: string; value: string }[] = [];
  const errors: string[] = [];

  // Helper: validate percentages
  const validateSplit = (lead: number, coach: number, label: string) => {
    if (coach <= 0 || coach > 90) errors.push(`${label}: coach must be 1-90%`);
    if (lead < 0 || lead > 30) errors.push(`${label}: lead must be 0-30%`);
    if (lead + coach > 100) errors.push(`${label}: lead + coach cannot exceed 100%`);
  };

  // Tuition updates → site_settings
  if (body.tuition) {
    const t = body.tuition;

    // Tier splits
    for (const tier of ['rising', 'expert', 'master', 'founding']) {
      if (t[tier]?.coachPercent != null) {
        const coach = Number(t[tier].coachPercent);
        validateSplit(t[tier]?.leadPercent ?? 10, coach, `Tuition ${tier}`);
        updates.push({ key: `tuition_coach_cost_${tier}`, value: String(coach) });
      }
    }

    // Lead percent (shared across tuition tiers)
    if (t.leadPercent != null) {
      const lead = Number(t.leadPercent);
      if (lead < 0 || lead > 30) errors.push('Tuition lead must be 0-30%');
      else updates.push({ key: 'tuition_lead_cost_percent', value: String(lead) });
    }

    // Guardrails
    if (t.guardrails) {
      for (const type of ['batch', 'individual'] as const) {
        const g = t.guardrails[type];
        if (!g) continue;
        const prefix = type === 'batch' ? 'tuition_rate' : 'tuition_rate';
        const suffix = type === 'batch' ? 'batch' : 'individual';

        if (g.min != null) updates.push({ key: `${prefix}_min_${suffix}_per_hour`, value: String(g.min) });
        if (g.max != null) updates.push({ key: `${prefix}_max_${suffix}_per_hour`, value: String(g.max) });
        if (g.warnLow != null) updates.push({ key: `${prefix}_warn_low_${suffix}`, value: String(g.warnLow) });
        if (g.warnHigh != null) updates.push({ key: `${prefix}_warn_high_${suffix}`, value: String(g.warnHigh) });

        // Validate ordering
        const min = g.min, wl = g.warnLow, wh = g.warnHigh, max = g.max;
        if (min != null && wl != null && min >= wl) errors.push(`${type}: min must be < warn low`);
        if (wl != null && wh != null && wl >= wh) errors.push(`${type}: warn low must be < warn high`);
        if (wh != null && max != null && wh >= max) errors.push(`${type}: warn high must be < max`);
      }
    }
  }

  // Workshop updates → site_settings
  if (body.workshop) {
    if (body.workshop.defaultCoachPercent != null) {
      const pct = Number(body.workshop.defaultCoachPercent);
      if (pct <= 0 || pct > 90) errors.push('Workshop coach must be 1-90%');
      else updates.push({ key: 'workshop_default_coach_percent', value: String(pct) });
    }
  }

  // Payout updates → site_settings
  if (body.payout) {
    if (body.payout.dayOfMonth != null) {
      const d = Number(body.payout.dayOfMonth);
      if (d < 1 || d > 28) errors.push('Payout day must be 1-28');
      else updates.push({ key: 'payout_day_of_month', value: String(d) });
    }
    if (body.payout.tdsRate != null) {
      updates.push({ key: 'tds_rate_percent', value: String(body.payout.tdsRate) });
    }
    if (body.payout.tdsThreshold != null) {
      updates.push({ key: 'tds_threshold_annual', value: String(body.payout.tdsThreshold) });
    }
    if (body.payout.reenrollmentBonus != null) {
      updates.push({ key: 'reenrollment_coach_bonus', value: String(body.payout.reenrollmentBonus) });
    }
  }

  // Coaching tier updates → coach_groups table
  if (body.coaching) {
    for (const [tierName, values] of Object.entries(body.coaching)) {
      const v = values as { coachPercent?: number; leadPercent?: number };
      if (v.coachPercent == null && v.leadPercent == null) continue;

      validateSplit(v.leadPercent ?? 20, v.coachPercent ?? 50, `Coaching ${tierName}`);

      const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (v.coachPercent != null) {
        updateFields.coach_cost_percent = v.coachPercent;
        updateFields.platform_fee_percent = 100 - (v.coachPercent) - (v.leadPercent ?? 20);
      }
      if (v.leadPercent != null) {
        updateFields.lead_cost_percent = v.leadPercent;
        if (v.coachPercent == null) {
          // Recalculate platform from existing coach
          const { data: existing } = await supabase
            .from('coach_groups')
            .select('coach_cost_percent')
            .eq('name', tierName)
            .single();
          if (existing) {
            updateFields.platform_fee_percent = 100 - Number(existing.coach_cost_percent) - v.leadPercent;
          }
        }
      }

      const { error: groupErr } = await supabase
        .from('coach_groups')
        .update(updateFields)
        .eq('name', tierName);

      if (groupErr) errors.push(`Failed to update coaching tier ${tierName}: ${groupErr.message}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  // Write site_settings updates
  if (updates.length > 0) {
    for (const u of updates) {
      const { error } = await supabase
        .from('site_settings')
        .update({ value: u.value, updated_at: new Date().toISOString() })
        .eq('key', u.key);

      if (error) errors.push(`Failed to update ${u.key}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Partial failure', details: errors }, { status: 500 });
  }

  // Invalidate cache so Calculator B picks up new values
  invalidatePayoutConfigCache();

  // Activity log
  await supabase.from('activity_log').insert({
    action: 'revenue_settings_updated',
    user_email: 'admin',
    user_type: 'admin',
    metadata: {
      request_id: requestId,
      site_settings_updated: updates.map(u => u.key),
      coaching_tiers_updated: body.coaching ? Object.keys(body.coaching) : [],
    },
  });

  return NextResponse.json({ success: true, updatedKeys: updates.length });
}, { auth: 'admin' });
