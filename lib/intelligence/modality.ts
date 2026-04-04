/**
 * CANONICAL session modality values.
 * Rule: modality = HOW the session was conducted (delivery mode).
 * 'tuition' is NOT a modality — it's a billing concept.
 * These map to CHECK constraint on learning_events.session_modality.
 */
export const SESSION_MODALITIES = {
  ONLINE: 'online',
  IN_PERSON: 'in_person',
  GROUP_CLASS: 'group_class',
  ASSESSMENT: 'assessment',
  ELEARNING: 'elearning',
  PRACTICE: 'practice',
} as const;

export type SessionModality = typeof SESSION_MODALITIES[keyof typeof SESSION_MODALITIES];

/**
 * Maps ANY input to canonical modality. ONLY place normalization happens.
 */
export function normalizeModality(input: string | null | undefined): SessionModality | null {
  if (!input) return null;
  const map: Record<string, SessionModality> = {
    // Canonical values (pass through)
    'online': 'online',
    'in_person': 'in_person',
    'group_class': 'group_class',
    'assessment': 'assessment',
    'elearning': 'elearning',
    'practice': 'practice',
    // UIP type aliases
    'online_1on1': 'online',
    'online_group': 'group_class',
    'in_person_1on1': 'in_person',
    'in_person_group': 'group_class',
    // Legacy values
    'tuition': 'in_person',
    'hybrid': 'in_person',
    'self_practice': 'practice',
    'offline': 'in_person',
  };
  const normalized = map[input.toLowerCase()];
  if (!normalized) {
    console.warn(`[normalizeModality] Unknown: "${input}", returning null`);
    return null;
  }
  return normalized;
}

/**
 * Infers modality from session context (used when not explicitly provided).
 */
export function inferModality(context: {
  hasRecallBot?: boolean;
  hasMeetLink?: boolean;
  sessionMode?: string;
}): SessionModality {
  if (context.hasRecallBot || context.hasMeetLink) return 'online';
  if (context.sessionMode === 'offline' || context.sessionMode === 'in_person') return 'in_person';
  if (context.sessionMode === 'online') return 'online';
  return 'in_person';
}
