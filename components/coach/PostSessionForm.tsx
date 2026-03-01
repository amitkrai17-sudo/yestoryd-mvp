// =============================================================================
// FILE: components/coach/PostSessionForm.tsx
// PURPOSE: Comprehensive post-session form for ages 4-12
// COVERS: Reading, Grammar, Phonics, Creative Writing, Comprehension
// =============================================================================

'use client';

import { useState } from 'react';
import {
  X, CheckCircle, AlertCircle, Sparkles, TrendingUp, Target,
  BookOpen, Star, Zap, Award, ArrowRight, ArrowLeft, Clock,
  Calendar, Bell, MessageSquare, ThumbsUp, AlertTriangle,
  Brain, Heart, Trophy, Save, Loader2, FileText, Type, Mic,
  Search, PenTool, LayoutGrid, Lightbulb, LucideIcon
} from 'lucide-react';

// YESTORYD BRAND COLORS
const COLORS = {
  hotPink: '#00ABFF',
  electricBlue: '#00ABFF',
  yellow: '#FFDE00',
  deepPurple: '#0066CC',
  successGreen: '#10B981',
  warningOrange: '#F59E0B',
  errorRed: '#EF4444',
  dark: '#121212',
  darkGray: '#1E1E1E',
  mediumGray: '#2D2D2D',
  lightGray: '#404040'
};

interface PostSessionFormProps {
  sessionId: string;
  childName: string;
  childAge: number;
  sessionNumber: number;
  onClose: () => void;
  onComplete: () => void;
}

interface FormData {
  focusArea: string;
  progressRating: number;
  engagementLevel: number;
  confidenceLevel: number;
  whatWentWell: string[];
  struggles: string[];
  breakthroughMoment: string;
  skillsWorkedOn: string[];
  homeworkAssigned: boolean;
  homeworkDescription: string;
  homeworkDueDate: string;
  nextSessionFocus: string[];
  parentUpdateNeeded: boolean;
  coachNotes: string;
}

// COMPREHENSIVE FOCUS AREAS (All Ages 4-12)
const FOCUS_AREAS: { value: string; label: string; Icon: LucideIcon; ages: string }[] = [
  { value: 'phonics', label: 'Phonics & Letter Sounds', Icon: Type, ages: '4-12' },
  { value: 'reading_fluency', label: 'Reading Fluency', Icon: BookOpen, ages: '6-12' },
  { value: 'comprehension', label: 'Reading Comprehension', Icon: Brain, ages: '7-12' },
  { value: 'vocabulary', label: 'Vocabulary Building', Icon: LayoutGrid, ages: '6-12' },
  { value: 'grammar', label: 'Grammar & Syntax', Icon: PenTool, ages: '8-12' },
  { value: 'creative_writing', label: 'Creative Writing', Icon: Lightbulb, ages: '9-12' },
  { value: 'pronunciation', label: 'Pronunciation', Icon: Mic, ages: '4-12' },
  { value: 'story_analysis', label: 'Story Analysis', Icon: Search, ages: '10-12' },
];

// COMPREHENSIVE SKILLS (Ages 4-12, Organized by Level)
const SKILLS_OPTIONS = [
  // === LEVEL 1: Pre-Reading (Ages 4-6) ===
  { skill: 'Letter Recognition', level: 'Foundation', ages: '4-6' },
  { skill: 'Phonemic Awareness', level: 'Foundation', ages: '4-6' },
  { skill: 'Single Letter Sounds', level: 'Foundation', ages: '4-6' },
  { skill: 'CVC Words', level: 'Foundation', ages: '4-7' },
  { skill: 'Beginning/Ending Sounds', level: 'Foundation', ages: '4-6' },
  { skill: 'Rhyming Words', level: 'Foundation', ages: '4-7' },
  
  // === LEVEL 2: Early Reading (Ages 7-9) ===
  { skill: 'Consonant Blends', level: 'Building', ages: '6-9' },
  { skill: 'Digraphs (th, sh, ch, wh)', level: 'Building', ages: '6-9' },
  { skill: 'Long Vowels', level: 'Building', ages: '7-9' },
  { skill: 'Sight Words', level: 'Building', ages: '6-10' },
  { skill: 'Silent Letters', level: 'Building', ages: '7-10' },
  { skill: 'Vowel Teams', level: 'Building', ages: '7-10' },
  { skill: 'Simple Sentences', level: 'Building', ages: '7-9' },
  { skill: 'Short Stories', level: 'Building', ages: '7-10' },
  
  // === LEVEL 3: Fluent Reading (Ages 10-12) ===
  { skill: 'Complex Phonics', level: 'Mastery', ages: '9-12' },
  { skill: 'Advanced Vocabulary', level: 'Mastery', ages: '10-12' },
  { skill: 'Reading Comprehension', level: 'Mastery', ages: '8-12' },
  { skill: 'Paragraph Reading', level: 'Mastery', ages: '9-12' },
  { skill: 'Story Analysis', level: 'Mastery', ages: '10-12' },
  
  // === CROSS-LEVEL: Universal Skills ===
  { skill: 'Reading Speed', level: 'All Levels', ages: '6-12' },
  { skill: 'Expression & Intonation', level: 'All Levels', ages: '6-12' },
  { skill: 'Punctuation Awareness', level: 'All Levels', ages: '7-12' },
  { skill: 'Context Clues', level: 'All Levels', ages: '8-12' },
  
  // === GRAMMAR (Ages 8-12) ===
  { skill: 'Parts of Speech', level: 'Grammar', ages: '8-12' },
  { skill: 'Sentence Structure', level: 'Grammar', ages: '8-12' },
  { skill: 'Tenses', level: 'Grammar', ages: '9-12' },
  { skill: 'Subject-Verb Agreement', level: 'Grammar', ages: '9-12' },
  
  // === CREATIVE WRITING (Ages 9-12) ===
  { skill: 'Paragraph Writing', level: 'Writing', ages: '9-12' },
  { skill: 'Story Writing', level: 'Writing', ages: '9-12' },
  { skill: 'Descriptive Writing', level: 'Writing', ages: '10-12' },
  { skill: 'Essay Writing', level: 'Writing', ages: '11-12' },
];

// FOCUS-SPECIFIC QUICK PICKS FOR "WHAT WENT WELL"
const FOCUS_HIGHLIGHTS: Record<string, { placeholder: string; quickPicks: string[] }> = {
  'phonics': {
    placeholder: "e.g., Mastered 'th' digraph sounds perfectly",
    quickPicks: [
      'Digraph sounds (th, sh, ch, wh)',
      'CVC blending improved',
      'Letter-sound recognition',
      'Phoneme segmentation',
      'Beginning/ending sounds',
      'Vowel sounds (short/long)',
    ]
  },
  'reading_fluency': {
    placeholder: "e.g., Reading speed improved, fewer pauses",
    quickPicks: [
      'Reading speed improved',
      'Fewer pauses/hesitations',
      'Better expression/prosody',
      'Self-correction improved',
      'Sight word recognition',
      'Smoother phrasing',
    ]
  },
  'comprehension': {
    placeholder: "e.g., Understood main idea, made predictions",
    quickPicks: [
      'Identified main idea',
      'Made predictions',
      'Answered questions accurately',
      'Made text connections',
      'Understood sequence of events',
      'Drew inferences',
    ]
  },
  'vocabulary': {
    placeholder: "e.g., Learned 5 new words, used context clues",
    quickPicks: [
      'Learned new words',
      'Used context clues',
      'Word families understood',
      'Synonyms/antonyms',
      'Applied words in sentences',
      'Dictionary skills improved',
    ]
  },
  'grammar': {
    placeholder: "e.g., Subject-verb agreement, punctuation rules",
    quickPicks: [
      'Subject-verb agreement',
      'Punctuation improved',
      'Sentence structure',
      'Tense consistency',
      'Parts of speech',
      'Capitalization rules',
    ]
  },
  'creative_writing': {
    placeholder: "e.g., Wrote complete story with beginning, middle, end",
    quickPicks: [
      'Story structure improved',
      'Descriptive language used',
      'Character development',
      'Creative ideas expressed',
      'Organized paragraphs',
      'Dialogue writing',
    ]
  },
  'pronunciation': {
    placeholder: "e.g., Clear articulation of difficult sounds",
    quickPicks: [
      'Clear articulation',
      'Difficult sounds improved',
      'Word stress patterns',
      'Intonation improved',
      'Blending sounds smoothly',
      'Self-monitoring speech',
    ]
  },
  'story_analysis': {
    placeholder: "e.g., Identified theme, analyzed characters",
    quickPicks: [
      'Identified theme/moral',
      'Character analysis',
      'Plot understanding',
      'Setting description',
      'Problem/solution identified',
      "Author's purpose understood",
    ]
  }
};

// FOCUS-SPECIFIC QUICK PICKS FOR "CHALLENGES"
const FOCUS_CHALLENGES: Record<string, string[]> = {
  'phonics': [
    'Confused similar sounds (b/d, p/q)',
    'Struggling with blends',
    'Vowel sound confusion',
    'Difficulty with digraphs',
  ],
  'reading_fluency': [
    'Reading too fast/slow',
    'Frequent pauses',
    'Monotone reading',
    'Skipping words',
  ],
  'comprehension': [
    'Difficulty recalling details',
    'Struggled with inference',
    'Lost track of story',
    'Trouble summarizing',
  ],
  'vocabulary': [
    'Limited word recognition',
    'Difficulty with context clues',
    'Forgetting new words',
    'Trouble with word meanings',
  ],
  'grammar': [
    'Tense confusion',
    'Subject-verb errors',
    'Run-on sentences',
    'Punctuation mistakes',
  ],
  'creative_writing': [
    'Difficulty starting',
    'Lacking story structure',
    'Limited vocabulary use',
    'Trouble with paragraphs',
  ],
  'pronunciation': [
    'Unclear articulation',
    'Mispronouncing words',
    'Stress pattern errors',
    'Speaking too fast/slow',
  ],
  'story_analysis': [
    'Difficulty finding theme',
    'Trouble with character traits',
    'Confused about plot',
    'Missed key details',
  ],
};

// NEXT SESSION FOCUS OPTIONS (Age-Appropriate)
const NEXT_FOCUS_OPTIONS = [
  'Continue Current Level',
  'Increase Difficulty',
  'Review & Reinforce Basics',
  'New Phonics Pattern',
  'Longer Reading Passages',
  'Timed Reading Practice',
  'Comprehension Questions',
  'Creative Writing Exercise',
  'Grammar Focus',
  'Vocabulary Expansion',
  'Story Analysis',
  'Parent Practice Required',
];

export default function PostSessionForm({
  sessionId,
  childName,
  childAge,
  sessionNumber,
  onClose,
  onComplete
}: PostSessionFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    focusArea: '',
    progressRating: 0,
    engagementLevel: 0,
    confidenceLevel: 0,
    whatWentWell: [],
    struggles: [],
    breakthroughMoment: '',
    skillsWorkedOn: [],
    homeworkAssigned: false,
    homeworkDescription: '',
    homeworkDueDate: '',
    nextSessionFocus: [],
    parentUpdateNeeded: false,
    coachNotes: ''
  });

  const [wellInput, setWellInput] = useState('');
  const [struggleInput, setStruggleInput] = useState('');

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  // Filter skills relevant to child's age
  const relevantSkills = SKILLS_OPTIONS.filter(s => {
    const [minAge, maxAge] = s.ages.split('-').map(Number);
    return childAge >= minAge && childAge <= maxAge;
  });

  // Validation
  const isStep1Valid = 
    formData.focusArea &&
    formData.progressRating > 0 &&
    formData.engagementLevel > 0 &&
    formData.confidenceLevel > 0 &&
    formData.whatWentWell.length > 0;

  const isStep2Valid =
    formData.skillsWorkedOn.length > 0 &&
    formData.nextSessionFocus.length > 0 &&
    (!formData.homeworkAssigned || (formData.homeworkDescription && formData.homeworkDueDate));

  // Handlers
  const handleAddWell = () => {
    if (wellInput.trim() && formData.whatWentWell.length < 5) {
      setFormData(prev => ({
        ...prev,
        whatWentWell: [...prev.whatWentWell, wellInput.trim()]
      }));
      setWellInput('');
    }
  };

  const handleRemoveWell = (index: number) => {
    setFormData(prev => ({
      ...prev,
      whatWentWell: prev.whatWentWell.filter((_, i) => i !== index)
    }));
  };

  const handleAddStruggle = () => {
    if (struggleInput.trim() && formData.struggles.length < 5) {
      setFormData(prev => ({
        ...prev,
        struggles: [...prev.struggles, struggleInput.trim()]
      }));
      setStruggleInput('');
    }
  };

  const handleRemoveStruggle = (index: number) => {
    setFormData(prev => ({
      ...prev,
      struggles: prev.struggles.filter((_, i) => i !== index)
    }));
  };

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skillsWorkedOn: prev.skillsWorkedOn.includes(skill)
        ? prev.skillsWorkedOn.filter(s => s !== skill)
        : [...prev.skillsWorkedOn, skill]
    }));
  };

  const toggleFocus = (focus: string) => {
    setFormData(prev => ({
      ...prev,
      nextSessionFocus: prev.nextSessionFocus.includes(focus)
        ? prev.nextSessionFocus.filter(f => f !== focus)
        : [...prev.nextSessionFocus, focus]
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/coach/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          focusArea: formData.focusArea,
          progressRating: formData.progressRating,
          engagementLevel: formData.engagementLevel,
          confidenceLevel: formData.confidenceLevel,
          sessionHighlights: formData.whatWentWell,
          sessionStruggles: formData.struggles,
          breakthroughMoment: formData.breakthroughMoment,
          skillsWorkedOn: formData.skillsWorkedOn,
          homeworkAssigned: formData.homeworkAssigned,
          homeworkDescription: formData.homeworkDescription,
          homeworkDueDate: formData.homeworkDueDate || null,
          nextSessionFocus: formData.nextSessionFocus,
          parentUpdateNeeded: formData.parentUpdateNeeded,
          coachNotes: formData.coachNotes,
          completedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to complete session');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div 
        className="rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkGray} 50%, ${COLORS.dark} 100%)`,
          border: `1px solid ${COLORS.mediumGray}`
        }}
      >
        
        {/* Header */}
        <div 
          className="relative p-6"
          style={{
            background: `linear-gradient(135deg, ${COLORS.hotPink} 0%, ${COLORS.deepPurple} 50%, ${COLORS.electricBlue} 100%)`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Session Complete
                  <Sparkles className="w-5 h-5" style={{ color: COLORS.yellow }} />
                </h2>
                <p className="text-white/80 text-sm">
                  {childName} ({childAge} years) • Session #{sessionNumber}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-xl transition-all"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-white/70">Step {step} of {totalSteps}</span>
              <span className="text-xs font-medium text-white/70">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${COLORS.yellow} 0%, ${COLORS.hotPink} 100%)`
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-280px)] overflow-y-auto">
          {error && (
            <div 
              className="mb-4 p-4 rounded-xl flex items-start gap-3"
              style={{ 
                background: `${COLORS.errorRed}15`,
                border: `1px solid ${COLORS.errorRed}40`
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: COLORS.errorRed }} />
              <p className="text-sm" style={{ color: COLORS.errorRed }}>{error}</p>
            </div>
          )}

          {/* Step 1: Session Feedback */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Focus Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: COLORS.hotPink }} />
                  What was the main focus today?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {FOCUS_AREAS.map((area) => {
                    const isSelected = formData.focusArea === area.value;
                    return (
                      <button
                        key={area.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, focusArea: area.value }))}
                        className="p-4 rounded-xl border transition-all text-left"
                        style={{
                          borderColor: isSelected ? COLORS.hotPink : COLORS.mediumGray,
                          background: isSelected ? `${COLORS.hotPink}15` : `${COLORS.darkGray}50`,
                          boxShadow: isSelected ? `0 4px 12px ${COLORS.hotPink}25` : 'none'
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isSelected ? `${COLORS.hotPink}20` : `${COLORS.lightGray}50`
                            }}
                          >
                            <area.Icon
                              className="w-5 h-5"
                              style={{ color: isSelected ? COLORS.hotPink : '#9CA3AF' }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white block leading-tight">{area.label}</span>
                            <span className="text-xs text-gray-500 mt-0.5 block">{area.ages} years</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ratings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Progress */}
                <div 
                  className="p-4 rounded-xl"
                  style={{ 
                    background: `${COLORS.successGreen}10`,
                    border: `1px solid ${COLORS.successGreen}30`
                  }}
                >
                  <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" style={{ color: COLORS.successGreen }} />
                    Progress
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, progressRating: rating }))}
                        className="flex-1 aspect-square rounded-lg transition-all"
                        style={{
                          background: formData.progressRating >= rating ? COLORS.successGreen : `${COLORS.darkGray}80`,
                          boxShadow: formData.progressRating >= rating ? `0 4px 12px ${COLORS.successGreen}40` : 'none'
                        }}
                      >
                        <Star 
                          className="w-4 h-4 mx-auto" 
                          style={{ 
                            color: formData.progressRating >= rating ? 'white' : '#666',
                            fill: formData.progressRating >= rating ? 'white' : 'none'
                          }} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Engagement */}
                <div 
                  className="p-4 rounded-xl"
                  style={{ 
                    background: `${COLORS.electricBlue}10`,
                    border: `1px solid ${COLORS.electricBlue}30`
                  }}
                >
                  <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: COLORS.electricBlue }} />
                    Engagement
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, engagementLevel: rating }))}
                        className="flex-1 aspect-square rounded-lg transition-all"
                        style={{
                          background: formData.engagementLevel >= rating ? COLORS.electricBlue : `${COLORS.darkGray}80`,
                          boxShadow: formData.engagementLevel >= rating ? `0 4px 12px ${COLORS.electricBlue}40` : 'none'
                        }}
                      >
                        <Heart 
                          className="w-4 h-4 mx-auto" 
                          style={{ 
                            color: formData.engagementLevel >= rating ? 'white' : '#666',
                            fill: formData.engagementLevel >= rating ? 'white' : 'none'
                          }} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confidence */}
                <div 
                  className="p-4 rounded-xl"
                  style={{ 
                    background: `${COLORS.deepPurple}10`,
                    border: `1px solid ${COLORS.deepPurple}30`
                  }}
                >
                  <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4" style={{ color: COLORS.deepPurple }} />
                    Confidence
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, confidenceLevel: rating }))}
                        className="flex-1 aspect-square rounded-lg transition-all"
                        style={{
                          background: formData.confidenceLevel >= rating ? COLORS.deepPurple : `${COLORS.darkGray}80`,
                          boxShadow: formData.confidenceLevel >= rating ? `0 4px 12px ${COLORS.deepPurple}40` : 'none'
                        }}
                      >
                        <Trophy 
                          className="w-4 h-4 mx-auto" 
                          style={{ 
                            color: formData.confidenceLevel >= rating ? 'white' : '#666',
                            fill: formData.confidenceLevel >= rating ? 'white' : 'none'
                          }} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* What Went Well */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" style={{ color: COLORS.successGreen }} />
                  What went well? <span style={{ color: COLORS.successGreen }}>*</span>
                </label>

                {/* Quick Pick Tags - Only show if focus is selected */}
                {formData.focusArea && FOCUS_HIGHLIGHTS[formData.focusArea] && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {FOCUS_HIGHLIGHTS[formData.focusArea].quickPicks.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          if (!formData.whatWentWell.includes(skill) && formData.whatWentWell.length < 5) {
                            setFormData(prev => ({
                              ...prev,
                              whatWentWell: [...prev.whatWentWell, skill]
                            }));
                          }
                        }}
                        disabled={formData.whatWentWell.includes(skill) || formData.whatWentWell.length >= 5}
                        className="px-3 py-1.5 text-xs rounded-full border transition-all"
                        style={{
                          background: formData.whatWentWell.includes(skill)
                            ? `${COLORS.successGreen}20`
                            : COLORS.darkGray,
                          borderColor: formData.whatWentWell.includes(skill)
                            ? `${COLORS.successGreen}50`
                            : COLORS.mediumGray,
                          color: formData.whatWentWell.includes(skill)
                            ? COLORS.successGreen
                            : '#D1D5DB',
                          cursor: formData.whatWentWell.includes(skill) || formData.whatWentWell.length >= 5
                            ? 'not-allowed'
                            : 'pointer',
                          opacity: formData.whatWentWell.length >= 5 && !formData.whatWentWell.includes(skill) ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!formData.whatWentWell.includes(skill) && formData.whatWentWell.length < 5) {
                            e.currentTarget.style.borderColor = COLORS.hotPink;
                            e.currentTarget.style.color = 'white';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!formData.whatWentWell.includes(skill)) {
                            e.currentTarget.style.borderColor = COLORS.mediumGray;
                            e.currentTarget.style.color = '#D1D5DB';
                          }
                        }}
                      >
                        {formData.whatWentWell.includes(skill) ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {skill}
                          </span>
                        ) : (
                          `+ ${skill}`
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No Focus Selected State */}
                {!formData.focusArea && (
                  <div
                    className="text-center py-3 mb-3 rounded-xl"
                    style={{
                      background: `${COLORS.darkGray}50`,
                      border: `1px dashed ${COLORS.mediumGray}`
                    }}
                  >
                    <AlertCircle className="w-5 h-5 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm text-gray-500">Select a focus area above to see relevant suggestions</p>
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={wellInput}
                    onChange={(e) => setWellInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddWell()}
                    placeholder={
                      formData.focusArea && FOCUS_HIGHLIGHTS[formData.focusArea]
                        ? FOCUS_HIGHLIGHTS[formData.focusArea].placeholder
                        : "Add a highlight..."
                    }
                    className="flex-1 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
                    style={{
                      background: COLORS.darkGray,
                      border: `1px solid ${COLORS.mediumGray}`,
                      ...(wellInput ? { borderColor: COLORS.electricBlue } : {})
                    }}
                    disabled={formData.whatWentWell.length >= 5}
                  />
                  <button
                    type="button"
                    onClick={handleAddWell}
                    disabled={!wellInput.trim() || formData.whatWentWell.length >= 5}
                    className="px-6 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: COLORS.successGreen }}
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.whatWentWell.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-xl group"
                      style={{
                        background: `${COLORS.successGreen}10`,
                        border: `1px solid ${COLORS.successGreen}30`
                      }}
                    >
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: COLORS.successGreen }} />
                      <span className="flex-1 text-sm text-gray-300">{item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWell(index)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
                        style={{ background: `${COLORS.errorRed}20` }}
                      >
                        <X className="w-4 h-4" style={{ color: COLORS.errorRed }} />
                      </button>
                    </div>
                  ))}
                  {formData.whatWentWell.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Add at least one highlight</p>
                  )}
                </div>
              </div>

              {/* Struggles */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" style={{ color: COLORS.warningOrange }} />
                  Any challenges? <span className="text-gray-500 text-xs">(Optional)</span>
                </label>

                {/* Quick Pick Tags - Only show if focus is selected */}
                {formData.focusArea && FOCUS_CHALLENGES[formData.focusArea] && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {FOCUS_CHALLENGES[formData.focusArea].map((challenge) => (
                      <button
                        key={challenge}
                        type="button"
                        onClick={() => {
                          if (!formData.struggles.includes(challenge) && formData.struggles.length < 5) {
                            setFormData(prev => ({
                              ...prev,
                              struggles: [...prev.struggles, challenge]
                            }));
                          }
                        }}
                        disabled={formData.struggles.includes(challenge) || formData.struggles.length >= 5}
                        className="px-3 py-1.5 text-xs rounded-full border transition-all"
                        style={{
                          background: formData.struggles.includes(challenge)
                            ? `${COLORS.warningOrange}20`
                            : COLORS.darkGray,
                          borderColor: formData.struggles.includes(challenge)
                            ? `${COLORS.warningOrange}50`
                            : COLORS.mediumGray,
                          color: formData.struggles.includes(challenge)
                            ? COLORS.warningOrange
                            : '#D1D5DB',
                          cursor: formData.struggles.includes(challenge) || formData.struggles.length >= 5
                            ? 'not-allowed'
                            : 'pointer',
                          opacity: formData.struggles.length >= 5 && !formData.struggles.includes(challenge) ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!formData.struggles.includes(challenge) && formData.struggles.length < 5) {
                            e.currentTarget.style.borderColor = COLORS.hotPink;
                            e.currentTarget.style.color = 'white';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!formData.struggles.includes(challenge)) {
                            e.currentTarget.style.borderColor = COLORS.mediumGray;
                            e.currentTarget.style.color = '#D1D5DB';
                          }
                        }}
                      >
                        {formData.struggles.includes(challenge) ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {challenge}
                          </span>
                        ) : (
                          `+ ${challenge}`
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={struggleInput}
                    onChange={(e) => setStruggleInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddStruggle()}
                    placeholder={
                      formData.focusArea
                        ? "Add a specific challenge..."
                        : "e.g., Confused with silent 'e' rules"
                    }
                    className="flex-1 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
                    style={{
                      background: COLORS.darkGray,
                      border: `1px solid ${COLORS.mediumGray}`,
                      ...(struggleInput ? { borderColor: COLORS.warningOrange } : {})
                    }}
                    disabled={formData.struggles.length >= 5}
                  />
                  <button
                    type="button"
                    onClick={handleAddStruggle}
                    disabled={!struggleInput.trim() || formData.struggles.length >= 5}
                    className="px-6 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: COLORS.warningOrange }}
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.struggles.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-xl group"
                      style={{
                        background: `${COLORS.warningOrange}10`,
                        border: `1px solid ${COLORS.warningOrange}30`
                      }}
                    >
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: COLORS.warningOrange }} />
                      <span className="flex-1 text-sm text-gray-300">{item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStruggle(index)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
                        style={{ background: `${COLORS.errorRed}20` }}
                      >
                        <X className="w-4 h-4" style={{ color: COLORS.errorRed }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakthrough Moment */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4" style={{ color: COLORS.yellow }} />
                  Breakthrough moment? <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={formData.breakthroughMoment}
                  onChange={(e) => setFormData(prev => ({ ...prev, breakthroughMoment: e.target.value }))}
                  placeholder="Describe any 'aha!' moments or special achievements..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none"
                  style={{ 
                    background: COLORS.darkGray,
                    border: `1px solid ${COLORS.mediumGray}`,
                    ...(formData.breakthroughMoment ? { borderColor: COLORS.yellow } : {})
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Action Items */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Age-Appropriate Skills */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" style={{ color: COLORS.electricBlue }} />
                  Skills practiced today <span style={{ color: COLORS.electricBlue }}>*</span>
                  <span className="text-xs text-gray-500 ml-2">
                    (Age-appropriate for {childAge} years)
                  </span>
                </label>
                
                {/* Group by level */}
                {['Foundation', 'Building', 'Mastery', 'All Levels', 'Grammar', 'Writing'].map(level => {
                  const levelSkills = relevantSkills.filter(s => s.level === level);
                  if (levelSkills.length === 0) return null;
                  
                  return (
                    <div key={level} className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                        {level}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {levelSkills.map((item) => (
                          <button
                            key={item.skill}
                            type="button"
                            onClick={() => toggleSkill(item.skill)}
                            className="p-3 rounded-xl border-2 text-sm font-medium transition-all text-left"
                            style={{
                              borderColor: formData.skillsWorkedOn.includes(item.skill) ? COLORS.electricBlue : COLORS.mediumGray,
                              background: formData.skillsWorkedOn.includes(item.skill) ? `${COLORS.electricBlue}15` : `${COLORS.darkGray}80`,
                              color: formData.skillsWorkedOn.includes(item.skill) ? 'white' : '#999',
                              boxShadow: formData.skillsWorkedOn.includes(item.skill) ? `0 4px 12px ${COLORS.electricBlue}30` : 'none'
                            }}
                          >
                            {item.skill}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Next Session Focus */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: COLORS.deepPurple }} />
                  Next session focus <span style={{ color: COLORS.deepPurple }}>*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {NEXT_FOCUS_OPTIONS.map((focus) => (
                    <button
                      key={focus}
                      type="button"
                      onClick={() => toggleFocus(focus)}
                      className="p-3 rounded-xl border-2 text-sm font-medium transition-all"
                      style={{
                        borderColor: formData.nextSessionFocus.includes(focus) ? COLORS.deepPurple : COLORS.mediumGray,
                        background: formData.nextSessionFocus.includes(focus) ? `${COLORS.deepPurple}15` : `${COLORS.darkGray}80`,
                        color: formData.nextSessionFocus.includes(focus) ? 'white' : '#999',
                        boxShadow: formData.nextSessionFocus.includes(focus) ? `0 4px 12px ${COLORS.deepPurple}30` : 'none'
                      }}
                    >
                      {focus}
                    </button>
                  ))}
                </div>
              </div>

              {/* Homework */}
              <div 
                className="p-5 rounded-2xl"
                style={{ 
                  background: `${COLORS.hotPink}10`,
                  border: `1px solid ${COLORS.hotPink}30`
                }}
              >
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div 
                    className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all"
                    style={{
                      background: formData.homeworkAssigned ? COLORS.hotPink : 'transparent',
                      borderColor: formData.homeworkAssigned ? COLORS.hotPink : '#666'
                    }}
                  >
                    {formData.homeworkAssigned && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.homeworkAssigned}
                    onChange={(e) => setFormData(prev => ({ ...prev, homeworkAssigned: e.target.checked }))}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" style={{ color: COLORS.hotPink }} />
                    Assign homework for practice
                  </span>
                </label>

                {formData.homeworkAssigned && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Homework Description <span style={{ color: COLORS.hotPink }}>*</span>
                      </label>
                      <textarea
                        value={formData.homeworkDescription}
                        onChange={(e) => setFormData(prev => ({ ...prev, homeworkDescription: e.target.value }))}
                        placeholder="e.g., Read 'The Magic Tree' chapter 1 focusing on 'ch' digraphs"
                        rows={3}
                        className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none"
                        style={{ 
                          background: COLORS.darkGray,
                          border: `1px solid ${COLORS.mediumGray}`,
                          ...(formData.homeworkDescription ? { borderColor: COLORS.hotPink } : {})
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Due Date <span style={{ color: COLORS.hotPink }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.homeworkDueDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, homeworkDueDate: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all"
                        style={{ 
                          background: COLORS.darkGray,
                          border: `1px solid ${COLORS.mediumGray}`,
                          ...(formData.homeworkDueDate ? { borderColor: COLORS.hotPink } : {})
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Parent Update */}
              <div 
                className="p-5 rounded-2xl"
                style={{ 
                  background: `${COLORS.yellow}10`,
                  border: `1px solid ${COLORS.yellow}30`
                }}
              >
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div 
                    className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all"
                    style={{
                      background: formData.parentUpdateNeeded ? COLORS.yellow : 'transparent',
                      borderColor: formData.parentUpdateNeeded ? COLORS.yellow : '#666'
                    }}
                  >
                    {formData.parentUpdateNeeded && <Bell className="w-4 h-4 text-gray-900" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.parentUpdateNeeded}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentUpdateNeeded: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" style={{ color: COLORS.yellow }} />
                      Parent needs immediate update
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Check this if something important happened today
                    </p>
                  </div>
                </label>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  Additional notes <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <textarea
                  value={formData.coachNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, coachNotes: e.target.value }))}
                  placeholder="Any other observations or notes for future reference..."
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none"
                  style={{ 
                    background: COLORS.darkGray,
                    border: `1px solid ${COLORS.mediumGray}`
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.hotPink} 0%, ${COLORS.deepPurple} 100%)`,
                    animation: 'bounce 2s infinite'
                  }}
                >
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Ready to Submit?</h3>
                <p className="text-gray-400">Review your session feedback before submitting</p>
              </div>

              {/* Summary */}
              <div className="space-y-3">
                {/* Ratings */}
                <div 
                  className="p-4 rounded-xl"
                  style={{ 
                    background: `${COLORS.darkGray}80`,
                    border: `1px solid ${COLORS.mediumGray}`
                  }}
                >
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Session Ratings</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: COLORS.successGreen }}>
                        {formData.progressRating}/5
                      </div>
                      <div className="text-xs text-gray-500">Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: COLORS.electricBlue }}>
                        {formData.engagementLevel}/5
                      </div>
                      <div className="text-xs text-gray-500">Engagement</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: COLORS.deepPurple }}>
                        {formData.confidenceLevel}/5
                      </div>
                      <div className="text-xs text-gray-500">Confidence</div>
                    </div>
                  </div>
                </div>

                {/* Highlights */}
                {formData.whatWentWell.length > 0 && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ 
                      background: `${COLORS.successGreen}10`,
                      border: `1px solid ${COLORS.successGreen}30`
                    }}
                  >
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.successGreen }}>
                      <ThumbsUp className="w-4 h-4" />
                      Highlights ({formData.whatWentWell.length})
                    </h4>
                    <ul className="space-y-1">
                      {formData.whatWentWell.map((item, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: COLORS.successGreen }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Skills */}
                {formData.skillsWorkedOn.length > 0 && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ 
                      background: `${COLORS.electricBlue}10`,
                      border: `1px solid ${COLORS.electricBlue}30`
                    }}
                  >
                    <h4 className="text-sm font-semibold mb-2" style={{ color: COLORS.electricBlue }}>
                      Skills Practiced ({formData.skillsWorkedOn.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.skillsWorkedOn.map((skill, i) => (
                        <span 
                          key={i} 
                          className="text-xs px-3 py-1 rounded-full"
                          style={{ 
                            background: `${COLORS.electricBlue}20`,
                            color: COLORS.electricBlue
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Homework */}
                {formData.homeworkAssigned && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ 
                      background: `${COLORS.hotPink}10`,
                      border: `1px solid ${COLORS.hotPink}30`
                    }}
                  >
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.hotPink }}>
                      <BookOpen className="w-4 h-4" />
                      Homework Assigned
                    </h4>
                    <p className="text-sm text-gray-300">{formData.homeworkDescription}</p>
                    {formData.homeworkDueDate && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(formData.homeworkDueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                )}

                {/* Next Focus */}
                {formData.nextSessionFocus.length > 0 && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ 
                      background: `${COLORS.deepPurple}10`,
                      border: `1px solid ${COLORS.deepPurple}30`
                    }}
                  >
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: COLORS.deepPurple }}>
                      <Target className="w-4 h-4" />
                      Next Session Focus
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.nextSessionFocus.map((focus, i) => (
                        <span 
                          key={i} 
                          className="text-xs px-3 py-1 rounded-full"
                          style={{ 
                            background: `${COLORS.deepPurple}20`,
                            color: COLORS.deepPurple
                          }}
                        >
                          {focus}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parent Update */}
                {formData.parentUpdateNeeded && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ 
                      background: `${COLORS.yellow}10`,
                      border: `1px solid ${COLORS.yellow}30`
                    }}
                  >
                    <p className="text-sm flex items-center gap-2" style={{ color: COLORS.yellow }}>
                      <Bell className="w-4 h-4" />
                      Parent will be notified about this session
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="p-6 border-t"
          style={{ 
            background: `${COLORS.dark}80`,
            borderColor: COLORS.mediumGray
          }}
        >
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: COLORS.lightGray }}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            
            {step < totalSteps ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.hotPink} 0%, ${COLORS.deepPurple} 100%)`,
                  boxShadow: `0 8px 20px ${COLORS.hotPink}30`
                }}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.successGreen} 0%, #059669 100%)`,
                  boxShadow: `0 8px 20px ${COLORS.successGreen}40`
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Complete Session
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}