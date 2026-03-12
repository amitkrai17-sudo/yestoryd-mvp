// ============================================================
// FILE: components/coach/CoachTierCard.tsx
// ============================================================
// Shows coach's current tier, earnings split (coaching + skill building), and progress.
// All business values from DB: coach_groups, pricing_plans, age_band_config, site_settings.

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Sprout,
  Star,
  Crown,
  Sparkles,
  TrendingUp,
  Users,
  Info,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoachTierData {
  group_name: string;
  display_name: string;
  coach_cost_percent: number;
  lead_cost_percent: number;
  badge_color: string;
  children_coached: number;
  // Pricing
  enrollment_amount: number;
  // Session counts (Foundation band = representative)
  coaching_sessions: number;
  skill_building_sessions: number;
  // Computed rates (same rounding as payout-config.ts calculatePerSessionRate)
  coaching_rate: number;
  skill_building_rate: number;
  sb_rate_multiplier: number;
  // Totals
  coaching_total: number;
  skill_building_total: number;
  coach_earnings: number;       // coaching_total + skill_building_total
  coach_earnings_with_lead: number; // coach_earnings + lead referral amount
  effective_percent: number;    // coach_earnings / enrollment_amount × 100
  effective_percent_with_lead: number;
  lead_referrer_percent: number;
  current_threshold: number;
  // Next tier
  next_tier: {
    name: string;
    display_name: string;
    children_required: number;
    coach_cost_percent: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Icon mapping per tier name
const TIER_ICONS: Record<string, any> = {
  rising: Sprout,
  expert: Star,
  master: Crown,
  founding: Sparkles,
};

// Progression path: rising → expert → master. Founding/internal have no next tier.
const NEXT_TIER: Record<string, string> = {
  rising: 'expert',
  expert: 'master',
  master: '',
  founding: '',
};

// Last-resort fallbacks (DB should always have values)
const FALLBACK_ENROLLMENT_AMOUNT = 0;
const FALLBACK_COACHING_SESSIONS = 18;   // Foundation band
const FALLBACK_SB_SESSIONS = 6;          // Foundation band skill_booster_credits
const FALLBACK_SB_MULTIPLIER = 0.50;
const FALLBACK_LEAD_REFERRER_PERCENT = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CoachTierCardProps {
  coachId: string;
  coachEmail: string;
}

export default function CoachTierCard({ coachId, coachEmail }: CoachTierCardProps) {
  const [tierData, setTierData] = useState<CoachTierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    fetchTierData();
  }, [coachId]);

  async function fetchTierData() {
    try {
      // Fetch all data sources in parallel
      const [coachResult, childrenResult, allGroupsResult, pricingResult, ageBandResult, settingsResult] = await Promise.all([
        // Coach + group join
        supabase
          .from('coaches')
          .select(`
            id, group_id,
            coach_groups (
              name, display_name,
              coach_cost_percent, lead_cost_percent,
              badge_color
            )
          `)
          .eq('id', coachId)
          .single(),
        // Active children count
        supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coachId)
          .eq('status', 'active'),
        // All groups for next tier info + progression thresholds
        supabase
          .from('coach_groups')
          .select('*')
          .order('sort_order'),
        // Plan price (Full Program)
        supabase
          .from('pricing_plans')
          .select('discounted_price')
          .eq('is_active', true)
          .eq('slug', 'full')
          .single(),
        // Foundation age band (representative — highest sessions = best earnings display)
        supabase
          .from('age_band_config')
          .select('sessions_per_season, skill_booster_credits')
          .eq('id', 'foundation')
          .single(),
        // Site settings for SB multiplier + lead referrer percent
        supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['skill_building_rate_multiplier', 'lead_cost_referrer_percent_coach']),
      ]);

      // ---------------------------------------------------------------
      // Resolve enrollment amount: pricing_plans → site_settings → fallback
      // ---------------------------------------------------------------
      let enrollmentAmount = FALLBACK_ENROLLMENT_AMOUNT;
      if (pricingResult.data?.discounted_price) {
        enrollmentAmount = pricingResult.data.discounted_price;
      } else {
        console.warn('[CoachTierCard] pricing_plans fetch failed, trying site_settings');
        const { data: settingRow } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'default_program_price')
          .single();
        const parsed = Number(settingRow?.value);
        if (!isNaN(parsed) && parsed > 0) {
          enrollmentAmount = parsed;
        } else {
          console.warn('[CoachTierCard] all price sources failed, using fallback', FALLBACK_ENROLLMENT_AMOUNT);
        }
      }

      // ---------------------------------------------------------------
      // Resolve session counts from age_band_config
      // ---------------------------------------------------------------
      let coachingSessions = FALLBACK_COACHING_SESSIONS;
      let skillBuildingSessions = FALLBACK_SB_SESSIONS;
      if (ageBandResult.data) {
        coachingSessions = ageBandResult.data.sessions_per_season || FALLBACK_COACHING_SESSIONS;
        skillBuildingSessions = ageBandResult.data.skill_booster_credits || FALLBACK_SB_SESSIONS;
      } else {
        console.warn('[CoachTierCard] age_band_config fetch failed, using Foundation fallbacks');
      }

      // ---------------------------------------------------------------
      // Resolve site_settings values
      // ---------------------------------------------------------------
      const settingsMap = new Map<string, string>();
      for (const row of settingsResult.data || []) {
        settingsMap.set(row.key, row.value as string);
      }
      const sbMultiplier = Number(settingsMap.get('skill_building_rate_multiplier')) || FALLBACK_SB_MULTIPLIER;
      const leadReferrerPercent = Number(settingsMap.get('lead_cost_referrer_percent_coach')) || FALLBACK_LEAD_REFERRER_PERCENT;

      // ---------------------------------------------------------------
      // Coach group
      // ---------------------------------------------------------------
      const coachGroup = (coachResult.data?.coach_groups as any) || {
        name: 'rising',
        display_name: 'Rising Coach',
        coach_cost_percent: 50,
        lead_cost_percent: 10,
        badge_color: '#22c55e',
      };

      const coachCostPercent = Number(coachGroup.coach_cost_percent) || 50;
      const leadCostPercent = Number(coachGroup.lead_cost_percent) || 10;

      // ---------------------------------------------------------------
      // Calculate rates — SAME rounding as calculatePerSessionRate() in payout-config.ts
      //   coachingRate = Math.round((enrollmentAmount * coachPercent / 100) / coachingSessions)
      //   skillBuildingRate = Math.round(coachingRate * sbMultiplier)
      // ---------------------------------------------------------------
      const coachingRate = Math.round((enrollmentAmount * coachCostPercent / 100) / coachingSessions);
      const skillBuildingRate = Math.round(coachingRate * sbMultiplier);

      const coachingTotal = coachingRate * coachingSessions;
      const skillBuildingTotal = skillBuildingRate * skillBuildingSessions;
      const coachEarnings = coachingTotal + skillBuildingTotal;

      const leadAmount = Math.round(enrollmentAmount * leadReferrerPercent / 100);
      const coachEarningsWithLead = coachEarnings + leadAmount;

      const effectivePercent = Math.round(coachEarnings / enrollmentAmount * 100);
      const effectivePercentWithLead = Math.round(coachEarningsWithLead / enrollmentAmount * 100);

      // ---------------------------------------------------------------
      // Next tier
      // ---------------------------------------------------------------
      // Resolve current tier threshold from DB
      const currentGroup = allGroupsResult.data?.find((g: any) => g.name === coachGroup.name);
      const currentThresholdFromDB = (currentGroup as any)?.min_children_threshold ?? 0;

      const nextTierName = NEXT_TIER[coachGroup.name];
      const nextTierData = nextTierName
        ? allGroupsResult.data?.find((g: any) => g.name === nextTierName)
        : null;

      setTierData({
        group_name: coachGroup.name,
        display_name: coachGroup.display_name,
        coach_cost_percent: coachCostPercent,
        lead_cost_percent: leadCostPercent,
        badge_color: coachGroup.badge_color,
        children_coached: childrenResult.count || 0,
        enrollment_amount: enrollmentAmount,
        coaching_sessions: coachingSessions,
        skill_building_sessions: skillBuildingSessions,
        coaching_rate: coachingRate,
        skill_building_rate: skillBuildingRate,
        sb_rate_multiplier: sbMultiplier,
        coaching_total: coachingTotal,
        skill_building_total: skillBuildingTotal,
        coach_earnings: coachEarnings,
        coach_earnings_with_lead: coachEarningsWithLead,
        effective_percent: effectivePercent,
        effective_percent_with_lead: effectivePercentWithLead,
        lead_referrer_percent: leadReferrerPercent,
        current_threshold: currentThresholdFromDB,
        next_tier: nextTierData
          ? {
              name: nextTierData.name,
              display_name: nextTierData.display_name,
              children_required: (nextTierData as any).min_children_threshold ?? 0,
              coach_cost_percent: nextTierData.coach_cost_percent,
            }
          : null,
      });
    } catch (error) {
      console.error('Error fetching tier data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  if (!tierData) return null;

  const TierIcon = TIER_ICONS[tierData.group_name] || Sprout;

  // Progress calculation using DB thresholds
  const nextThreshold = tierData.next_tier?.children_required || 0;
  const currentThreshold = tierData.current_threshold;
  const progress = tierData.next_tier
    ? Math.min(
        100,
        ((tierData.children_coached - currentThreshold) /
          (nextThreshold - currentThreshold)) *
          100
      )
    : 100;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="p-6 pb-4"
        style={{
          background: `linear-gradient(135deg, ${tierData.badge_color}20, transparent)`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: tierData.badge_color }}
            >
              <TierIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{tierData.display_name}</h3>
              <p className="text-gray-400 text-sm">Your current tier</p>
            </div>
          </div>
          <button
            className="text-gray-400 hover:text-white transition-colors relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info className="w-5 h-5" />
            {showTooltip && (
              <div className="absolute right-0 top-8 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl z-10">
                <p className="text-sm text-gray-300">
                  Your tier determines your earnings per enrollment. Tier upgrades are based on
                  performance and children coached.
                </p>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Earnings Cards */}
      <div className="px-6 pb-3">
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1: Yestoryd Lead */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Yestoryd Lead</p>
            <p className="text-2xl font-bold text-emerald-400">
              ₹{tierData.coach_earnings.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm">{tierData.effective_percent}% per enrollment*</p>
          </div>
          {/* Card 2: Your Lead */}
          <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 rounded-xl p-4 border border-emerald-700/50">
            <p className="text-emerald-400 text-xs uppercase tracking-wide mb-1">Your Lead</p>
            <p className="text-2xl font-bold text-emerald-300">
              ₹{tierData.coach_earnings_with_lead.toLocaleString()}
            </p>
            <p className="text-emerald-500/70 text-sm">
              {tierData.effective_percent_with_lead}% with referral*
            </p>
          </div>
        </div>
      </div>

      {/* Card 3: Skill Building line */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-700/50">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-gray-400 text-xs">
            Includes {tierData.skill_building_sessions} skill building sessions @ ₹{tierData.skill_building_rate}/session
            <span className="text-gray-600"> ({Math.round(tierData.sb_rate_multiplier * 100)}% of coaching rate)</span>
          </p>
        </div>
        <p className="text-gray-600 text-xs mt-2">
          *Based on Full Program (₹{tierData.enrollment_amount.toLocaleString()}). Includes coaching + skill building sessions. Varies by age band.
        </p>
      </div>

      {/* Progress Section */}
      {tierData.next_tier && (
        <div className="px-6 pb-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300 text-sm">Progress to {tierData.next_tier.display_name}</span>
              </div>
              <span className="text-gray-400 text-sm">
                {tierData.children_coached}/{tierData.next_tier.children_required} children
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: tierData.badge_color,
                }}
              />
            </div>

            {/* Next Tier Preview */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {tierData.next_tier.children_required - tierData.children_coached} more to unlock
              </span>
              <div className="flex items-center gap-1 text-amber-400">
                <TrendingUp className="w-4 h-4" />
                <span>+{tierData.next_tier.coach_cost_percent - tierData.coach_cost_percent}% earnings</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Already at Max Tier */}
      {!tierData.next_tier && tierData.group_name !== 'internal' && (
        <div className="px-6 pb-6">
          <div className="bg-gradient-to-r from-amber-900/20 to-yellow-900/20 rounded-xl p-4 border border-amber-700/30">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-amber-300 font-medium">You've reached the top tier!</p>
                <p className="text-amber-500/70 text-sm">
                  {tierData.children_coached} children coached • Maximum earnings unlocked
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
