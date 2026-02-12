// ============================================================
// Diagnostic Form Schemas — age-band-specific field definitions
// ============================================================

export type FieldType = 'select' | 'multi-select' | 'number' | 'text' | 'letter-picker';

export interface FieldOption {
  value: string;
  label: string;
}

export interface DiagnosticField {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  section: string;
}

// ============================================================
// Shared options
// ============================================================
const CONFIDENCE_OPTIONS: FieldOption[] = [
  { value: 'confident', label: 'Confident' },
  { value: 'shy_but_willing', label: 'Shy but willing' },
  { value: 'reluctant', label: 'Reluctant' },
  { value: 'anxious', label: 'Anxious' },
];

const PARENT_DYNAMIC_OPTIONS: FieldOption[] = [
  { value: 'supportive', label: 'Supportive' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'disengaged', label: 'Disengaged' },
  { value: 'overbearing', label: 'Overbearing' },
];

const LANGUAGE_OPTIONS: FieldOption[] = [
  { value: 'english', label: 'English dominant' },
  { value: 'hindi', label: 'Hindi dominant' },
  { value: 'bilingual_balanced', label: 'Bilingual balanced' },
  { value: 'other', label: 'Other' },
];

const VOCAB_OPTIONS: FieldOption[] = [
  { value: 'rich', label: 'Rich' },
  { value: 'adequate', label: 'Adequate' },
  { value: 'limited', label: 'Limited' },
];

const COMPREHENSION_3: FieldOption[] = [
  { value: 'strong', label: 'Strong' },
  { value: 'adequate', label: 'Adequate' },
  { value: 'weak', label: 'Weak' },
];

const COMPREHENSION_EMERGING: FieldOption[] = [
  { value: 'strong', label: 'Strong' },
  { value: 'emerging', label: 'Emerging' },
  { value: 'not_yet', label: 'Not yet' },
];

const FOCUS_OPTIONS: FieldOption[] = [
  { value: 'phonemic_awareness', label: 'Phonemic awareness' },
  { value: 'phonics', label: 'Phonics' },
  { value: 'decoding', label: 'Decoding' },
  { value: 'fluency', label: 'Fluency' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'comprehension', label: 'Comprehension' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'writing', label: 'Writing' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'grammar', label: 'Grammar' },
];

// ============================================================
// Foundation (ages 4-6)
// ============================================================
export const FOUNDATION_FIELDS: DiagnosticField[] = [
  // -- Literacy Basics --
  { key: 'letter_sounds_known', label: 'Letter sounds known', type: 'letter-picker', section: 'Literacy Basics' },
  { key: 'can_blend_cvc', label: 'Can blend CVC words?', type: 'select', section: 'Literacy Basics', options: [
    { value: 'yes', label: 'Yes' }, { value: 'with_support', label: 'With support' }, { value: 'no', label: 'No' },
  ]},
  { key: 'letter_recognition_upper', label: 'Uppercase letter recognition', type: 'select', section: 'Literacy Basics', options: [
    { value: 'most', label: 'Most (20+)' }, { value: 'some', label: 'Some (10-19)' }, { value: 'few', label: 'Few (1-9)' }, { value: 'none', label: 'None' },
  ]},
  { key: 'letter_recognition_lower', label: 'Lowercase letter recognition', type: 'select', section: 'Literacy Basics', options: [
    { value: 'most', label: 'Most (20+)' }, { value: 'some', label: 'Some (10-19)' }, { value: 'few', label: 'Few (1-9)' }, { value: 'none', label: 'None' },
  ]},
  { key: 'sight_words_known', label: 'Sight words known', type: 'number', min: 0, max: 100, section: 'Literacy Basics', placeholder: '0' },

  // -- Phonological Awareness --
  { key: 'rhyme_detection', label: 'Rhyme detection', type: 'select', section: 'Phonological Awareness', options: COMPREHENSION_EMERGING },
  { key: 'rhyme_production', label: 'Rhyme production', type: 'select', section: 'Phonological Awareness', options: COMPREHENSION_EMERGING },

  // -- Language & Comprehension --
  { key: 'listening_comprehension', label: 'Listening comprehension', type: 'select', section: 'Language & Comprehension', options: [
    { value: 'strong', label: 'Strong' }, { value: 'age_appropriate', label: 'Age-appropriate' }, { value: 'below', label: 'Below expected' },
  ]},
  { key: 'vocabulary_level', label: 'Vocabulary level', type: 'select', section: 'Language & Comprehension', options: VOCAB_OPTIONS },

  // -- Learning Profile --
  { key: 'attention_span_minutes', label: 'Attention span (minutes)', type: 'number', min: 1, max: 60, section: 'Learning Profile', placeholder: '10' },
  { key: 'fine_motor_readiness', label: 'Fine motor readiness', type: 'select', section: 'Learning Profile', options: [
    { value: 'ready', label: 'Ready' }, { value: 'developing', label: 'Developing' }, { value: 'needs_support', label: 'Needs support' },
  ]},
  { key: 'confidence_level', label: 'Confidence level', type: 'select', section: 'Learning Profile', options: CONFIDENCE_OPTIONS },

  // -- Context --
  { key: 'parent_child_dynamic', label: 'Parent-child dynamic', type: 'select', section: 'Context', options: PARENT_DYNAMIC_OPTIONS },
  { key: 'language_dominance', label: 'Language dominance', type: 'select', section: 'Context', options: LANGUAGE_OPTIONS },
  { key: 'other_language', label: 'Other language (if applicable)', type: 'text', section: 'Context', placeholder: 'e.g. Tamil, Bengali' },

  // -- Coach Recommendation --
  { key: 'coach_recommended_focus', label: 'Recommended focus areas', type: 'multi-select', section: 'Coach Recommendation', options: FOCUS_OPTIONS },
  { key: 'recommended_start_template', label: 'Recommended start template', type: 'text', section: 'Coach Recommendation', placeholder: 'e.g. F01, F04' },
  { key: 'coach_observations', label: 'Coach observations', type: 'text', section: 'Coach Recommendation', placeholder: 'Overall observations from this session...' },
];

// ============================================================
// Building (ages 7-9)
// ============================================================
export const BUILDING_FIELDS: DiagnosticField[] = [
  // -- Decoding & Fluency --
  { key: 'decode_level', label: 'Decoding level', type: 'select', section: 'Decoding & Fluency', options: [
    { value: 'cvc_only', label: 'CVC words only' }, { value: 'blends', label: 'Blends' },
    { value: 'digraphs', label: 'Digraphs' }, { value: 'multi_syllable', label: 'Multi-syllable' }, { value: 'fluent', label: 'Fluent' },
  ]},
  { key: 'reading_accuracy_percent', label: 'Reading accuracy (%)', type: 'number', min: 0, max: 100, section: 'Decoding & Fluency', placeholder: '85' },
  { key: 'wpm_oral_reading', label: 'Oral reading WPM', type: 'number', min: 0, max: 300, section: 'Decoding & Fluency', placeholder: '0' },
  { key: 'sight_words_known_of_100', label: 'Sight words known (of 100)', type: 'number', min: 0, max: 100, section: 'Decoding & Fluency', placeholder: '0' },
  { key: 'expression_prosody', label: 'Expression / prosody', type: 'select', section: 'Decoding & Fluency', options: [
    { value: 'expressive', label: 'Expressive' }, { value: 'monotone', label: 'Monotone' }, { value: 'word_by_word', label: 'Word-by-word' },
  ]},
  { key: 'self_correction', label: 'Self-correction', type: 'select', section: 'Decoding & Fluency', options: [
    { value: 'frequent', label: 'Frequent' }, { value: 'occasional', label: 'Occasional' }, { value: 'rare', label: 'Rare' }, { value: 'never', label: 'Never' },
  ]},
  { key: 'reading_stamina_minutes', label: 'Reading stamina (min)', type: 'number', min: 0, max: 60, section: 'Decoding & Fluency', placeholder: '10' },

  // -- Comprehension --
  { key: 'comprehension_literal', label: 'Literal comprehension', type: 'select', section: 'Comprehension', options: COMPREHENSION_3 },
  { key: 'comprehension_inferential', label: 'Inferential comprehension', type: 'select', section: 'Comprehension', options: COMPREHENSION_EMERGING },
  { key: 'vocabulary_level', label: 'Vocabulary level', type: 'select', section: 'Comprehension', options: VOCAB_OPTIONS },

  // -- Writing & Grammar --
  { key: 'grammar_awareness', label: 'Grammar awareness', type: 'select', section: 'Writing & Grammar', options: COMPREHENSION_EMERGING },
  { key: 'writing_ability', label: 'Writing ability', type: 'select', section: 'Writing & Grammar', options: [
    { value: 'paragraphs', label: 'Paragraphs' }, { value: 'sentences', label: 'Sentences' },
    { value: 'words_only', label: 'Words only' }, { value: 'not_yet', label: 'Not yet' },
  ]},

  // -- Learning Profile --
  { key: 'confidence_level', label: 'Confidence level', type: 'select', section: 'Learning Profile', options: CONFIDENCE_OPTIONS },
  { key: 'parent_child_dynamic', label: 'Parent-child dynamic', type: 'select', section: 'Learning Profile', options: PARENT_DYNAMIC_OPTIONS },
  { key: 'language_dominance', label: 'Language dominance', type: 'select', section: 'Learning Profile', options: LANGUAGE_OPTIONS },

  // -- Coach Recommendation --
  { key: 'coach_recommended_focus', label: 'Recommended focus areas', type: 'multi-select', section: 'Coach Recommendation', options: FOCUS_OPTIONS },
  { key: 'recommended_start_template', label: 'Recommended start template', type: 'text', section: 'Coach Recommendation', placeholder: 'e.g. B02, B05' },
  { key: 'coach_observations', label: 'Coach observations', type: 'text', section: 'Coach Recommendation', placeholder: 'Overall observations from this session...' },
];

// ============================================================
// Mastery (ages 10-12)
// ============================================================
export const MASTERY_FIELDS: DiagnosticField[] = [
  // -- Reading Level --
  { key: 'reading_level_grade', label: 'Reading level (grade)', type: 'text', section: 'Reading Level', placeholder: 'e.g. Grade 3, Grade 5' },
  { key: 'wpm_oral_reading', label: 'Oral reading WPM', type: 'number', min: 0, max: 300, section: 'Reading Level', placeholder: '0' },
  { key: 'wpm_silent_reading', label: 'Silent reading WPM (est.)', type: 'number', min: 0, max: 500, section: 'Reading Level', placeholder: '0' },
  { key: 'expression_prosody', label: 'Expression / prosody', type: 'select', section: 'Reading Level', options: [
    { value: 'engaging', label: 'Engaging' }, { value: 'adequate', label: 'Adequate' },
    { value: 'monotone', label: 'Monotone' }, { value: 'word_by_word', label: 'Word-by-word' },
  ]},
  { key: 'reading_stamina_minutes', label: 'Reading stamina (min)', type: 'number', min: 0, max: 90, section: 'Reading Level', placeholder: '15' },
  { key: 'self_selected_reading', label: 'Self-selected reading', type: 'select', section: 'Reading Level', options: [
    { value: 'reads_independently', label: 'Reads independently' }, { value: 'reads_when_told', label: 'Reads when told' }, { value: 'avoids_reading', label: 'Avoids reading' },
  ]},

  // -- Comprehension --
  { key: 'comprehension_literal', label: 'Literal comprehension', type: 'select', section: 'Comprehension', options: COMPREHENSION_3 },
  { key: 'comprehension_inferential', label: 'Inferential comprehension', type: 'select', section: 'Comprehension', options: COMPREHENSION_3 },
  { key: 'comprehension_evaluative', label: 'Evaluative comprehension', type: 'select', section: 'Comprehension', options: COMPREHENSION_EMERGING },
  { key: 'critical_thinking', label: 'Critical thinking', type: 'select', section: 'Comprehension', options: [
    { value: 'questions_text', label: 'Questions text' }, { value: 'accepts_at_face', label: 'Accepts at face value' }, { value: 'not_yet', label: 'Not yet' },
  ]},

  // -- Language Skills --
  { key: 'vocabulary_strategy', label: 'Vocabulary strategy', type: 'select', section: 'Language Skills', options: [
    { value: 'context_clues', label: 'Context clues' }, { value: 'word_parts', label: 'Word parts' },
    { value: 'dictionary', label: 'Dictionary' }, { value: 'guesses', label: 'Guesses' }, { value: 'skips', label: 'Skips unknown words' },
  ]},
  { key: 'grammar_accuracy', label: 'Grammar accuracy', type: 'select', section: 'Language Skills', options: COMPREHENSION_3 },
  { key: 'spoken_english', label: 'Spoken English', type: 'select', section: 'Language Skills', options: [
    { value: 'fluent', label: 'Fluent' }, { value: 'functional', label: 'Functional' },
    { value: 'basic', label: 'Basic' }, { value: 'minimal', label: 'Minimal' },
  ]},

  // -- Writing --
  { key: 'writing_quality', label: 'Writing quality', type: 'select', section: 'Writing', options: [
    { value: 'structured_paragraphs', label: 'Structured paragraphs' }, { value: 'basic_paragraphs', label: 'Basic paragraphs' },
    { value: 'sentences', label: 'Sentences' }, { value: 'limited', label: 'Limited' },
  ]},

  // -- Learning Profile --
  { key: 'confidence_level', label: 'Confidence level', type: 'select', section: 'Learning Profile', options: CONFIDENCE_OPTIONS },
  { key: 'motivation', label: 'Motivation', type: 'select', section: 'Learning Profile', options: [
    { value: 'intrinsic', label: 'Intrinsic' }, { value: 'extrinsic', label: 'Extrinsic' }, { value: 'low', label: 'Low' },
  ]},
  { key: 'parent_child_dynamic', label: 'Parent-child dynamic', type: 'select', section: 'Learning Profile', options: [
    { value: 'supportive', label: 'Supportive' }, { value: 'anxious', label: 'Anxious' },
    { value: 'disengaged', label: 'Disengaged' }, { value: 'hands_off', label: 'Hands off' },
  ]},
  { key: 'language_dominance', label: 'Language dominance', type: 'select', section: 'Learning Profile', options: LANGUAGE_OPTIONS },

  // -- Coach Recommendation --
  { key: 'coach_recommended_focus', label: 'Recommended focus areas', type: 'multi-select', section: 'Coach Recommendation', options: FOCUS_OPTIONS },
  { key: 'recommended_start_template', label: 'Recommended start template', type: 'text', section: 'Coach Recommendation', placeholder: 'e.g. M02, M03' },
  { key: 'coach_observations', label: 'Coach observations', type: 'text', section: 'Coach Recommendation', placeholder: 'Overall observations from this session...' },
];

// ============================================================
// Schema lookup by age band
// ============================================================
// ============================================================
// Exit Assessment Additional Fields (all age bands)
// ============================================================

const EXIT_FIELDS: DiagnosticField[] = [
  {
    key: 'overall_progress',
    label: 'Overall Progress',
    type: 'select',
    options: [
      { value: 'exceeded_expectations', label: 'Exceeded Expectations' },
      { value: 'on_track', label: 'On Track' },
      { value: 'below_expectations', label: 'Below Expectations' },
    ],
    required: true,
    section: 'Exit Assessment',
  },
  {
    key: 'biggest_achievement',
    label: 'Biggest Achievement',
    type: 'text',
    placeholder: 'What was this child\'s biggest breakthrough?',
    required: true,
    section: 'Exit Assessment',
  },
  {
    key: 'areas_still_developing',
    label: 'Areas Still Developing',
    type: 'multi-select',
    options: [
      { value: 'phonics', label: 'Phonics' },
      { value: 'decoding', label: 'Decoding' },
      { value: 'fluency', label: 'Fluency' },
      { value: 'comprehension', label: 'Comprehension' },
      { value: 'vocabulary', label: 'Vocabulary' },
      { value: 'grammar', label: 'Grammar' },
      { value: 'writing', label: 'Writing' },
      { value: 'confidence', label: 'Confidence' },
      { value: 'expression', label: 'Expression' },
    ],
    section: 'Exit Assessment',
  },
  {
    key: 'ready_for_next_season',
    label: 'Ready for Next Season?',
    type: 'select',
    options: [
      { value: 'yes', label: 'Yes — ready to progress' },
      { value: 'needs_consolidation', label: 'Needs consolidation at same level' },
      { value: 'not_ready', label: 'Not ready yet' },
    ],
    required: true,
    section: 'Exit Assessment',
  },
  {
    key: 'recommended_next_focus',
    label: 'Recommended Focus for Next Season',
    type: 'multi-select',
    options: [
      { value: 'phonics', label: 'Phonics' },
      { value: 'decoding', label: 'Decoding' },
      { value: 'fluency', label: 'Fluency' },
      { value: 'comprehension', label: 'Comprehension' },
      { value: 'vocabulary', label: 'Vocabulary' },
      { value: 'grammar', label: 'Grammar' },
      { value: 'writing', label: 'Writing' },
      { value: 'confidence', label: 'Confidence' },
      { value: 'stamina', label: 'Stamina' },
    ],
    section: 'Exit Assessment',
  },
  {
    key: 'parent_engagement_rating',
    label: 'Parent Engagement',
    type: 'select',
    options: [
      { value: 'excellent', label: 'Excellent' },
      { value: 'good', label: 'Good' },
      { value: 'minimal', label: 'Minimal' },
      { value: 'absent', label: 'Absent' },
    ],
    section: 'Exit Assessment',
  },
  {
    key: 'coach_notes_for_next_season',
    label: 'Notes for Next Season Coach',
    type: 'text',
    placeholder: 'Anything the next coach should know...',
    section: 'Exit Assessment',
  },
];

export function getDiagnosticFields(ageBand: string): DiagnosticField[] {
  switch (ageBand) {
    case 'foundation': return FOUNDATION_FIELDS;
    case 'building': return BUILDING_FIELDS;
    case 'mastery': return MASTERY_FIELDS;
    default: return BUILDING_FIELDS;
  }
}

export function getExitAssessmentFields(ageBand: string): DiagnosticField[] {
  // Exit assessment = same diagnostic fields + exit-specific fields
  return [...getDiagnosticFields(ageBand), ...EXIT_FIELDS];
}

export function getFieldSections(fields: DiagnosticField[]): string[] {
  const seen = new Set<string>();
  return fields.reduce<string[]>((acc, f) => {
    if (!seen.has(f.section)) {
      seen.add(f.section);
      acc.push(f.section);
    }
    return acc;
  }, []);
}
