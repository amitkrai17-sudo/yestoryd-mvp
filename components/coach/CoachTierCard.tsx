// ============================================================
// FILE: components/coach/CoachTierCard.tsx
// ============================================================
// Shows coach's current tier, earnings split, and progress
// Add this to coach/dashboard/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Sprout,
  Star,
  Crown,
  Sparkles,
  TrendingUp,
  Users,
  IndianRupee,
  ChevronRight,
  Info,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoachTierData {
  group_name: string;
  display_name: string;
  coach_cost_percent: number;
  lead_cost_percent: number;
  badge_color: string;
  children_coached: number;
  next_tier: {
    name: string;
    display_name: string;
    children_required: number;
    coach_cost_percent: number;
  } | null;
}

// Tier icons and thresholds
const TIER_CONFIG: Record<string, { icon: any; threshold: number }> = {
  rising: { icon: Sprout, threshold: 0 },
  expert: { icon: Star, threshold: 30 },
  master: { icon: Crown, threshold: 75 },
  founding: { icon: Sparkles, threshold: 0 },
};

const NEXT_TIER: Record<string, string> = {
  rising: 'expert',
  expert: 'master',
  master: '', // No next tier
  founding: '', // Special tier
};

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
      // Get coach with group
      const { data: coach } = await supabase
        .from('coaches')
        .select(`
          id,
          group_id,
          coach_groups (
            name,
            display_name,
            coach_cost_percent,
            lead_cost_percent,
            badge_color
          )
        `)
        .eq('id', coachId)
        .single();

      // Count children coached
      const { count: childrenCoached } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coachId)
        .eq('status', 'active');

      // Get all groups for next tier info
      const { data: allGroups } = await supabase
        .from('coach_groups')
        .select('name, display_name, coach_cost_percent')
        .order('sort_order');

      const coachGroup = (coach?.coach_groups as any) || {
        name: 'rising',
        display_name: 'Rising Coach',
        coach_cost_percent: 50,
        lead_cost_percent: 20,
        badge_color: '#22c55e',
      };

      const nextTierName = NEXT_TIER[coachGroup.name];
      const nextTierData = nextTierName
        ? allGroups?.find((g) => g.name === nextTierName)
        : null;

      setTierData({
        group_name: coachGroup.name,
        display_name: coachGroup.display_name,
        coach_cost_percent: coachGroup.coach_cost_percent,
        lead_cost_percent: coachGroup.lead_cost_percent,
        badge_color: coachGroup.badge_color,
        children_coached: childrenCoached || 0,
        next_tier: nextTierData
          ? {
              name: nextTierData.name,
              display_name: nextTierData.display_name,
              children_required: TIER_CONFIG[nextTierData.name]?.threshold || 0,
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

  const TierIcon = TIER_CONFIG[tierData.group_name]?.icon || Sprout;
  const ENROLLMENT_AMOUNT = 5999;
  const coachEarnings = Math.round(ENROLLMENT_AMOUNT * tierData.coach_cost_percent / 100);
  const coachEarningsWithLead = Math.round(
    ENROLLMENT_AMOUNT * (tierData.coach_cost_percent + tierData.lead_cost_percent) / 100
  );

  // Progress calculation
  const nextThreshold = tierData.next_tier?.children_required || 0;
  const currentThreshold = TIER_CONFIG[tierData.group_name]?.threshold || 0;
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

      {/* Earnings Info */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Yestoryd Lead</p>
            <p className="text-2xl font-bold text-emerald-400">
              ₹{coachEarnings.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm">{tierData.coach_cost_percent}% per enrollment</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 rounded-xl p-4 border border-emerald-700/50">
            <p className="text-emerald-400 text-xs uppercase tracking-wide mb-1">Your Lead</p>
            <p className="text-2xl font-bold text-emerald-300">
              ₹{coachEarningsWithLead.toLocaleString()}
            </p>
            <p className="text-emerald-500/70 text-sm">
              {tierData.coach_cost_percent + tierData.lead_cost_percent}% with referral
            </p>
          </div>
        </div>
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