// ============================================================
// Tier 0 Intent Classifier - Regex (zero cost, zero latency)
// Returns intent or null (falls through to Tier 1 Gemini)
// ============================================================

export type Intent =
  | 'GREETING'
  | 'FAQ'
  | 'QUALIFICATION'
  | 'ASSESSMENT_CTA'
  | 'BOOKING'
  | 'RESCHEDULE'
  | 'ESCALATE'
  | 'SLOT_SELECT'
  | 'GENERAL';

// --- Button ID → Intent mapping ---
const BUTTON_INTENT_MAP: Record<string, Intent> = {
  btn_check_reading: 'ASSESSMENT_CTA',
  btn_assessment: 'ASSESSMENT_CTA',
  btn_pricing: 'FAQ',
  btn_talk_team: 'ESCALATE',
  btn_human: 'ESCALATE',
  btn_book_call: 'BOOKING',
  btn_more_questions: 'FAQ',
};

// --- Regex patterns (case-insensitive, Hinglish support) ---
const PATTERNS: Array<{ intent: Intent; patterns: RegExp[] }> = [
  {
    intent: 'GREETING',
    patterns: [
      /^(hi|hello|hey|namaskar|namaste|good\s*(morning|afternoon|evening)|hii+|hola|hy)[\s!.]*$/i,
      /^(start|get started|shuru)$/i,
    ],
  },
  {
    intent: 'ESCALATE',
    patterns: [
      /(agent|human|person|insaan|complaint|shikayat|real person|someone|kisi se baat|manager)/i,
      /^(talk|baat|connect|help me)/i,
    ],
  },
  {
    intent: 'RESCHEDULE',
    patterns: [
      /(cancel|reschedule|change\s*time|different\s*time|can'?t\s*make\s*it|not\s*available)/i,
      /(time\s*doesn'?t\s*work|time\s*doesnt\s*work|badal\s*do|cancel\s*karo|doosra\s*time)/i,
      /(change\s*slot|another\s*time|shift|postpone|alag\s*time)/i,
    ],
  },
  {
    intent: 'BOOKING',
    patterns: [
      /(book|schedule|slot|discovery\s*call|free\s*call|baat\s*kar)/i,
      /(call\s*(karo|karni|karna|book)|speak\s*(to|with)\s*(coach|team|expert))/i,
    ],
  },
  {
    intent: 'ASSESSMENT_CTA',
    patterns: [
      /(free\s*(test|assessment|check)|reading\s*(test|level|check|assessment))/i,
      /(evaluate|jaanch|try|start\s*assessment|begin\s*test|shuru\s*kar)/i,
      /(check\s*(my|mere|mera)\s*(child|bacch|beti|beta))/i,
    ],
  },
  {
    intent: 'FAQ',
    patterns: [
      /(price|cost|fee|kitna|kharcha|paisa|how\s*much|fees|₹|rs\.?\s*\d|rupee)/i,
      /(how\s*(long|many)\s*(session|month|week|class))/i,
      /(refund|money\s*back|cancel\s*(subscription|membership|plan|payment)|guarantee)/i,
      /(who|which|kaun).*(coach|teacher|tutor)/i,
      /(what\s*is|tell\s*me\s*about|kya\s*hai|what\s*does).*yestoryd/i,
      /(online|offline|in[\s.-]?person|video\s*call|format|kaise\s*hota)/i,
      /(age|umar|group|batch|kis\s*umar)/i,
      /(duration|kitna\s*time|how\s*long\s*(is|does))/i,
    ],
  },
];

/**
 * Tier 0: Regex-based intent classification (zero cost, zero latency).
 * Returns intent if matched, null to fall through to Tier 1 Gemini.
 */
export function classifyTier0(
  text: string | null,
  interactiveId: string | null
): Intent | null {
  // 1. Button tap → direct mapping
  if (interactiveId && BUTTON_INTENT_MAP[interactiveId]) {
    return BUTTON_INTENT_MAP[interactiveId];
  }

  // 1b. Slot selection (list_reply with slot_ prefix)
  if (interactiveId && interactiveId.startsWith('slot_')) {
    return 'SLOT_SELECT';
  }

  if (!text || text.trim().length === 0) {
    return null;
  }

  const cleaned = text.trim();

  // 2. Run regex patterns in priority order
  for (const { intent, patterns } of PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        return intent;
      }
    }
  }

  return null;
}
