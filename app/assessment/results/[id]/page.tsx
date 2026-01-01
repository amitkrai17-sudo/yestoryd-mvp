'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap,
  Volume2,
  MessageSquare,
  Calendar,
  BookOpen,
  Share2,
  Download,
  Mail,
  CheckCircle,
  Loader2,
  Sparkles,
  MessageCircle,
  Shield,
  Users,
  Star,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  BookOpenCheck,
} from 'lucide-react';

// Types for assessment data
interface ErrorClassification {
  substitutions: { original: string; read_as: string }[];
  omissions: string[];
  insertions: string[];
  reversals: { original: string; read_as: string }[];
  mispronunciations: { word: string; issue: string }[];
}

interface PhonicsAnalysis {
  struggling_phonemes: string[];
  phoneme_details: { phoneme: string; examples: string[]; frequency: string }[];
  strong_phonemes: string[];
  recommended_focus: string;
}

interface SkillScore {
  score: number;
  notes: string;
}

interface SkillBreakdown {
  decoding: SkillScore;
  sight_words: SkillScore;
  blending: SkillScore;
  segmenting: SkillScore;
  expression: SkillScore;
  comprehension_indicators: SkillScore;
}

interface PracticeRecommendations {
  daily_words: string[];
  phonics_focus: string;
  suggested_activity: string;
}

interface AssessmentData {
  childId: string;
  childName: string;
  childAge: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  overall_score: number;
  clarity_score: number;
  fluency_score: number;
  speed_score: number;
  wpm: number;
  completeness: number;
  feedback: string;
  errors: string[];
  strengths: string[];
  areas_to_improve: string[];
  error_classification?: ErrorClassification;
  phonics_analysis?: PhonicsAnalysis;
  skill_breakdown?: SkillBreakdown;
  practice_recommendations?: PracticeRecommendations;
}

// Score-based configuration
function getScoreConfig(score: number, childName: string) {
  if (score >= 8) {
    return {
      color: { bg: 'bg-green-500', text: 'text-green-400', ring: 'stroke-green-500' },
      label: 'Excellent!',
      emoji: '🌟',
      headline: `${childName} is a reading star!`,
      subheadline: 'Take their skills to the advanced level',
      primaryCTA: `Take ${childName} to Advanced Level`,
      ctaStyle: 'from-green-500 to-emerald-600',
    };
  }
  if (score >= 6) {
    return {
      color: { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'stroke-yellow-500' },
      label: 'Good Progress!',
      emoji: '⭐',
      headline: `${childName} shows great potential!`,
      subheadline: 'Unlock their full reading abilities',
      primaryCTA: `Unlock ${childName}'s Full Potential`,
      ctaStyle: 'from-yellow-500 to-amber-600',
    };
  }
  if (score >= 4) {
    return {
      color: { bg: 'bg-orange-500', text: 'text-orange-400', ring: 'stroke-orange-500' },
      label: 'Keep Practicing!',
      emoji: '💪',
      headline: `${childName} is ready to improve!`,
      subheadline: 'Accelerate their reading progress',
      primaryCTA: `Accelerate ${childName}'s Progress`,
      ctaStyle: 'from-orange-500 to-red-500',
    };
  }
  return {
    color: { bg: 'bg-red-500', text: 'text-red-400', ring: 'stroke-red-500' },
    label: 'Needs Support',
    emoji: '📚',
    headline: `${childName} needs expert guidance`,
    subheadline: 'Get personalized support from our coaches',
    primaryCTA: `Get ${childName} the Help They Need`,
    ctaStyle: 'from-red-500 to-pink-600',
  };
}

// Testimonials
const TESTIMONIALS = [
  {
    text: "My daughter's score improved from 4 to 8 in just 6 weeks! The personalized coaching made all the difference.",
    name: "Priya M.",
    child: "Mother of Ananya, Age 7",
    rating: 5,
  },
  {
    text: "The coaches understood exactly where my son was struggling. Now he actually enjoys reading!",
    name: "Rahul S.",
    child: "Father of Arjun, Age 9",
    rating: 5,
  },
  {
    text: "Best investment we made for our child's education. The progress reports helped us support her at home.",
    name: "Meera K.",
    child: "Mother of Diya, Age 6",
    rating: 5,
  },
];

// Phoneme display names
const PHONEME_LABELS: Record<string, string> = {
  'th': 'TH sound (the, this)',
  'ch': 'CH sound (chat, child)',
  'sh': 'SH sound (ship, shoe)',
  'wh': 'WH sound (what, when)',
  'bl': 'BL blend (blue, black)',
  'br': 'BR blend (brown, bring)',
  'cl': 'CL blend (clean, close)',
  'cr': 'CR blend (cry, cross)',
  'fl': 'FL blend (fly, flower)',
  'fr': 'FR blend (from, friend)',
  'gl': 'GL blend (glad, glass)',
  'gr': 'GR blend (green, great)',
  'pl': 'PL blend (play, please)',
  'pr': 'PR blend (pretty, prince)',
  'sl': 'SL blend (slow, sleep)',
  'sm': 'SM blend (small, smile)',
  'sn': 'SN blend (snow, snake)',
  'sp': 'SP blend (spot, speak)',
  'st': 'ST blend (stop, star)',
  'sw': 'SW blend (swim, sweet)',
  'tr': 'TR blend (tree, try)',
  'short_a': 'Short A (cat, bat)',
  'short_e': 'Short E (bed, red)',
  'short_i': 'Short I (sit, pig)',
  'short_o': 'Short O (hot, dog)',
  'short_u': 'Short U (cup, bus)',
  'long_a': 'Long A (cake, make)',
  'long_e': 'Long E (feet, tree)',
  'long_i': 'Long I (time, bike)',
  'long_o': 'Long O (home, boat)',
  'long_u': 'Long U (cute, tube)',
  'r_controlled': 'R-controlled vowels (car, bird)',
  'ar': 'AR sound (car, star)',
  'er': 'ER sound (her, fern)',
  'ir': 'IR sound (bird, girl)',
  'or': 'OR sound (for, born)',
  'ur': 'UR sound (fur, turn)',
};

// Skill icons and labels
const SKILL_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  decoding: { icon: <BookOpen className="w-4 h-4" />, label: 'Decoding', color: 'text-blue-400' },
  sight_words: { icon: <Zap className="w-4 h-4" />, label: 'Sight Words', color: 'text-yellow-400' },
  blending: { icon: <TrendingUp className="w-4 h-4" />, label: 'Blending', color: 'text-green-400' },
  segmenting: { icon: <Target className="w-4 h-4" />, label: 'Segmenting', color: 'text-purple-400' },
  expression: { icon: <MessageSquare className="w-4 h-4" />, label: 'Expression', color: 'text-pink-400' },
  comprehension_indicators: { icon: <Lightbulb className="w-4 h-4" />, label: 'Comprehension', color: 'text-orange-400' },
};

// Skill Bar Component
function SkillBar({ skill, data }: { skill: string; data: SkillScore }) {
  const config = SKILL_CONFIG[skill];
  if (!config || !data) return null;
  
  const percentage = (data.score / 10) * 100;
  
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-gray-300 text-sm">{config.label}</span>
        </div>
        <span className="text-white font-bold text-sm">{data.score}/10</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            data.score >= 7 ? 'bg-green-500' : data.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {data.notes && (
        <p className="text-gray-500 text-xs mt-1">{data.notes}</p>
      )}
    </div>
  );
}

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  icon, 
  children, 
  defaultOpen = false,
  badge,
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-pink-400">{icon}</span>
          <span className="text-white font-semibold">{title}</span>
          {badge && (
            <span className="bg-pink-500/20 text-pink-400 text-xs px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// Fluency label helper
function getFluencyLabel(score: number): string {
  if (score >= 8) return 'Smooth';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Choppy';
  return 'Developing';
}

// Clarity label helper
function getClarityLabel(score: number): string {
  if (score >= 8) return 'Clear';
  if (score >= 6) return 'Mostly Clear';
  if (score >= 4) return 'Inconsistent';
  return 'Unclear';
}

export default function ResultsPage() {
  const params = useParams();
  const childId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssessmentData | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Fetch assessment data
  useEffect(() => {
    async function fetchData() {
      if (!childId) {
        setError('No assessment ID provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/assessment/result/${childId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch assessment data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load assessment results');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [childId]);

  // Rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Send certificate email with ALL enhanced data
  const sendCertificateEmail = useCallback(async () => {
    if (!data?.parentEmail || emailSent || sendingEmail) return;
    setSendingEmail(true);
    try {
      const response = await fetch('/api/certificate/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Basic info
          email: data.parentEmail,
          childName: data.childName,
          childAge: data.childAge,
          // Scores
          score: data.overall_score,
          wpm: data.wpm,
          fluency: getFluencyLabel(data.fluency_score),
          pronunciation: getClarityLabel(data.clarity_score),
          clarityScore: data.clarity_score,
          fluencyScore: data.fluency_score,
          speedScore: data.speed_score,
          // Feedback
          feedback: data.feedback,
          strengths: data.strengths,
          areasToImprove: data.areas_to_improve,
          // Enhanced analysis
          phonicsAnalysis: data.phonics_analysis,
          skillBreakdown: data.skill_breakdown,
          errorClassification: data.error_classification,
          practiceRecommendations: data.practice_recommendations,
        }),
      });
      if (response.ok) setEmailSent(true);
    } catch (error) {
      console.error('Email error:', error);
    } finally {
      setSendingEmail(false);
    }
  }, [data, emailSent, sendingEmail]);

  useEffect(() => {
    if (data) {
      sendCertificateEmail();
    }
  }, [data, sendCertificateEmail]);

  // WhatsApp share
  const getWhatsAppMessage = useCallback(() => {
    if (!data) return '';
    
    const config = getScoreConfig(data.overall_score, data.childName);
    let phonicsNote = '';
    if (data.phonics_analysis?.recommended_focus) {
      phonicsNote = `\n🔤 *Focus Area:* ${data.phonics_analysis.recommended_focus}`;
    }
    
    const message = `🎉 *${data.childName}'s Reading Assessment Results*

${config.emoji} *Score: ${data.overall_score}/10* - ${config.label}
⚡ *Speed:* ${data.wpm} WPM
🎯 *Fluency:* ${getFluencyLabel(data.fluency_score)}
🗣️ *Clarity:* ${getClarityLabel(data.clarity_score)}
${phonicsNote}

📝 *Feedback:* ${data.feedback}

✉️ Certificate sent to email!

━━━━━━━━━━━━━━━
🚀 *Get FREE Assessment:*
https://yestoryd.com/assessment
━━━━━━━━━━━━━━━
Powered by *Yestoryd* - AI Reading Coach 📚`;
    return encodeURIComponent(message);
  }, [data]);

  const shareOnWhatsApp = () => {
    window.open(`https://wa.me/?text=${getWhatsAppMessage()}`, '_blank');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Oops! Something went wrong</p>
          <p className="text-gray-400 mb-4">{error || 'Assessment not found'}</p>
          <Link href="/assessment">
            <button className="px-6 py-3 bg-pink-500 text-white rounded-xl font-semibold">
              Take New Assessment
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const config = getScoreConfig(data.overall_score, data.childName);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (data.overall_score / 10) * circumference;

  // Count total errors
  const totalErrors = data.error_classification ? 
    (data.error_classification.substitutions?.length || 0) +
    (data.error_classification.omissions?.length || 0) +
    (data.error_classification.insertions?.length || 0) +
    (data.error_classification.reversals?.length || 0) +
    (data.error_classification.mispronunciations?.length || 0) : 0;

  // Build checkout URL
  const checkoutUrl = `/checkout?childId=${childId}&childName=${encodeURIComponent(data.childName)}&parentEmail=${encodeURIComponent(data.parentEmail)}&parentPhone=${encodeURIComponent(data.parentPhone || '')}&package=coaching-6&source=assessment`;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-pink-500">Yest</span>
              <span className="text-white">or</span>
              <span className="text-yellow-400">yd</span>
            </span>
          </Link>
          <button onClick={shareOnWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Certificate Card */}
        <div id="certificate" className="bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-700 print:shadow-none">
          {/* Header with Mascot */}
          <div className="bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 p-5 text-center border-b border-gray-600">
            <div className="w-24 h-24 mx-auto mb-3">
              <img
                src="/images/rai-mascot.png"
                alt="rAI - Yestoryd Mascot"
                className="w-full h-full object-contain drop-shadow-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50%" x="50%" dominant-baseline="middle" text-anchor="middle" font-size="60">📚</text></svg>';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Yestoryd</h1>
            <p className="text-gray-400 text-sm uppercase tracking-widest mt-1">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-6 text-center">
            <p className="text-blue-400 text-base font-semibold">Certificate of Achievement</p>
            <p className="text-gray-400 text-sm mt-1">Proudly presented to</p>
            <h2 className="text-3xl font-bold text-white mt-2">{data.childName}</h2>
            {data.childAge && <p className="text-gray-500 text-sm mt-1">Age {data.childAge}</p>}

            {/* Score Circle */}
            <div className="relative w-36 h-36 mx-auto my-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r={radius} stroke="#374151" strokeWidth="10" fill="none" />
                <circle
                  cx="72" cy="72" r={radius}
                  className={config.color.ring}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-5xl font-black ${config.color.text}`}>{data.overall_score}</span>
              </div>
            </div>

            {/* Score Label */}
            <div className={`inline-flex items-center gap-2 ${config.color.bg} text-white px-6 py-2 rounded-full text-base mb-5`}>
              <span className="text-xl">{config.emoji}</span>
              <span className="font-bold">{config.label}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-700/50 rounded-xl p-3">
                <Zap className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Speed</p>
                <p className="font-bold text-white text-lg">{data.wpm}</p>
                <p className="text-[10px] text-gray-500">WPM</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-3">
                <Volume2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Fluency</p>
                <p className="font-bold text-white text-base">{getFluencyLabel(data.fluency_score)}</p>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-3">
                <MessageSquare className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Clarity</p>
                <p className="font-bold text-white text-base">{getClarityLabel(data.clarity_score)}</p>
              </div>
            </div>

            {/* Feedback */}
            {data.feedback && (
              <div className="bg-gray-700/30 rounded-xl p-4 mb-5 text-left border border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-white text-base">Coach Feedback</span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{data.feedback}</p>
              </div>
            )}

            {/* Email Status with Spam Notice */}
            <div className="print:hidden">
              {data.parentEmail && (
                <div className="mb-4">
                  <div className={`flex items-center justify-center gap-2 text-sm ${emailSent ? 'text-green-400' : 'text-gray-500'}`}>
                    {sendingEmail ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending certificate...</>
                    ) : emailSent ? (
                      <><CheckCircle className="w-4 h-4" /> Certificate sent to {data.parentEmail}</>
                    ) : (
                      <><Mail className="w-4 h-4" /> Sending certificate...</>
                    )}
                  </div>
                  {emailSent && (
                    <div className="flex items-center justify-center gap-1 mt-1 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Check spam/junk folder if not in inbox</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <p className="text-gray-500 text-xs mt-3 print:mt-3">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ENHANCED ANALYSIS SECTIONS */}
        {/* ============================================================ */}
        
        {(data.skill_breakdown || data.phonics_analysis || data.error_classification) && (
          <div className="mt-6 space-y-3 print:hidden">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-pink-400" />
              Detailed Analysis
            </h3>

            {/* Skill Breakdown Section */}
            {data.skill_breakdown && (
              <CollapsibleSection 
                title="Reading Skills Breakdown" 
                icon={<Target className="w-5 h-5" />}
                defaultOpen={true}
              >
                <div className="pt-4">
                  {Object.entries(data.skill_breakdown).map(([skill, skillData]) => (
                    <SkillBar key={skill} skill={skill} data={skillData as SkillScore} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Phonics Analysis Section */}
            {data.phonics_analysis && (
              <CollapsibleSection 
                title="Phonics Analysis" 
                icon={<Volume2 className="w-5 h-5" />}
                badge={data.phonics_analysis.struggling_phonemes?.length 
                  ? `${data.phonics_analysis.struggling_phonemes.length} areas to improve` 
                  : undefined}
                defaultOpen={true}
              >
                <div className="pt-4 space-y-4">
                  {/* Recommended Focus */}
                  {data.phonics_analysis.recommended_focus && (
                    <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-4 h-4 text-pink-400" />
                        <span className="text-pink-400 font-semibold text-sm">Focus Area</span>
                      </div>
                      <p className="text-white text-sm">{data.phonics_analysis.recommended_focus}</p>
                    </div>
                  )}

                  {/* Struggling Phonemes */}
                  {data.phonics_analysis.struggling_phonemes?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Needs Practice</p>
                      <div className="flex flex-wrap gap-2">
                        {data.phonics_analysis.struggling_phonemes.map((phoneme, i) => (
                          <span 
                            key={i}
                            className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm border border-red-500/30"
                            title={PHONEME_LABELS[phoneme] || phoneme}
                          >
                            {phoneme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phoneme Details */}
                  {data.phonics_analysis.phoneme_details?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Specific Examples</p>
                      {data.phonics_analysis.phoneme_details.map((detail, i) => (
                        <div key={i} className="bg-gray-700/50 rounded-lg p-2 mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium">{detail.phoneme}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              detail.frequency === 'frequent' 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {detail.frequency}
                            </span>
                          </div>
                          <p className="text-gray-400 text-xs">
                            Examples: {detail.examples.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Strong Phonemes */}
                  {data.phonics_analysis.strong_phonemes?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Strong Areas ✓</p>
                      <div className="flex flex-wrap gap-2">
                        {data.phonics_analysis.strong_phonemes.map((phoneme, i) => (
                          <span 
                            key={i}
                            className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm border border-green-500/30"
                          >
                            {phoneme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Error Classification Section */}
            {data.error_classification && totalErrors > 0 && (
              <CollapsibleSection 
                title="Reading Errors" 
                icon={<AlertCircle className="w-5 h-5" />}
                badge={`${totalErrors} errors`}
              >
                <div className="pt-4 space-y-3">
                  {/* Substitutions */}
                  {data.error_classification.substitutions?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Substitutions (read wrong word)
                      </p>
                      <div className="space-y-1">
                        {data.error_classification.substitutions.map((sub, i) => (
                          <div key={i} className="bg-gray-700/50 rounded px-3 py-2 flex items-center gap-2 text-sm">
                            <span className="text-red-400 line-through">{sub.original}</span>
                            <ArrowRight className="w-3 h-3 text-gray-500" />
                            <span className="text-yellow-400">{sub.read_as}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Omissions */}
                  {data.error_classification.omissions?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Omissions (skipped words)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {data.error_classification.omissions.map((word, i) => (
                          <span key={i} className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-sm">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reversals */}
                  {data.error_classification.reversals?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Reversals (letters/words reversed)
                      </p>
                      <div className="space-y-1">
                        {data.error_classification.reversals.map((rev, i) => (
                          <div key={i} className="bg-gray-700/50 rounded px-3 py-2 flex items-center gap-2 text-sm">
                            <span className="text-red-400">{rev.original}</span>
                            <ArrowRight className="w-3 h-3 text-gray-500" />
                            <span className="text-yellow-400">{rev.read_as}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mispronunciations */}
                  {data.error_classification.mispronunciations?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        Mispronunciations
                      </p>
                      <div className="space-y-1">
                        {data.error_classification.mispronunciations.map((mis, i) => (
                          <div key={i} className="bg-gray-700/50 rounded px-3 py-2 text-sm">
                            <span className="text-white font-medium">{mis.word}:</span>{' '}
                            <span className="text-gray-400">{mis.issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Practice Recommendations Section */}
            {data.practice_recommendations && (
              <CollapsibleSection 
                title="Practice at Home" 
                icon={<Sparkles className="w-5 h-5" />}
                defaultOpen={true}
              >
                <div className="pt-4 space-y-4">
                  {/* Daily Words */}
                  {data.practice_recommendations.daily_words?.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                        📝 Words to Practice Daily
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {data.practice_recommendations.daily_words.map((word, i) => (
                          <span 
                            key={i}
                            className="bg-blue-500/20 text-blue-400 px-3 py-2 rounded-lg text-sm font-medium border border-blue-500/30"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phonics Focus */}
                  {data.practice_recommendations.phonics_focus && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-purple-400 font-semibold text-sm mb-1">🔤 Phonics Focus</p>
                      <p className="text-white text-sm">{data.practice_recommendations.phonics_focus}</p>
                    </div>
                  )}

                  {/* Suggested Activity */}
                  {data.practice_recommendations.suggested_activity && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                      <p className="text-green-400 font-semibold text-sm mb-1">🎯 Suggested Activity</p>
                      <p className="text-white text-sm">{data.practice_recommendations.suggested_activity}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Strengths & Areas to Improve */}
            {(data.strengths?.length || data.areas_to_improve?.length) && (
              <div className="grid grid-cols-2 gap-3">
                {data.strengths?.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                    <p className="text-green-400 font-semibold text-sm mb-2">✓ Strengths</p>
                    <ul className="space-y-1">
                      {data.strengths.map((s, i) => (
                        <li key={i} className="text-gray-300 text-xs">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.areas_to_improve?.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                    <p className="text-orange-400 font-semibold text-sm mb-2">↑ To Improve</p>
                    <ul className="space-y-1">
                      {data.areas_to_improve.map((a, i) => (
                        <li key={i} className="text-gray-300 text-xs">• {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CTA Section - Score Based */}
        <div className="mt-6 print:hidden">
          {/* Headline */}
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-white">{config.headline}</h3>
            <p className="text-gray-400 text-sm mt-1">{config.subheadline}</p>
          </div>

          {/* Primary CTA - Enroll */}
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-4">
            <Link href={checkoutUrl}>
              <button className={`w-full py-4 bg-gradient-to-r ${config.ctaStyle} text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] shadow-lg`}>
                {config.primaryCTA}
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>

            {/* Features */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>6 personalized coaching sessions for {data.childName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>Dedicated reading coach assigned</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>FREE access to all learning resources</span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-center gap-2 text-sm text-yellow-400">
              <Users className="w-4 h-4" />
              <span className="font-medium">🔥 12 parents enrolled today</span>
            </div>

            {/* Trust Badge */}
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Shield className="w-4 h-4 text-green-400" />
              <span>100% refund if not satisfied</span>
            </div>

            {/* Price */}
            <div className="mt-3 text-center">
              <span className="text-2xl font-bold text-white">₹5,999</span>
              <span className="text-gray-500 text-sm ml-2">one-time</span>
            </div>
          </div>

          {/* Secondary CTA - Talk to Coach (Discovery Call) */}
          <Link href={`/lets-talk?source=assessment&childName=${encodeURIComponent(data.childName)}&childAge=${encodeURIComponent(data.childAge || '')}&parentEmail=${encodeURIComponent(data.parentEmail)}&parentPhone=${encodeURIComponent(data.parentPhone || '')}`}>
            <button className="w-full py-3.5 bg-gray-700 text-white font-semibold rounded-xl text-base flex items-center justify-center gap-2 hover:bg-gray-600 transition-all border border-gray-600 mb-4">
              <Calendar className="w-5 h-5" />
              Talk to {data.childName}&apos;s Coach First
            </button>
          </Link>
          <p className="text-center text-xs text-gray-500 -mt-2 mb-4">Free 15-min call • No obligation</p>

          {/* Tertiary CTA - Share Results */}
          <button
            onClick={shareOnWhatsApp}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl text-base flex items-center justify-center gap-2 hover:bg-green-500 transition-all mb-6"
          >
            <MessageCircle className="w-5 h-5" />
            Share {data.childName}&apos;s Results
          </button>

          {/* Testimonial */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <div className="flex items-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-gray-300 text-sm italic mb-3">
              &ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {TESTIMONIALS[currentTestimonial].name.charAt(0)}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{TESTIMONIALS[currentTestimonial].name}</p>
                <p className="text-gray-500 text-xs">{TESTIMONIALS[currentTestimonial].child}</p>
              </div>
            </div>
            {/* Dots indicator */}
            <div className="flex justify-center gap-1 mt-3">
              {TESTIMONIALS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${i === currentTestimonial ? 'bg-pink-500 w-4' : 'bg-gray-600'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-5 grid grid-cols-2 gap-3 print:hidden">
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1.5 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-700 transition-all active:scale-95">
            <Download className="w-5 h-5" /> Download
          </button>
          <Link href="/assessment" className="flex flex-col items-center gap-1.5 p-3 bg-gray-800 border border-gray-700 text-gray-400 rounded-xl text-sm font-medium hover:bg-gray-700 transition-all active:scale-95">
            <Share2 className="w-5 h-5" /> Try Again
          </Link>
        </div>
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A5;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #1f2937 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          #certificate {
            width: 100%;
            max-width: 100%;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}