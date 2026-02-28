// ============================================================
// Intelligence Score Computation
// Pure functions — no DB access, no side effects.
// ============================================================

import type { CaptureMethod, SignalConfidence } from './types';

// ============================================================
// Default weights (used when site_settings unavailable)
// ============================================================

export interface IntelligenceWeights {
  skillCoverage: number;   // S1: skills_covered present
  performance: number;     // S2: skill_performances with ratings
  childArtifact: number;   // S3: has child artifact
  observations: number;    // S4: has strength OR struggle observations
  engagement: number;      // S5: engagement level present (always 100)
}

export const DEFAULT_WEIGHTS: IntelligenceWeights = {
  skillCoverage: 0.25,
  performance: 0.30,
  childArtifact: 0.15,
  observations: 0.20,
  engagement: 0.10,
};

// ============================================================
// Score Computation
// ============================================================

export interface SignalInputs {
  hasSkillsCovered: boolean;
  hasPerformanceRatings: boolean;
  hasChildArtifact: boolean;
  hasObservations: boolean;
  hasEngagement: boolean; // always true for structured capture
}

/**
 * Compute intelligence score from 5 binary signals + weights.
 * Each signal is 0 or 100, multiplied by its weight.
 * Returns 0-100 rounded integer.
 */
export function computeIntelligenceScore(
  signals: SignalInputs,
  weights: IntelligenceWeights = DEFAULT_WEIGHTS,
): number {
  const s1 = signals.hasSkillsCovered ? 100 : 0;
  const s2 = signals.hasPerformanceRatings ? 100 : 0;
  const s3 = signals.hasChildArtifact ? 100 : 0;
  const s4 = signals.hasObservations ? 100 : 0;
  const s5 = signals.hasEngagement ? 100 : 0;

  const raw =
    s1 * weights.skillCoverage +
    s2 * weights.performance +
    s3 * weights.childArtifact +
    s4 * weights.observations +
    s5 * weights.engagement;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

// ============================================================
// Signal Confidence
// ============================================================

/**
 * Map capture method to signal confidence level.
 * auto_filled / voice_to_structured = high (AI-assisted, coach-confirmed)
 * manual_structured = medium (human entry, no AI verification)
 * instructor_console = low (quick entry during live class)
 */
export function getSignalConfidence(captureMethod: CaptureMethod): SignalConfidence {
  switch (captureMethod) {
    case 'auto_filled':
    case 'voice_to_structured':
      return 'high';
    case 'manual_structured':
      return 'medium';
    case 'instructor_console':
      return 'low';
    default:
      return 'low';
  }
}
