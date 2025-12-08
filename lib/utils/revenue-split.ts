/**
 * Revenue Split Utility
 * Handles the 70/30 split between coaches and platform
 */

// Revenue split percentages
const COACH_PERCENTAGE = 0.70; // 70% to coach
const PLATFORM_PERCENTAGE = 0.30; // 30% to Yestoryd

// Default coach ID (Rucha - founder)
const RUCHA_COACH_ID = 'coach_001';

export interface PaymentSplit {
  totalAmount: number;
  coachShare: number;
  platformShare: number;
  coachId: string;
  coachName?: string;
  isRucha: boolean;
  ruchaEarnings: number; // What Rucha specifically earns
}

/**
 * Calculate the revenue split for a coaching payment
 */
export function calculateRevenueSplit(
  amount: number,
  coachId: string,
  coachName?: string
): PaymentSplit {
  const coachShare = Math.round(amount * COACH_PERCENTAGE);
  const platformShare = amount - coachShare; // Ensures exact total
  const isRucha = coachId === RUCHA_COACH_ID;

  return {
    totalAmount: amount,
    coachShare,
    platformShare,
    coachId,
    coachName,
    isRucha,
    // Rucha earns BOTH shares when she's the coach, otherwise just platform share
    ruchaEarnings: isRucha ? amount : platformShare,
  };
}

/**
 * Get earnings summary for a coach
 */
export function getCoachEarningsSummary(payments: PaymentSplit[]): {
  totalEarnings: number;
  sessionCount: number;
  averagePerSession: number;
} {
  const totalEarnings = payments.reduce((sum, p) => sum + p.coachShare, 0);
  const sessionCount = payments.length;
  const averagePerSession = sessionCount > 0 ? Math.round(totalEarnings / sessionCount) : 0;

  return {
    totalEarnings,
    sessionCount,
    averagePerSession,
  };
}

/**
 * Get Rucha's earnings summary (as founder + coach)
 */
export function getRuchaEarningsSummary(allPayments: PaymentSplit[]): {
  asCoach: number;        // 70% from her own sessions
  asPlatformOwner: number; // 30% from ALL sessions
  totalEarnings: number;
  ownSessions: number;
  otherCoachSessions: number;
} {
  const ruchaSessions = allPayments.filter(p => p.isRucha);
  const otherSessions = allPayments.filter(p => !p.isRucha);

  const asCoach = ruchaSessions.reduce((sum, p) => sum + p.coachShare, 0);
  const asPlatformOwner = allPayments.reduce((sum, p) => sum + p.platformShare, 0);

  return {
    asCoach,
    asPlatformOwner,
    totalEarnings: asCoach + asPlatformOwner,
    ownSessions: ruchaSessions.length,
    otherCoachSessions: otherSessions.length,
  };
}

/**
 * Package pricing
 */
export const PACKAGES = {
  '6-sessions': {
    id: '6-sessions',
    name: '6 Coaching Sessions',
    price: 5999,
    sessions: 6,
    description: 'Personalized coaching with FREE access to all services',
    unlockServices: true,
    popular: true,
  },
  '2-sessions': {
    id: '2-sessions',
    name: '2 Additional Sessions',
    price: 1999,
    sessions: 2,
    description: 'Add more sessions to your package',
    unlockServices: false,
    popular: false,
  },
} as const;

export type PackageType = keyof typeof PACKAGES;

/**
 * Get package details
 */
export function getPackage(packageId: PackageType) {
  return PACKAGES[packageId];
}
