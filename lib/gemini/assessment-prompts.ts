// ============================================================
// FILE: lib/gemini/assessment-prompts.ts
// PURPOSE: Single source of truth for all reading assessment prompts
// ============================================================
// Standardizes age brackets (5-tier), anti-hallucination rules,
// feedback structure, and JSON schemas across ALL assessment paths:
//   - analyze/route.ts (main assessment)
//   - retry/route.ts (async retry)
//   - enrolled/route.ts (enrolled students)
//   - final/submit/route.ts (end-of-program)
//   - lib/gemini/client.ts (dead export, standardized for hygiene)
//   - lib/gemini/audio-analysis.ts (offline clips)
//   - lib/ai/provider.ts (fallback system)
// ============================================================

// ==================== TYPES ====================

export interface AgeConfig {
  level: string;
  guidance: string;
  minScore: number;
  minCompleteness: number;
  expectedWPM: string;
  tone: string;
  scoreRange: string;
}

export interface ErrorClassification {
  substitutions: { original: string; read_as: string }[];
  omissions: string[];
  insertions: string[];
  reversals: { original: string; read_as: string }[];
  mispronunciations: { word: string; issue: string }[];
}

export interface PhonicsAnalysis {
  struggling_phonemes: string[];
  phoneme_details: { phoneme: string; examples: string[]; frequency: string }[];
  strong_phonemes: string[];
  recommended_focus: string;
}

export interface SkillScore {
  score: number;
  notes: string;
}

export interface SkillBreakdown {
  decoding: SkillScore;
  sight_words: SkillScore;
  blending: SkillScore;
  segmenting: SkillScore;
  expression: SkillScore;
  comprehension_indicators: SkillScore;
}

export interface PracticeRecommendations {
  daily_words: string[];
  phonics_focus: string;
  suggested_activity: string;
}

export interface FullAssessmentResult {
  clarity_score: number;
  fluency_score: number;
  speed_score: number;
  wpm: number;
  completeness_percentage: number;
  error_classification: ErrorClassification;
  phonics_analysis: PhonicsAnalysis;
  skill_breakdown: SkillBreakdown;
  practice_recommendations: PracticeRecommendations;
  feedback: string;
  errors: string[];
  strengths: string[];
  areas_to_improve: string[];
  self_corrections: string[];
  hesitations: string[];
  improvement_summary?: string;
}

export interface LiteAssessmentResult {
  reading_score: number;
  wpm: number;
  fluency_rating: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  pronunciation_rating: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  completeness_percentage: number;
  feedback: string;
  errors: string[];
  self_corrections: string[];
  hesitations: string[];
}

// ==================== A) AGE CONFIG ====================

/**
 * 5-tier standardized age brackets for all assessment prompts.
 */
export function getAgeConfig(age: number): AgeConfig {
  if (age <= 5) {
    return {
      level: 'FOUNDATIONAL',
      guidance: `Assessment context: ${age}-year-old (early reader). Expected skills: letter recognition, simple CVC words, basic sight words. Benchmark: Reading 60%+ of age-appropriate passage with support is typical.`,
      minScore: 5,
      minCompleteness: 60,
      expectedWPM: '20-40',
      tone: 'very encouraging and gentle',
      scoreRange: '5-10 for any genuine attempt',
    };
  }

  if (age <= 7) {
    return {
      level: 'EARLY_DEVELOPING',
      guidance: `Assessment context: ${age}-year-old (early developing reader). Expected skills: Blending sounds, common sight words, simple sentences. Benchmark: Reading 65%+ of passage with developing fluency is typical.`,
      minScore: 5,
      minCompleteness: 65,
      expectedWPM: '40-70',
      tone: 'encouraging with gentle guidance',
      scoreRange: '5-10 based on effort and basic accuracy',
    };
  }

  if (age <= 9) {
    return {
      level: 'DEVELOPING',
      guidance: `Assessment context: ${age}-year-old (developing reader). Expected skills: Multi-syllable words, self-correction, growing fluency. Benchmark: Reading 70%+ of passage with developing fluency is typical.`,
      minScore: 5,
      minCompleteness: 70,
      expectedWPM: '70-100',
      tone: 'balanced - encouraging but with clear feedback',
      scoreRange: '4-10 based on accuracy and fluency',
    };
  }

  if (age <= 11) {
    return {
      level: 'INTERMEDIATE',
      guidance: `Assessment context: ${age}-year-old (intermediate reader). Expected skills: Expression, comprehension indicators, smooth phrasing. Benchmark: Reading 75%+ of passage with reasonable fluency is expected.`,
      minScore: 6,
      minCompleteness: 75,
      expectedWPM: '100-130',
      tone: 'constructive and growth-oriented',
      scoreRange: '3-10 based on overall performance',
    };
  }

  // Age 12+
  return {
    level: 'ADVANCED',
    guidance: `Assessment context: ${age}-year-old (advancing reader). Expected skills: Complex vocabulary, expression, comprehension. Benchmark: Reading 80%+ of passage fluently is expected.`,
    minScore: 6,
    minCompleteness: 80,
    expectedWPM: '130-180',
    tone: 'direct but supportive',
    scoreRange: '2-10 with honest assessment',
  };
}

// ==================== B) ANTI-HALLUCINATION RULES ====================

/**
 * Extract the full anti-hallucination rules block used in assessment prompts.
 * Uses the child's name for personalized rules.
 */
export function getAntiHallucinationRules(name: string): string {
  return `CRITICAL RULES TO PREVENT FALSE ERRORS:

MISPRONUNCIATIONS - BE VERY CAREFUL:
- ONLY mark a word as mispronounced if it sounds SIGNIFICANTLY different from the target
- Do NOT mark a word as mispronounced if the child said it correctly (e.g., "stories" read as "stories" is NOT an error)
- Syllable-by-syllable reading is ACCEPTABLE (e.g., "vill-age" for "village" is correct, NOT an error)
- Minor accent variations, regional pronunciations, and slight imperfections are NOT errors
- If the word is recognizable as the target word, it is CORRECT

SKIPPED/OMITTED WORDS:
- ONLY mark as "omitted" if the word was COMPLETELY ABSENT from the audio
- If you hear ANY attempt at the word (even partial), it is NOT skipped
- Self-corrections count as reading the word (not as skipped)
- When in doubt, do NOT mark as omitted

COMPLETENESS PERCENTAGE:
- If child read continuously through the entire passage, completeness should be 90-100%
- Audio quality issues should NOT lower completeness score
- Background noise is NOT the child's fault - give benefit of doubt
- Only reduce completeness if large sections were clearly not read

DO NOT MAKE THESE COMMON MISTAKES:
- Marking "stories" as mispronounced when child said "stories" correctly
- Marking natural syllable breaks or pauses as errors
- Being overly strict with young children (ages 4-7 especially)
- Counting the same error multiple times
- Marking words as skipped when audio was just unclear

ABSOLUTELY DO NOT HALLUCINATE:
- Only report errors for words that ACTUALLY appear in the passage above
- Do NOT invent words that aren't in the passage text
- Do NOT create fictional mispronunciations or errors
- Every word you mention in errors MUST exist in the provided passage
- If you're unsure about what you heard, mark it as "unclear" not as an error
- Base ALL analysis strictly on the audio and passage provided - nothing else
- Cross-check every error against the passage text before including it

CRITICAL ACCURACY RULES:
1. QUOTE EXACT WORDS - If the child said "hospe" instead of "hospital", write exactly that
2. DO NOT GUESS - If audio is unclear, assume the word was read correctly
3. COUNT ACCURATELY - Completeness % must reflect actual words read vs total words
4. BE SPECIFIC - Never say "some words were mispronounced" - list which ones
5. USE THE NAME "${name}" - Never use "the child" or "the reader"
6. GIVE BENEFIT OF DOUBT - When uncertain, assume correct pronunciation`;
}

// ==================== C) FEEDBACK STRUCTURE ====================

/**
 * Reusable feedback format instructions for assessment prompts.
 */
export function getFeedbackStructure(name: string, wordCount: number, sentenceCount: number): string {
  if (sentenceCount === 3) {
    return `FEEDBACK STRUCTURE (3 sentences, 60-80 words, factual tone):
- Sentence 1: Comment on completeness and overall fluency (e.g., "${name} read 90% of the passage with good pace.").
- Sentence 2: Cite specific evidence of errors OR praise accuracy if minimal errors.
- Sentence 3: Give one actionable technical tip for improvement.`;
  }

  return `FEEDBACK STRUCTURE (${sentenceCount} sentences, factual tone):
- Sentence 1: State what ${name} accomplished factually (e.g., "${name} read 75% of the passage at a steady pace.")
- Sentence 2: Note specific observations with examples (e.g., "Words with 'th' sounds like 'through' and 'the' were challenging.")
- Sentence 3: Provide one clear, actionable recommendation (e.g., "Practice 'th' words daily: the, this, that, through, three.")
- Sentence 4: State the path forward neutrally (e.g., "Consistent practice with these sounds will build reading accuracy.")

If the passage was incomplete, state it factually: "${name} read X out of ${wordCount} words (Y%)."`;
}

// ==================== D) FULL ASSESSMENT PROMPT ====================

interface FullAssessmentPromptParams {
  childName: string;
  childAge: number;
  passage: string;
  wordCount: number;
  previousScores?: {
    clarity?: number | null;
    fluency?: number | null;
    speed?: number | null;
    wpm?: number | null;
    strengths?: string[] | null;
    areasToImprove?: string[] | null;
  };
  comparisonMode?: boolean;
}

/**
 * Builds the complete prompt for FULL schema assessments.
 * Used by: analyze, retry, final/submit, provider, client
 */
export function buildFullAssessmentPrompt(params: FullAssessmentPromptParams): string {
  const { childName, childAge, passage, wordCount, previousScores, comparisonMode } = params;
  const ageConfig = getAgeConfig(childAge);

  let comparisonContext = '';
  if (comparisonMode && previousScores) {
    comparisonContext = `
PREVIOUS ASSESSMENT SCORES (Initial):
- Clarity: ${previousScores.clarity ?? 'N/A'}/10
- Fluency: ${previousScores.fluency ?? 'N/A'}/10
- Speed: ${previousScores.speed ?? 'N/A'}/10
- WPM: ${previousScores.wpm ?? 'N/A'}
- Strengths: ${previousScores.strengths?.join(', ') || 'N/A'}
- Areas to Improve: ${previousScores.areasToImprove?.join(', ') || 'N/A'}

Compare to their initial scores and highlight improvements. Celebrate progress!
`;
  }

  return `You are a reading assessment specialist. Your task is to ACCURATELY analyze a ${childAge}-year-old child named ${childName} reading aloud.

PASSAGE THE CHILD WAS ASKED TO READ:
"${passage}"
(Word count: ${wordCount} words)

PRIMARY OBJECTIVE: ACCURACY
Your analysis must be precise. Parents rely on this assessment to understand their child's actual reading level. Do not inflate or deflate scores - report what you observe.
${comparisonContext}
LISTEN CAREFULLY FOR:
1. Which specific words were read correctly
2. Which specific words were mispronounced (note exactly how they were said)
3. Which words were skipped entirely
4. Which words were substituted with other words
5. Any self-corrections the child made

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Be ${ageConfig.tone} in your assessment
- Score Range: ${ageConfig.scoreRange}
- WPM expectation for this age: ${ageConfig.expectedWPM} WPM typical

SCORING SCALE (1-10):
- 9-10: Reads fluently with minimal errors, appropriate for age or above
- 7-8: Reads well with occasional errors, meeting age expectations
- 5-6: Developing reader, noticeable errors but shows understanding
- 3-4: Struggling reader, frequent errors, needs significant support
- 1-2: Early emergent reader, unable to decode most words

Score based on ACTUAL PERFORMANCE, not effort or age alone.

RESPONSE FORMAT - Provide ONLY valid JSON:
{
    "clarity_score": <integer 1-10, how clearly words were pronounced>,
    "fluency_score": <integer 1-10, smoothness of reading>,
    "speed_score": <integer 1-10, appropriate pace for age>,
    "wpm": <integer, actual words per minute calculated from audio>,
    "completeness_percentage": <integer 0-100, portion of passage actually read>,

    "error_classification": {
        "substitutions": [{"original": "actual_word", "read_as": "what_child_said"}],
        "omissions": ["words skipped entirely"],
        "insertions": ["words added that were not in passage"],
        "reversals": [{"original": "was", "read_as": "saw"}],
        "mispronunciations": [{"word": "word", "issue": "read as 'wurd'"}]
    },

    "phonics_analysis": {
        "struggling_phonemes": ["specific phonemes: th, ch, silent e, long vowels"],
        "phoneme_details": [
            {"phoneme": "th", "examples": ["the->da", "this->dis"], "frequency": "frequent"}
        ],
        "strong_phonemes": ["phonemes handled well"],
        "recommended_focus": "Primary phonics area to practice with specific examples"
    },

    "skill_breakdown": {
        "decoding": {"score": 1-10, "notes": "ability to sound out unfamiliar words"},
        "sight_words": {"score": 1-10, "notes": "recognition of common high-frequency words"},
        "blending": {"score": 1-10, "notes": "combining sounds to form words"},
        "segmenting": {"score": 1-10, "notes": "breaking words into individual sounds"},
        "expression": {"score": 1-10, "notes": "reading with appropriate intonation"},
        "comprehension_indicators": {"score": 1-10, "notes": "pausing at punctuation, emphasis on key words"}
    },

    "practice_recommendations": {
        "daily_words": ["5 specific words from errors to practice daily"],
        "phonics_focus": "Primary skill needing work with examples",
        "suggested_activity": "One specific practice activity for home"
    },

    "feedback": "4 sentences following structure below",

    "errors": ["PRECISE list: read 'house' as 'horse', skipped 'the', struggled with 'through'"],
    "strengths": ["2-3 specific things done well with evidence"],
    "areas_to_improve": ["2-3 specific areas with actionable advice"],
    "self_corrections": ["words the child initially misread but then corrected"],
    "hesitations": ["words where the child paused significantly before reading"]${comparisonMode ? `,
    "improvement_summary": "1-2 sentences about how they improved since initial assessment"` : ''}
}

${getFeedbackStructure(childName, wordCount, 4)}

${getAntiHallucinationRules(childName)}

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

// ==================== E) LITE ASSESSMENT PROMPT ====================

interface LiteAssessmentPromptParams {
  childName: string;
  childAge: number;
  passage: string;
  wordCount: number;
}

/**
 * Builds prompt for LITE schema (enrolled assessments).
 * Used by: enrolled/route.ts
 */
export function buildLiteAssessmentPrompt(params: LiteAssessmentPromptParams): string {
  const { childName, childAge, passage, wordCount } = params;
  const ageConfig = getAgeConfig(childAge);

  return `You are a reading assessment specialist. Analyze audio of a ${childAge}-year-old child named ${childName} reading the passage below.

PASSAGE CONTEXT:
"${passage}"
(Word count: ${wordCount} words)

AGE-BASED ASSESSMENT (${ageConfig.level}):
${ageConfig.guidance}
- Be ${ageConfig.tone} in your assessment
- WPM expectation: ${ageConfig.expectedWPM} WPM typical

CRITICAL SCORING RULES:
1. COMPLETENESS CHECK: If the child reads less than ${ageConfig.minCompleteness}% of the text, the 'reading_score' MUST be 4 or lower.
2. EVIDENCE REQUIRED: Do not be generic. You must quote specific misread words (e.g., "Read 'Hop' as 'hobbed'").
3. ACCURACY: Note substitutions, omissions, and mispronunciations with exact examples.
4. MINIMUM SCORE: If the child reads ${ageConfig.minCompleteness}%+ of the passage, minimum score is ${ageConfig.minScore}.

Generate a JSON response with this EXACT structure:
{
    "reading_score": <integer 1-10 based on accuracy & completeness>,
    "wpm": <integer estimated words per minute>,
    "fluency_rating": <string: "Poor", "Fair", "Good", or "Excellent">,
    "pronunciation_rating": <string: "Poor", "Fair", "Good", or "Excellent">,
    "completeness_percentage": <integer 0-100>,
    "feedback": <string, exactly 3 sentences, 60-80 words total>,
    "errors": <list of specific words missed or misread with format "Read 'X' as 'Y'" or "Skipped 'X'">,
    "self_corrections": <list of words the child initially misread but then corrected>,
    "hesitations": <list of words where the child paused significantly before reading>
}

${getFeedbackStructure(childName, wordCount, 3)}

${getAntiHallucinationRules(childName)}

Respond ONLY with valid JSON. No additional text.`;
}
