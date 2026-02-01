// ============================================================
// Refund Calculator — Pure functions, no DB calls
// ============================================================

export interface RefundCalculation {
  refundAmount: number;
  coachCost: number;
  refundType: 'full' | 'pro_rata' | 'none';
}

/**
 * Check if enrollment qualifies for a full refund:
 * - Payment made within last 24 hours AND zero sessions completed
 */
export function isFullRefundEligible(
  paymentDate: Date,
  sessionsCompleted: number
): boolean {
  const hoursSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60);
  return hoursSincePayment <= 24 && sessionsCompleted === 0;
}

/**
 * Calculate refund amount using pro-rata logic.
 *
 * Full refund: 100% of original amount (if eligible)
 * Pro-rata: Refund for unused sessions minus coach cost for completed sessions
 * None: All sessions completed, no refund
 */
export function calculateRefund(
  originalAmount: number,
  sessionsTotal: number,
  sessionsCompleted: number,
  coachCostPercent: number
): RefundCalculation {
  if (sessionsTotal <= 0) {
    return { refundAmount: 0, coachCost: 0, refundType: 'none' };
  }

  if (sessionsCompleted >= sessionsTotal) {
    return { refundAmount: 0, coachCost: originalAmount * (coachCostPercent / 100), refundType: 'none' };
  }

  if (sessionsCompleted === 0) {
    return { refundAmount: originalAmount, coachCost: 0, refundType: 'full' };
  }

  // Pro-rata: refund unused portion minus coach cost for completed sessions
  const perSession = originalAmount / sessionsTotal;
  const coachCost = Math.round(perSession * sessionsCompleted * (coachCostPercent / 100) * 100) / 100;
  const unusedAmount = Math.round(perSession * (sessionsTotal - sessionsCompleted) * 100) / 100;
  const refundAmount = Math.max(0, unusedAmount);

  return { refundAmount, coachCost, refundType: 'pro_rata' };
}
