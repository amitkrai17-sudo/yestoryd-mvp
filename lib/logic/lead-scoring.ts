// ============================================================
// FILE: lib/logic/lead-scoring.ts
// ============================================================
// Centralized Lead Scoring Logic
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// SINGLE SOURCE OF TRUTH for lead score calculation
// Used by:
// - /api/assessment/analyze (on new assessment)
// - /api/leads/hot-alert (batch recalculation)
// - /api/webhooks/recall (post-session updates)
// - Database triggers (if needed)
// ============================================================

export interface LeadScoringInput {
  latestAssessmentScore: number | null;
  age: number | null;
  hasDiscoveryCall: boolean;
  hasActiveEnrollment: boolean;
  daysSinceAssessment?: number;
}

export interface LeadScoringResult {
  score: number;
  status: 'new' | 'warm' | 'hot' | 'converted' | 'cold';
  breakdown: {
    baseScore: number;
    assessmentBonus: number;
    ageBonus: number;
    discoveryBonus: number;
    enrollmentBonus: number;
    recencyPenalty: number;
  };
}

// ============================================================
// SCORING CONFIGURATION
// Adjust these values to tune lead scoring
// ============================================================
export const SCORING_CONFIG = {
  // Base score for all leads
  BASE_SCORE: 10,

  // Assessment score bonuses
  ASSESSMENT: {
    VERY_LOW: { threshold: 3, bonus: 50 },    // Score 0-3: +50 (high need)
    LOW: { threshold: 5, bonus: 30 },          // Score 4-5: +30
    MEDIUM: { threshold: 7, bonus: 15 },       // Score 6-7: +15
    HIGH: { threshold: 10, bonus: 5 },         // Score 8-10: +5 (less need)
  },

  // Age bonuses (target demographic)
  AGE: {
    PRIMARY_TARGET: { min: 4, max: 7, bonus: 15 },   // 4-7 years: +15
    SECONDARY_TARGET: { min: 8, max: 10, bonus: 10 }, // 8-10 years: +10
  },

  // Engagement bonuses
  DISCOVERY_CALL_BONUS: 40,
  ENROLLMENT_BONUS: 100,

  // Recency penalty (days since assessment)
  RECENCY: {
    STALE_AFTER_DAYS: 14,
    PENALTY_PER_WEEK: 5,
    MAX_PENALTY: 20,
  },

  // Status thresholds
  STATUS_THRESHOLDS: {
    HOT: 60,
    WARM: 30,
    COLD_AFTER_DAYS: 30,
  },
};

// ============================================================
// MAIN SCORING FUNCTION
// ============================================================
export function calculateLeadScore(input: LeadScoringInput): LeadScoringResult {
  const {
    latestAssessmentScore,
    age,
    hasDiscoveryCall,
    hasActiveEnrollment,
    daysSinceAssessment = 0,
  } = input;

  const config = SCORING_CONFIG;
  
  // Initialize breakdown
  const breakdown = {
    baseScore: config.BASE_SCORE,
    assessmentBonus: 0,
    ageBonus: 0,
    discoveryBonus: 0,
    enrollmentBonus: 0,
    recencyPenalty: 0,
  };

  // 1. Assessment score bonus (lower score = higher need = higher lead score)
  if (latestAssessmentScore !== null) {
    if (latestAssessmentScore <= config.ASSESSMENT.VERY_LOW.threshold) {
      breakdown.assessmentBonus = config.ASSESSMENT.VERY_LOW.bonus;
    } else if (latestAssessmentScore <= config.ASSESSMENT.LOW.threshold) {
      breakdown.assessmentBonus = config.ASSESSMENT.LOW.bonus;
    } else if (latestAssessmentScore <= config.ASSESSMENT.MEDIUM.threshold) {
      breakdown.assessmentBonus = config.ASSESSMENT.MEDIUM.bonus;
    } else {
      breakdown.assessmentBonus = config.ASSESSMENT.HIGH.bonus;
    }
  }

  // 2. Age bonus (target demographic)
  if (age !== null) {
    const primaryTarget = config.AGE.PRIMARY_TARGET;
    const secondaryTarget = config.AGE.SECONDARY_TARGET;

    if (age >= primaryTarget.min && age <= primaryTarget.max) {
      breakdown.ageBonus = primaryTarget.bonus;
    } else if (age >= secondaryTarget.min && age <= secondaryTarget.max) {
      breakdown.ageBonus = secondaryTarget.bonus;
    }
  }

  // 3. Discovery call bonus
  if (hasDiscoveryCall) {
    breakdown.discoveryBonus = config.DISCOVERY_CALL_BONUS;
  }

  // 4. Enrollment bonus (highest priority)
  if (hasActiveEnrollment) {
    breakdown.enrollmentBonus = config.ENROLLMENT_BONUS;
  }

  // 5. Recency penalty (stale leads lose points)
  if (daysSinceAssessment > config.RECENCY.STALE_AFTER_DAYS) {
    const weeksStale = Math.floor(
      (daysSinceAssessment - config.RECENCY.STALE_AFTER_DAYS) / 7
    );
    breakdown.recencyPenalty = Math.min(
      weeksStale * config.RECENCY.PENALTY_PER_WEEK,
      config.RECENCY.MAX_PENALTY
    );
  }

  // Calculate total score
  const score = Math.max(
    0,
    breakdown.baseScore +
      breakdown.assessmentBonus +
      breakdown.ageBonus +
      breakdown.discoveryBonus +
      breakdown.enrollmentBonus -
      breakdown.recencyPenalty
  );

  // Determine status
  let status: LeadScoringResult['status'];
  
  if (hasActiveEnrollment) {
    status = 'converted';
  } else if (daysSinceAssessment > config.STATUS_THRESHOLDS.COLD_AFTER_DAYS && score < config.STATUS_THRESHOLDS.WARM) {
    status = 'cold';
  } else if (score >= config.STATUS_THRESHOLDS.HOT) {
    status = 'hot';
  } else if (score >= config.STATUS_THRESHOLDS.WARM) {
    status = 'warm';
  } else {
    status = 'new';
  }

  return { score, status, breakdown };
}

// ============================================================
// HELPER: Check if lead is hot
// ============================================================
export function isHotLead(input: LeadScoringInput): boolean {
  const result = calculateLeadScore(input);
  return result.status === 'hot';
}

// ============================================================
// HELPER: Get urgency level for alerts
// ============================================================
export function getLeadUrgency(input: LeadScoringInput): 'urgent' | 'high' | 'medium' | 'low' {
  const { latestAssessmentScore } = input;
  const result = calculateLeadScore(input);

  // Very low assessment score = urgent
  if (latestAssessmentScore !== null && latestAssessmentScore <= 3 && result.status === 'hot') {
    return 'urgent';
  }

  if (result.status === 'hot') {
    return 'high';
  }

  if (result.status === 'warm') {
    return 'medium';
  }

  return 'low';
}
