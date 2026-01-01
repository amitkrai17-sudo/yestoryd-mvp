// lib/business/revenue-split.ts
// Centralized revenue split calculations
// Single source of truth for all payment distributions

export type LeadSource = 'coach' | 'yestoryd' | 'rucha';

export interface RevenueSplitResult {
  coachAmount: number;
  platformAmount: number;
  coachPercentage: number;
  platformPercentage: number;
  tdsAmount: number;
  coachNetAmount: number;
  source: LeadSource;
}

// Revenue split percentages by source
const SPLIT_CONFIG = {
  coach: { coach: 70, platform: 30 },      // Coach-sourced leads
  yestoryd: { coach: 50, platform: 50 },   // Platform-sourced leads
  rucha: { coach: 0, platform: 100 },      // Rucha's direct coaching
} as const;

// TDS rate for coach payments (as per Indian tax law)
const TDS_RATE = 0.10; // 10% TDS on professional services

/**
 * Calculate revenue split based on lead source
 * @param totalAmount - Total payment amount in INR
 * @param source - Who sourced the lead (coach, yestoryd, or rucha)
 * @returns Detailed breakdown of revenue split
 */
export function calculateRevenueSplit(
  totalAmount: number,
  source: LeadSource
): RevenueSplitResult {
  const config = SPLIT_CONFIG[source];
  
  const coachPercentage = config.coach;
  const platformPercentage = config.platform;
  
  const coachAmount = Math.round((totalAmount * coachPercentage) / 100);
  const platformAmount = totalAmount - coachAmount; // Ensure no rounding errors
  
  // TDS is deducted from coach's share
  const tdsAmount = source !== 'rucha' ? Math.round(coachAmount * TDS_RATE) : 0;
  const coachNetAmount = coachAmount - tdsAmount;
  
  return {
    coachAmount,
    platformAmount,
    coachPercentage,
    platformPercentage,
    tdsAmount,
    coachNetAmount,
    source,
  };
}

/**
 * Determine lead source from discovery call or enrollment data
 */
export function determineLeadSource(data: {
  referralCode?: string | null;
  coachId?: string | null;
  assignedBy?: string | null;
}): LeadSource {
  // If coach has a referral code that was used → coach-sourced
  if (data.referralCode) {
    return 'coach';
  }
  
  // If Rucha is the assigned coach → rucha
  // Note: Replace with actual Rucha's coach ID from your database
  const RUCHA_COACH_ID = process.env.RUCHA_COACH_ID;
  if (data.coachId === RUCHA_COACH_ID) {
    return 'rucha';
  }
  
  // Default: platform-sourced
  return 'yestoryd';
}

/**
 * Format revenue split for display
 */
export function formatSplitForDisplay(split: RevenueSplitResult): {
  coach: string;
  platform: string;
  tds: string;
  net: string;
} {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  
  return {
    coach: formatter.format(split.coachAmount),
    platform: formatter.format(split.platformAmount),
    tds: formatter.format(split.tdsAmount),
    net: formatter.format(split.coachNetAmount),
  };
}

/**
 * Generate payout summary for a list of enrollments
 */
export function generatePayoutSummary(
  enrollments: Array<{ amount: number; source: LeadSource }>
): {
  totalRevenue: number;
  totalCoachPayout: number;
  totalPlatformRevenue: number;
  totalTDS: number;
  bySource: Record<LeadSource, { count: number; amount: number }>;
} {
  const bySource: Record<LeadSource, { count: number; amount: number }> = {
    coach: { count: 0, amount: 0 },
    yestoryd: { count: 0, amount: 0 },
    rucha: { count: 0, amount: 0 },
  };
  
  let totalCoachPayout = 0;
  let totalPlatformRevenue = 0;
  let totalTDS = 0;
  let totalRevenue = 0;
  
  for (const enrollment of enrollments) {
    const split = calculateRevenueSplit(enrollment.amount, enrollment.source);
    
    totalRevenue += enrollment.amount;
    totalCoachPayout += split.coachNetAmount;
    totalPlatformRevenue += split.platformAmount;
    totalTDS += split.tdsAmount;
    
    bySource[enrollment.source].count++;
    bySource[enrollment.source].amount += enrollment.amount;
  }
  
  return {
    totalRevenue,
    totalCoachPayout,
    totalPlatformRevenue,
    totalTDS,
    bySource,
  };
}
