// ============================================================
// FILE: lib/intelligence/synthesis.ts
// PURPOSE: Pure functions for intelligence profile synthesis.
//          No DB calls, no Gemini calls — fully testable.
// ============================================================

import type {
  SignalConfidence,
  SignalSource,
  ModalityCoverage,
} from './types';
import { getAgeConfig } from '@/lib/gemini/assessment-prompts';
import { getAntiHallucinationRules } from '@/lib/gemini/assessment-prompts';

// ============================================================
// Interfaces
// ============================================================

export interface SynthesisEvent {
  id: string;
  event_type: string;
  event_date: string;
  event_data: Record<string, unknown> | null;
  ai_summary: string | null;
  signal_source: string | null;
  signal_confidence: string | null;
  session_modality: string | null;
  created_at: string;
}

export interface SynthesisCapture {
  id: string;
  session_date: string;
  session_modality: string | null;
  engagement_level: string | null;
  skill_performances: Record<string, unknown>[] | null;
  custom_strength_note: string | null;
  custom_struggle_note: string | null;
  intelligence_score: number | null;
  created_at: string;
}

export interface SynthesisMicroAssessment {
  id: string;
  fluency_rating: string | null;
  estimated_wpm: number | null;
  comprehension_score: number | null;
  gemini_analysis: Record<string, unknown> | null;
  completed_at: string | null;
}

export interface SynthesisInput {
  events: SynthesisEvent[];
  captures: SynthesisCapture[];
  microAssessments: SynthesisMicroAssessment[];
  childAge: number;
  childName: string;
}

export interface SynthesisSkillRating {
  skill_name: string;
  rating: 'struggling' | 'developing' | 'proficient' | 'advanced';
  confidence: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stable' | 'declining';
}

export interface SynthesisOutput {
  skill_ratings: SynthesisSkillRating[];
  overall_reading_level: string;
  overall_confidence: 'high' | 'medium' | 'low' | 'insufficient';
  engagement_pattern: string;
  key_strengths: string[];
  key_struggles: string[];
  recommended_focus: string[];
  narrative_summary: string;
}

export interface SignalSourceSummary {
  source: string;
  count: number;
  lastEventAt: string;
  avgConfidence: SignalConfidence;
}

// ============================================================
// buildSynthesisPrompt
// ============================================================

export function buildSynthesisPrompt(input: SynthesisInput): string {
  const { events, captures, microAssessments, childAge, childName } = input;
  const ageConfig = getAgeConfig(childAge);
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Format events with confidence annotations
  const eventLines = events.map((e) => {
    const conf = e.signal_confidence || 'low';
    const weight =
      conf === 'high' ? 'STRONG' : conf === 'medium' ? 'MODERATE' : 'SUPPLEMENTARY';
    const eventDate = new Date(e.event_date || e.created_at);
    const stale = eventDate < fourteenDaysAgo ? ' [>14d old — reduced weight]' : '';
    const summary = e.ai_summary || JSON.stringify(e.event_data)?.substring(0, 200) || 'No details';
    return `- [${e.event_type}] (${weight} signal${stale}) ${e.event_date}: ${summary}`;
  });

  // Format structured captures
  const captureLines = captures.map((c) => {
    const skills = (c.skill_performances || [])
      .map((sp: any) => `${sp.skill_name || sp.skillId}: ${sp.rating}`)
      .join(', ');
    const strengths = c.custom_strength_note ? ` | Strengths: ${c.custom_strength_note}` : '';
    const struggles = c.custom_struggle_note ? ` | Struggles: ${c.custom_struggle_note}` : '';
    return `- [capture] ${c.session_date} (engagement: ${c.engagement_level || 'unknown'}) Skills: ${skills || 'none recorded'}${strengths}${struggles}`;
  });

  // Format micro-assessments
  const microLines = microAssessments.map((m) => {
    const analysis = m.gemini_analysis
      ? ` | AI analysis: ${JSON.stringify(m.gemini_analysis).substring(0, 150)}`
      : '';
    return `- [micro-assessment] fluency: ${m.fluency_rating || 'unknown'}, WPM: ${m.estimated_wpm || 'N/A'}, comprehension: ${m.comprehension_score || 'N/A'}${analysis}`;
  });

  // Adapted anti-hallucination rules for synthesis
  const antiHallucination = `CRITICAL SYNTHESIS RULES (adapted from assessment guidelines):
- ONLY rate skills that have direct evidence in the signals above
- Do NOT invent skill ratings for skills not mentioned in any signal
- If a skill has only one weak signal, set confidence to "low"
- ${getAntiHallucinationRules(childName).split('\n').slice(0, 3).join('\n- ')}
- Use "${childName}" — never "the child" or "the student"
- If data is sparse, say so in the narrative — do not fill gaps with assumptions`;

  return `You are a reading development specialist synthesizing learning intelligence for ${childName} (age ${childAge}).

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}

LEARNING SIGNALS (${events.length} events, ${captures.length} structured captures, ${microAssessments.length} micro-assessments):

EVENTS (confidence-weighted):
${eventLines.length > 0 ? eventLines.join('\n') : '- No learning events available'}

STRUCTURED CAPTURES:
${captureLines.length > 0 ? captureLines.join('\n') : '- No structured captures available'}

MICRO-ASSESSMENTS:
${microLines.length > 0 ? microLines.join('\n') : '- No micro-assessments available'}

${antiHallucination}

TASK: Synthesize ALL signals above into a unified intelligence profile for ${childName}. Weight signals by confidence: HIGH=primary evidence, MEDIUM=supporting evidence, LOW=supplementary context only.

Respond with ONLY valid JSON matching this exact schema:
{
  "skill_ratings": [
    { "skill_name": "string", "rating": "struggling|developing|proficient|advanced", "confidence": "high|medium|low", "trend": "improving|stable|declining" }
  ],
  "overall_reading_level": "string (e.g., 'Early Developing Reader', 'Building Fluency')",
  "overall_confidence": "high|medium|low|insufficient",
  "engagement_pattern": "string (1 sentence describing engagement trend)",
  "key_strengths": ["string", "string"],
  "key_struggles": ["string", "string"],
  "recommended_focus": ["string (specific, actionable focus area)"],
  "narrative_summary": "string (2-3 sentences summarizing ${childName}'s reading development)"
}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

// ============================================================
// parseSynthesisResponse
// ============================================================

const VALID_RATINGS = ['struggling', 'developing', 'proficient', 'advanced'];
const VALID_CONFIDENCES = ['high', 'medium', 'low', 'insufficient'];
const VALID_TRENDS = ['improving', 'stable', 'declining'];

export function parseSynthesisResponse(raw: string): SynthesisOutput {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  if (!Array.isArray(parsed.skill_ratings)) {
    throw new Error('Missing or invalid skill_ratings array');
  }
  if (typeof parsed.overall_reading_level !== 'string') {
    throw new Error('Missing or invalid overall_reading_level');
  }
  if (!VALID_CONFIDENCES.includes(parsed.overall_confidence)) {
    throw new Error(`Invalid overall_confidence: ${parsed.overall_confidence}`);
  }
  if (typeof parsed.narrative_summary !== 'string') {
    throw new Error('Missing or invalid narrative_summary');
  }

  // Validate and clean skill ratings
  const skillRatings: SynthesisSkillRating[] = parsed.skill_ratings
    .filter((sr: any) => typeof sr.skill_name === 'string' && sr.skill_name.length > 0)
    .map((sr: any) => ({
      skill_name: sr.skill_name,
      rating: VALID_RATINGS.includes(sr.rating) ? sr.rating : 'developing',
      confidence: VALID_CONFIDENCES.slice(0, 3).includes(sr.confidence) ? sr.confidence : 'low',
      trend: VALID_TRENDS.includes(sr.trend) ? sr.trend : 'stable',
    }));

  return {
    skill_ratings: skillRatings,
    overall_reading_level: parsed.overall_reading_level,
    overall_confidence: parsed.overall_confidence as SynthesisOutput['overall_confidence'],
    engagement_pattern: typeof parsed.engagement_pattern === 'string' ? parsed.engagement_pattern : 'Unknown',
    key_strengths: Array.isArray(parsed.key_strengths) ? parsed.key_strengths.filter((s: any) => typeof s === 'string') : [],
    key_struggles: Array.isArray(parsed.key_struggles) ? parsed.key_struggles.filter((s: any) => typeof s === 'string') : [],
    recommended_focus: Array.isArray(parsed.recommended_focus) ? parsed.recommended_focus.filter((s: any) => typeof s === 'string') : [],
    narrative_summary: parsed.narrative_summary,
  };
}

// ============================================================
// computeSignalSources
// ============================================================

export function computeSignalSources(events: SynthesisEvent[]): SignalSourceSummary[] {
  const groups = new Map<string, { count: number; lastEventAt: string; confidences: string[] }>();

  for (const event of events) {
    const source = event.signal_source || event.event_type || 'unknown';
    const existing = groups.get(source);

    if (!existing) {
      groups.set(source, {
        count: 1,
        lastEventAt: event.event_date || event.created_at,
        confidences: [event.signal_confidence || 'low'],
      });
    } else {
      existing.count++;
      const eventDate = event.event_date || event.created_at;
      if (eventDate > existing.lastEventAt) {
        existing.lastEventAt = eventDate;
      }
      existing.confidences.push(event.signal_confidence || 'low');
    }
  }

  return Array.from(groups.entries()).map(([source, data]) => ({
    source,
    count: data.count,
    lastEventAt: data.lastEventAt,
    avgConfidence: computeAvgConfidence(data.confidences),
  }));
}

// ============================================================
// computeModalityCoverage
// ============================================================

export function computeModalityCoverage(
  events: SynthesisEvent[],
  captures: SynthesisCapture[]
): Record<string, ModalityCoverage> {
  const groups = new Map<string, { count: number; lastEventAt: string; confidences: string[] }>();

  for (const event of events) {
    const modality = event.session_modality || 'unknown';
    addToModalityGroup(groups, modality, event.event_date || event.created_at, event.signal_confidence || 'low');
  }

  for (const capture of captures) {
    const modality = capture.session_modality || 'unknown';
    addToModalityGroup(groups, modality, capture.session_date || capture.created_at, 'high');
  }

  const result: Record<string, ModalityCoverage> = {};
  for (const [modality, data] of Array.from(groups.entries())) {
    result[modality] = {
      source: modality as SignalSource,
      eventCount: data.count,
      lastEventAt: data.lastEventAt,
      avgConfidence: computeAvgConfidence(data.confidences),
    };
  }

  return result;
}

// ============================================================
// determinePrimaryModality
// ============================================================

export function determinePrimaryModality(
  coverage: Record<string, ModalityCoverage>
): string | null {
  let maxCount = 0;
  let primary: string | null = null;

  for (const [modality, data] of Object.entries(coverage)) {
    if (modality === 'unknown') continue;
    if (data.eventCount > maxCount) {
      maxCount = data.eventCount;
      primary = modality;
    }
  }

  return primary;
}

// ============================================================
// Helpers
// ============================================================

function addToModalityGroup(
  groups: Map<string, { count: number; lastEventAt: string; confidences: string[] }>,
  modality: string,
  dateStr: string,
  confidence: string
) {
  const existing = groups.get(modality);
  if (!existing) {
    groups.set(modality, { count: 1, lastEventAt: dateStr, confidences: [confidence] });
  } else {
    existing.count++;
    if (dateStr > existing.lastEventAt) existing.lastEventAt = dateStr;
    existing.confidences.push(confidence);
  }
}

function computeAvgConfidence(confidences: string[]): SignalConfidence {
  if (confidences.length === 0) return 'low';

  const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const total = confidences.reduce((sum, c) => sum + (weights[c] || 1), 0);
  const avg = total / confidences.length;

  if (avg >= 2.5) return 'high';
  if (avg >= 1.5) return 'medium';
  return 'low';
}
