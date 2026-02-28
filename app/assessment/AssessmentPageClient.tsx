'use client';

import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { AudioRecorderCheck } from '@/components/assessment/AudioRecorderCheck';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  CheckCircle2,
  Sparkles,
  Clock,
  BookOpen,
  Star,
  Phone,
  Mail,
  User,
  Baby,
  ChevronDown,
  Loader2,
  Volume2,
  Award,
  TrendingUp,
  MessageCircle,
  Calendar,
  Share2,
  LogOut,
  GraduationCap,
  Shield,
  Rocket,
  Heart,
  Brain,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { AssessmentSettings, AssessmentPassage } from '@/types/settings';

// Modular components
import { supabase } from '@/lib/supabase/client';
import {
  AssessmentHeader,
  TrustBadges,
  PassageCard,
  ProgressStepper,
  RecordingControls,
} from './_components';

// ==================== PROPS INTERFACE ====================
interface AssessmentPageClientProps {
  settings: Partial<AssessmentSettings>;
}

// ==================== ANALYTICS ====================
const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
    console.log(`📊 GA4: ${eventName}`, params);
  }
};

// ==================== DEFAULT CONFIGURATION ====================
// Fallbacks only used if site_settings fetch fails
const DEFAULT_COLORS = {
  pink: '#ff0099',
  blue: '#00abff',
  yellow: '#ffde00',
  purple: '#7b008b',
};

// Supabase client
// ==================== HELPER FUNCTIONS (use settings with fallbacks) ====================

// Cambridge English Level mapping (handles both numeric and string levels)
const CAMBRIDGE_LEVELS: Record<number | string, string> = {
  1: "Pre-A1 Starters",
  2: "A1 Movers",
  3: "A2 Flyers",
  4: "B1 Preliminary",
  5: "B2 First",
  "Pre-A1 Starters": "Pre-A1 Starters",
  "A1 Movers": "A1 Movers",
  "A2 Flyers": "A2 Flyers",
  "B1 Preliminary": "B1 Preliminary",
  "B2 First": "B2 First",
};

function getCambridgeLevel(level: number | string): string {
  return CAMBRIDGE_LEVELS[level] || String(level);
}

// Get age group key from age (matches database ageGroup values)
function getAgeGroupKey(age: number): string {
  if (age <= 5) return '4-5';
  if (age <= 7) return '6-7';
  if (age <= 9) return '8-9';
  return '10-12'; // Ages 10+ all use the same passage group
}

// Get passage for age from settings (with fallback)
function getPassageForAge(
  age: number,
  passages?: AssessmentPassage[]
): { text: string; level: string; readingTime: string } {
  const ageGroup = getAgeGroupKey(age);

  // Filter passages by age group
  const filteredPassages = passages?.filter(p => p.ageGroup === ageGroup) || [];

  if (filteredPassages.length > 0) {
    const selected = filteredPassages[Math.floor(Math.random() * filteredPassages.length)];
    return {
      text: selected.text,
      level: getCambridgeLevel(selected.level), // Normalize to Cambridge label
      readingTime: selected.readingTime,
    };
  }

  // Age-appropriate fallback passages if database unavailable
  const fallbacks: Record<string, { text: string; level: string; readingTime: string }> = {
    '4-5': {
      text: "I have a red ball. The ball is big and round. I kick the ball. It goes far away. I run fast to get it. My dog runs with me. We play all day. The sun is hot. I am very happy.",
      level: "Pre-A1 Starters",
      readingTime: "1-2 min"
    },
    '6-7': {
      text: "Tom has a little cat named Whiskers. Whiskers likes to play with a ball of yarn. Every morning, Tom gives Whiskers some milk. The cat drinks it quickly. Then they play together in the garden. Tom throws the ball and Whiskers runs after it. They are best friends.",
      level: "A1 Movers",
      readingTime: "2-3 min"
    },
    '8-9': {
      text: "Maya loved visiting the library every Saturday. The building was old with tall windows that let in golden sunlight. She would spend hours exploring the shelves, discovering new adventures between the pages. Her favourite spot was a cozy corner near the history section. The librarian, Mrs. Chen, always saved the newest books for Maya to see first.",
      level: "A2 Flyers",
      readingTime: "2-3 min"
    },
    '10-12': {
      text: "The ancient lighthouse had stood on the rocky cliff for over two hundred years, guiding ships safely through the treacherous waters below. Captain Roberts remembered his grandfather's stories about the keeper who lived there alone, maintaining the great lamp through fierce storms and foggy nights. Now, as his vessel approached the harbour, he understood why sailors called it the Guardian of the Coast.",
      level: "B1 Preliminary",
      readingTime: "3-4 min"
    },
  };

  return fallbacks[ageGroup] || fallbacks['4-5'];
}

// Get score-based CTA from settings (with fallback)
function getScoreBasedCTA(
  score: number,
  childName: string,
  ctaMessages?: AssessmentSettings['assessment_cta_messages']
) {
  // Determine which tier based on score
  let tier: 'low' | 'medium' | 'high' | 'excellent';
  if (score <= 4) tier = 'low';
  else if (score <= 6) tier = 'medium';
  else if (score <= 8) tier = 'high';
  else tier = 'excellent';

  // Try to get from settings
  const message = ctaMessages?.[tier];
  if (message) {
    return {
      headline: message.headline.replace('{childName}', childName),
      subtext: message.subtext,
      emoji: message.emoji,
      primaryCTA: message.primaryCTA.replace('{childName}', childName),
      secondaryCTA: message.secondaryCTA,
      prioritizeConsultation: message.prioritizeConsultation,
    };
  }

  // Fallback defaults
  const fallbacks = {
    low: {
      headline: `Great start, ${childName}! Let's build from here`,
      subtext: 'Our coaches specialize in building reading confidence from the ground up',
      emoji: '🌱',
      primaryCTA: `Start ${childName}'s Reading Journey`,
      secondaryCTA: 'Talk to a Coach First',
      prioritizeConsultation: true,
    },
    medium: {
      headline: `${childName} has a solid foundation!`,
      subtext: 'With guided practice, improvement comes quickly',
      emoji: '📈',
      primaryCTA: `Accelerate ${childName}'s Progress`,
      secondaryCTA: 'Talk to a Coach First',
      prioritizeConsultation: true,
    },
    high: {
      headline: `${childName} is doing wonderfully!`,
      subtext: 'Ready to reach the next level',
      emoji: '⭐',
      primaryCTA: `Unlock ${childName}'s Full Potential`,
      secondaryCTA: 'Talk to a Coach',
      prioritizeConsultation: false,
    },
    excellent: {
      headline: `${childName} is a reading star!`,
      subtext: 'Advanced coaching for gifted readers',
      emoji: '🏆',
      primaryCTA: `Challenge ${childName} Further`,
      secondaryCTA: 'Explore Advanced Options',
      prioritizeConsultation: false,
    },
  };

  return fallbacks[tier];
}

// Get score context from settings (with fallback)
function getScoreContext(
  score: number,
  age: number,
  scoreContext?: AssessmentSettings['assessment_score_context']
) {
  const ageGroup = age <= 7 ? 'ages 4-7' : age <= 10 ? 'ages 8-10' : 'ages 11+';

  // Determine tier
  let tier: 'low' | 'medium' | 'high' | 'excellent';
  if (score <= 4) tier = 'low';
  else if (score <= 6) tier = 'medium';
  else if (score <= 8) tier = 'high';
  else tier = 'excellent';

  // Try to get from settings
  const contextTemplate = scoreContext?.[tier];
  if (contextTemplate) {
    return contextTemplate
      .replace('{score}', score.toString())
      .replace('{ageGroup}', ageGroup);
  }

  // Fallback defaults
  if (score <= 4) {
    return `Many children at ${ageGroup} start here. With dedicated coaching sessions, most improve by 3-4 points.`;
  } else if (score <= 6) {
    return `This is a common starting point for ${ageGroup}. Most children improve by 2-3 points with focused coaching.`;
  } else if (score <= 8) {
    return `${score}/10 is above average for ${ageGroup}! Coaching can help reach excellence.`;
  } else {
    return `Outstanding! ${score}/10 puts your child in the top performers for ${ageGroup}.`;
  }
}

// ==================== MAIN COMPONENT ====================

function AssessmentPageContent({ settings }: { settings: Partial<AssessmentSettings> }) {
  // Extract settings with defaults
  const COLORS = DEFAULT_COLORS; // Colors remain as constants for now
  const whatsappNumber = settings.whatsapp_number?.replace('+', '') || '918976287997';
  const pageTitle = settings.assessment_page_title || 'FREE READING ASSESSMENT';
  const pageSubtitle = settings.assessment_page_subtitle || 'Get AI-powered insights in just 5 minutes';
  const heroBadge = settings.assessment_hero_badge || 'FREE READING ASSESSMENT';
  const socialProof = settings.assessment_social_proof || 'Join 100+ families already improving';
  const guaranteeText = settings.assessment_guarantee_text || '100% Refund Guarantee • Start within 3-5 days';
  const assessmentCTA = settings.assessment_cta || 'Reading Test - Free';
  const trustBadges = settings.assessment_trust_badges || [
    { icon: 'Clock', text: '5 Min Assessment' },
    { icon: 'Award', text: 'AI-Powered Analysis' },
    { icon: 'Mail', text: 'Instant Certificate' },
    { icon: 'MessageCircle', text: 'Expert Support' },
  ];

  // Referral tracking
  const searchParams = useSearchParams();
  const router = useRouter();
  const [referralData, setReferralData] = useState<{ code: string | null; coachId: string | null }>({ code: null, coachId: null });

  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Step management
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    parentName: '',
    parentEmail: '',
    countryCode: '+91',
    parentPhone: '',
    childName: '',
    childAge: '',
  });

  // Recording state
  const [passage, setPassage] = useState<{ text: string; level: string; readingTime: string } | null>(null);
  const [lockedPassage, setLockedPassage] = useState<{ text: string; level: string; readingTime: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [supportedMimeType, setSupportedMimeType] = useState<string | null>(null);
  const handleAudioReady = useCallback((mimeType: string) => setSupportedMimeType(mimeType), []);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Dynamic pricing from database (no hardcoded defaults)
  const [pricing, setPricing] = useState<{
    displayPrice: string;
    programPrice: number;
  } | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setFormData(prev => ({
            ...prev,
            parentName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
            parentEmail: session.user.email || '',
          }));
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setFormData(prev => ({
          ...prev,
          parentName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || prev.parentName,
          parentEmail: session.user.email || prev.parentEmail,
        }));
      } else {
        setUser(null);
      }
      setIsGoogleLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch pricing from database (pricing_plans table)
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const { data } = await supabase
          .from('pricing_plans')
          .select('discounted_price')
          .eq('slug', 'full') // Main program product
          .eq('is_active', true)
          .single();

        if (data?.discounted_price) {
          setPricing({
            displayPrice: '₹' + data.discounted_price.toLocaleString('en-IN'),
            programPrice: data.discounted_price
          });
        } else {
          console.warn('[Assessment] No pricing found in pricing_plans table');
        }
      } catch (error) {
        console.error('[Assessment] Failed to fetch pricing:', error);
      }
    };
    fetchPricing();
  }, []);

  // Track referral code from URL or cookie
  useEffect(() => {
    const trackReferral = async () => {
      const urlRef = searchParams.get('ref');

      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
      };
      const cookieRef = getCookie('yestoryd_ref');

      const refCode = urlRef || cookieRef;

      if (!refCode) return;

      try {
        const res = await fetch(`/api/referral/track?ref=${refCode}`);
        const data = await res.json();

        if (data.valid && data.coach_id) {
          setReferralData({ code: data.referral_code, coachId: data.coach_id });

          if (urlRef) {
            const expires = new Date();
            expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
            document.cookie = `yestoryd_ref=${data.referral_code};expires=${expires.toUTCString()};path=/`;

            fetch('/api/referral/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                referral_code: refCode,
                landing_page: window.location.pathname,
              }),
            }).catch(console.error);
          }

          console.log('? Referral tracked:', data.referral_code);
        }
      } catch (error) {
        console.error('Referral tracking error:', error);
      }
    };

    trackReferral();
  }, [searchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // ==================== HANDLERS ====================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    trackEvent('login_started', { method: 'google' });
    try {
      const currentUrl = window.location.href;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: currentUrl,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign-in error:', error);
      setIsGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFormData(prev => ({
      ...prev,
      parentName: '',
      parentEmail: '',
    }));
  };

  const handleStartAssessment = () => {
    if (!formData.parentName || !formData.parentEmail || !formData.childName || !formData.childAge) {
      alert('Please fill all required fields');
      return;
    }

    trackEvent('assessment_started', { child_age: formData.childAge });

    const age = parseInt(formData.childAge);
    const selectedPassage = getPassageForAge(age, settings.assessment_passages);
    setPassage(selectedPassage);
    setCurrentStep(2);
  };

  // Get a new random passage (for "Try different passage" button)
  const handleNewPassage = useCallback(() => {
    if (!formData.childAge) return;

    const age = parseInt(formData.childAge);
    const newPassage = getPassageForAge(age, settings.assessment_passages);
    setPassage(newPassage);
    trackEvent('passage_changed', { child_age: formData.childAge });
  }, [formData.childAge, settings.assessment_passages]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMimeType || 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setLockedPassage(passage); // Lock passage when recording starts to prevent mismatch

      trackEvent('recording_started');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Please allow microphone access to record your reading.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      trackEvent('recording_completed', { duration_seconds: recordingTime });
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setLockedPassage(null); // Allow passage changes again
  };

  const handleSubmitRecording = async () => {
    if (!audioBlob || !passage) return;

    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      const fullPhone = formData.parentPhone ? `${formData.countryCode}${formData.parentPhone}` : '';

      // Use lockedPassage (set when recording started) to ensure consistency
      const passageToAnalyze = lockedPassage || passage;

      const response = await fetch('/api/assessment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: audioBase64,
          passage: passageToAnalyze.text,
          childName: formData.childName,
          childAge: formData.childAge,
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: fullPhone,
          lead_source: referralData.coachId ? 'coach' : 'yestoryd',
          lead_source_coach_id: referralData.coachId,
          referral_code_used: referralData.code,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();

      // CASE 1: AI provider failed, assessment queued for retry
      if (data.pending === true) {
        trackEvent('assessment_pending', {
          child_name: formData.childName,
          child_age: formData.childAge,
          pending_assessment_id: data.pendingAssessmentId
        });

        // Show friendly "processing" message
        alert(
          `🎉 ${data.message || "We're analyzing your reading!"}\n\n` +
          `✉️ Results will be emailed to ${formData.parentEmail}\n` +
          `⏱️ Check your inbox (and spam folder) in 5-10 minutes.\n\n` +
          `📧 Confirmation sent to ${formData.parentEmail}`
        );

        // Reset to home or show a "check email" state
        setIsAnalyzing(false);
        return;
      }

      // CASE 2: Normal success - immediate results
      trackEvent('assessment_completed', {
        child_name: formData.childName,
        score: data.overall_score,
        child_age: formData.childAge
      });

      // NOTE: Certificate email is sent from /assessment/results/[id] page
      // which has childId for idempotency + full detailed report data

      // Redirect to full results page with detailed analysis, GoalsCapture, etc.
      if (data.childId) {
        router.push(`/assessment/results/${data.childId}`);
        return; // Exit early - redirect will handle the rest
      }

      // Fallback: show inline results if no childId (shouldn't happen)
      console.warn('No childId in response, falling back to inline results');
      setResults(data);
      setCurrentStep(3);

    } catch (error) {
      console.error('Analysis error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // WhatsApp share with FULL feedback
  const shareToWhatsApp = () => {
    if (!results) return;

    trackEvent('results_shared', { platform: 'whatsapp', child_name: formData.childName });

    const ctaInfo = getScoreBasedCTA(results.overall_score, formData.childName, settings.assessment_cta_messages);

    const text = `?? *Yestoryd Reading Report for ${formData.childName}*

${ctaInfo.emoji} *Overall Score: ${results.overall_score}/10*

?? *Detailed Scores:*
?? Clarity: ${results.clarity_score}/10
??? Fluency: ${results.fluency_score}/10
? Speed: ${results.speed_score}/10
?? WPM: ${results.wpm}

?? *rAI Analysis:*
${results.feedback}

? ${results.encouragement}

???????????????

?? *${ctaInfo.headline}*
${ctaInfo.subtext}

?? Book FREE Discovery Call:
https://yestoryd.com/lets-talk

?? Certificate sent to ${formData.parentEmail}

???????????????
?? Get FREE assessment at yestoryd.com`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Build lets-talk URL with params
  const getLetsTalkUrl = () => {
    const params = new URLSearchParams({
      childId: results?.childId || '',
      childName: formData.childName,
      childAge: formData.childAge,
      parentName: formData.parentName,
      parentEmail: formData.parentEmail,
      parentPhone: formData.countryCode + formData.parentPhone,
      source: 'assessment',
      assessmentScore: results?.overall_score?.toString() || '',
    });
    return `/lets-talk?${params.toString()}`;
  };

  // CRO FIX: Build enroll URL with params for high scorers
  const getEnrollUrl = () => {
    const params = new URLSearchParams({
      childId: results?.childId || '',
      childName: formData.childName,
      childAge: formData.childAge,
      parentName: formData.parentName,
      parentEmail: formData.parentEmail,
      parentPhone: formData.countryCode + formData.parentPhone,
      source: 'assessment',
      assessmentScore: results?.overall_score?.toString() || '',
    });
    return `/enroll?${params.toString()}`;
  };

  // ==================== RENDER ====================

  return (
    <div className={`min-h-screen bg-gradient-to-b from-surface-1 to-surface-0 relative ${currentStep === 2 ? '' : 'overflow-hidden'}`}>
      {/* Subtle Background Accents */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header - Dark theme */}
      <header className="bg-surface-1/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">Back</span>
            </Link>

            <Link href="/" className="absolute left-1/2 -translate-x-1/2">
              <Image
                src="/images/logo.png"
                alt="Yestoryd"
                width={140}
                height={45}
                className="h-9 w-auto"
              />
            </Link>

            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-full text-sm font-medium hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Help</span>
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-10 relative z-10">
        {/* Page Title */}
        <AssessmentHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          badge={heroBadge}
        />

        {/* Progress Stepper */}
        <div className="max-w-md mx-auto mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Details', icon: User },
              { num: 2, label: 'Record', icon: Mic },
              { num: 3, label: 'Results', icon: Award },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${currentStep >= step.num
                    ? 'text-white shadow-lg'
                    : 'bg-surface-3 text-text-tertiary'
                    }`}
                  style={currentStep >= step.num ? {
                    background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})`
                  } : {}}
                >
                  {currentStep > step.num ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <step.icon className="w-6 h-6" />
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${currentStep >= step.num ? 'text-white' : 'text-text-tertiary'
                  }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-surface-2 backdrop-blur-sm border border-border rounded-3xl p-6 md:p-8 shadow-xl">

            {/* STEP 1: DETAILS */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* rAI Introduction - Brain icon, ANALYST not coach */}
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00ABFF] to-[#0088cc] flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Brain className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">rAI</h3>
                    <p className="text-text-secondary text-sm">Yestoryd&apos;s AI Reading Analyst</p>
                  </div>
                </div>

                {/* Google Sign-In */}
                {authLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF0099]" />
                  </div>
                ) : user ? (
                  <div className="bg-surface-3 border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.user_metadata?.avatar_url && (
                          <Image
                            src={user.user_metadata.avatar_url}
                            alt={user.user_metadata?.full_name || 'User'}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        )}
                        <div>
                          <p className="text-white font-medium">{user.user_metadata?.full_name || user.email}</p>
                          <p className="text-text-secondary text-sm">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="text-text-tertiary hover:text-text-secondary p-2 rounded-lg hover:bg-surface-4 transition-colors"
                        title="Sign out"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-green-600 text-xs mt-3 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Signed in with Google - details auto-filled!
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                    className="w-full flex items-center justify-center gap-3 bg-surface-2 text-white font-semibold py-4 px-6 rounded-2xl hover:bg-surface-3 transition-all shadow-lg border border-border disabled:opacity-50"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </button>
                )}

                {/* Divider */}
                {!user && !authLoading && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-text-tertiary text-sm">or fill details</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      Parent Name *
                    </label>
                    <input
                      type="text"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleInputChange}
                      placeholder="Enter your name"
                      disabled={!!user}
                      className="w-full bg-surface-3 border border-border rounded-xl px-4 py-3 text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="parentEmail"
                      value={formData.parentEmail}
                      onChange={handleInputChange}
                      placeholder="you@email.com"
                      disabled={!!user}
                      className="w-full bg-surface-3 border border-border rounded-xl px-4 py-3 text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Phone with Country Code - FIXED OVERFLOW */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      <Phone className="w-4 h-4 inline mr-2" />
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="countryCode"
                        value={formData.countryCode}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith("+")) val = "+" + val.replace(/\D/g, "");
                          else val = "+" + val.slice(1).replace(/\D/g, "");
                          if (val.length <= 5) setFormData(prev => ({ ...prev, countryCode: val || "+" }));
                        }}
                        className="w-[70px] flex-shrink-0 bg-surface-3 border border-border rounded-xl px-2 py-3 text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="+91"
                      />
                      <input
                        type="tel"
                        name="parentPhone"
                        value={formData.parentPhone}
                        onChange={handleInputChange}
                        placeholder="98765 43210"
                        className="flex-1 min-w-0 bg-surface-3 border border-border rounded-xl px-4 py-3 text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        <Baby className="w-4 h-4 inline mr-2" />
                        Child Name *
                      </label>
                      <input
                        type="text"
                        name="childName"
                        value={formData.childName}
                        onChange={handleInputChange}
                        placeholder="Child's name"
                        className="w-full bg-surface-3 border border-border rounded-xl px-4 py-3 text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        <Star className="w-4 h-4 inline mr-2" />
                        Age *
                      </label>
                      <div className="relative">
                        <select
                          name="childAge"
                          value={formData.childAge}
                          onChange={handleInputChange}
                          className="w-full bg-surface-3 border border-border rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                        >
                          <option value="">Select</option>
                          {Array.from({ length: 9 }, (_, i) => i + 4).map(age => (
                            <option key={age} value={age}>{age} years</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleStartAssessment}
                  className="w-full font-bold py-4 px-8 rounded-full text-white transition-all duration-300 hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3 whitespace-nowrap"
                  style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
                >
                  <BookOpen className="w-5 h-5" />
                  {assessmentCTA}
                </button>

                <p className="text-center text-text-tertiary text-xs flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Your information is secure and will never be shared
                </p>
              </div>
            )}

            {/* STEP 2: RECORD - Content only (sticky bar rendered at root level) */}
            {currentStep === 2 && passage && (
              <div className="space-y-4 pb-56">
                {/* Browser Compatibility Check */}
                <AudioRecorderCheck onReady={handleAudioReady} />

                {/* Visual cue to scroll/record */}
                <div className="flex items-center justify-center gap-2 text-pink-600 text-sm font-medium animate-pulse">
                  <span>Tap the mic to start recording, then read aloud</span>
                  <ChevronDown className="w-4 h-4 animate-bounce" />
                </div>

                {/* PASSAGE CARD */}
                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-xl border-l-4 border-pink-500 relative overflow-hidden">
                  {/* Paper corner fold effect */}
                  <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-gray-100 to-transparent -mr-6 -mt-6 rotate-45"></div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-pink-100 p-1.5 rounded-lg">
                        <BookOpen className="w-4 h-4 text-pink-600" />
                      </div>
                      <span className="text-gray-600 text-xs font-bold uppercase tracking-wider">
                        Read Aloud
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Try different passage button */}
                      {!isRecording && !audioBlob && (
                        <button
                          onClick={handleNewPassage}
                          className="flex items-center gap-1 text-gray-400 hover:text-[#FF0099] transition-colors text-xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Different</span>
                        </button>
                      )}
                      <div className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">
                        {passage.level}
                      </div>
                    </div>
                  </div>

                  {/* The Text - Optimized for Reading */}
                  <p className="text-gray-900 text-lg md:text-xl leading-[1.9] font-medium antialiased" style={{ fontFamily: 'Georgia, serif' }}>
                    {passage.text}
                  </p>

                  {/* Expected time + tip */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-gray-400 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{passage.readingTime}</span>
                    </div>
                    <span>Accuracy &gt; Speed</span>
                  </div>
                </div>

                {/* Condensed Instructions */}
                <div className="bg-surface-3 rounded-xl px-4 py-3 border border-border">
                  <p className="text-text-secondary text-sm flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-pink-500 flex-shrink-0" />
                    <span>Let {formData.childName} read clearly. Tap <strong className="text-white">stop</strong> when done.</span>
                  </p>
                </div>

                {/* Back button - in scrollable area */}
                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full py-2 text-text-tertiary hover:text-text-secondary transition-colors text-sm"
                >
                  ← Edit details
                </button>
              </div>
            )}

            {/* STEP 3: RESULTS - CRO OPTIMIZED WITH SCORE-BASED ROUTING */}
            {currentStep === 3 && results && (
              <div className="space-y-6 text-center">
                {(() => {
                  const ctaInfo = getScoreBasedCTA(results.overall_score, formData.childName, settings.assessment_cta_messages);
                  const scoreContext = getScoreContext(results.overall_score, parseInt(formData.childAge), settings.assessment_score_context);

                  return (
                    <>
                      {/* Encouraging Header - First thing they see */}
                      <div>
                        <div className="text-5xl mb-3">{ctaInfo.emoji}</div>
                        <h2 className="text-2xl font-bold text-white mb-1">
                          {ctaInfo.headline}
                        </h2>
                        <p className="text-text-tertiary text-sm">{ctaInfo.subtext}</p>
                      </div>

                      {/* Score with Context (reduces anxiety) */}
                      <div className="bg-surface-2 rounded-2xl p-5 border border-border">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                              <span className="text-2xl font-bold text-white">{results.overall_score}</span>
                            </div>
                            <div className="text-left">
                              <p className="text-text-tertiary text-xs uppercase font-bold tracking-wider">Overall Score</p>
                              <p className="text-white text-lg font-semibold">out of 10</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-text-tertiary text-xs uppercase font-bold tracking-wider">Speed</p>
                            <p className="text-blue-500 text-xl font-bold">{results.wpm} <span className="text-sm text-text-tertiary">WPM</span></p>
                          </div>
                        </div>

                        {/* Context message - reduces anxiety */}
                        <p className="text-text-secondary text-sm bg-surface-1 rounded-lg p-3 border border-border">
                          💡 {scoreContext}
                        </p>
                      </div>

                      {/* Secondary Metrics - Smaller */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-2 rounded-xl p-3 text-center border border-border">
                          <p className="text-text-tertiary text-[10px] uppercase tracking-wider">Clarity</p>
                          <p className="text-white font-bold text-lg">{results.clarity_score}</p>
                        </div>
                        <div className="bg-surface-2 rounded-xl p-3 text-center border border-border">
                          <p className="text-text-tertiary text-[10px] uppercase tracking-wider">Fluency</p>
                          <p className="text-white font-bold text-lg">{results.fluency_score}</p>
                        </div>
                        <div className="bg-surface-2 rounded-xl p-3 text-center border border-border">
                          <p className="text-text-tertiary text-[10px] uppercase tracking-wider">Speed</p>
                          <p className="text-white font-bold text-lg">{results.speed_score}</p>
                        </div>
                      </div>

                      {/* Feedback */}
                      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-xl p-4 text-left">
                        <h4 className="text-pink-600 font-semibold mb-2 flex items-center gap-2">
                          <Brain className="w-4 h-4" />
                          rAI Analysis
                        </h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {results.feedback}
                        </p>
                      </div>

                      {/* Encouragement */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-yellow-700 font-medium">
                          ? {results.encouragement}
                        </p>
                      </div>

                      {/* CTA SECTION - CRO FIX: Score-based routing */}
                      <div className="space-y-3 pt-2">
                        {/* Real social proof */}
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                          <Heart className="w-4 h-4 text-pink-500" />
                          <span>{socialProof}</span>
                        </div>

                        {ctaInfo.prioritizeConsultation ? (
                          // LOW/MID SCORE (=6): Consultation first (reassurance needed)
                          <>
                            <Link
                              href={getLetsTalkUrl()}
                              onClick={() => trackEvent('cta_clicked', { cta: 'primary_consultation', score: results.overall_score })}
                              className="w-full font-bold py-4 px-6 rounded-2xl text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg"
                              style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
                            >
                              <Calendar className="w-5 h-5" />
                              {ctaInfo.secondaryCTA}
                            </Link>
                            <p className="text-gray-400 text-xs">Free 15-min call • No obligation • Get personalized advice</p>

                            <Link
                              href={getEnrollUrl()}
                              onClick={() => trackEvent('cta_clicked', { cta: 'secondary_enroll', score: results.overall_score })}
                              className="w-full bg-transparent border border-gray-300 hover:border-gray-400 font-semibold py-3 px-6 rounded-2xl text-gray-600 flex items-center justify-center gap-3 transition-all"
                            >
                              <Rocket className="w-5 h-5" />
                              Ready to Enroll? Skip the Call ?
                            </Link>
                          </>
                        ) : (
                          // HIGH SCORE (=7): Enroll first (confident parents)
                          <>
                            <Link
                              href={getEnrollUrl()}
                              onClick={() => trackEvent('cta_clicked', { cta: 'primary_enroll', score: results.overall_score })}
                              className="w-full font-bold py-4 px-6 rounded-2xl text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg"
                              style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
                            >
                              <Rocket className="w-5 h-5" />
                              {ctaInfo.primaryCTA}{pricing ? ` — ${pricing.displayPrice}` : ''}
                            </Link>
                            <p className="text-gray-400 text-xs">{guaranteeText}</p>

                            <Link
                              href={getLetsTalkUrl()}
                              onClick={() => trackEvent('cta_clicked', { cta: 'secondary_consultation', score: results.overall_score })}
                              className="w-full bg-transparent border border-gray-300 hover:border-gray-400 font-medium py-3 px-6 rounded-2xl text-gray-500 flex items-center justify-center gap-3 transition-all"
                            >
                              <Calendar className="w-5 h-5" />
                              {settings.consultation_cta_button || 'Have Questions? Talk to Coach First'}
                            </Link>
                          </>
                        )}

                        {/* Trust badges */}
                        <div className="flex items-center justify-center gap-4 text-xs text-gray-400 pt-2">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {guaranteeText.split('•')[0]?.trim() || '100% Refund Guarantee'}
                          </span>
                          <span>•</span>
                          <span>Certified Coaches</span>
                        </div>
                      </div>

                      {/* WhatsApp Share */}
                      <button
                        onClick={() => {
                          trackEvent('cta_clicked', { cta: 'whatsapp_share', score: results.overall_score });
                          shareToWhatsApp();
                        }}
                        className="w-full bg-green-500 hover:bg-green-600 font-bold py-4 px-6 rounded-2xl text-white flex items-center justify-center gap-3 transition-all shadow-lg"
                      >
                        <Share2 className="w-5 h-5" />
                        Share {formData.childName}&apos;s Results
                      </button>

                      {/* Take Another */}
                      <button
                        onClick={() => {
                          setCurrentStep(1);
                          setFormData(prev => ({
                            parentName: user?.user_metadata?.full_name || '',
                            parentEmail: user?.email || '',
                            countryCode: '+91',
                            parentPhone: '',
                            childName: '',
                            childAge: '',
                          }));
                          setResults(null);
                          setAudioBlob(null);
                          setAudioUrl(null);
                          setPassage(null);
                        }}
                        className="w-full py-3 text-text-tertiary hover:text-white transition-colors text-sm"
                      >
                        🔄 Assess Another Child
                      </button>

                      <p className="text-text-tertiary text-xs">
                        ?? Certificate sent to {formData.parentEmail}
                        <br />
                        <span className="text-yellow-600">Check spam folder if not in inbox</span>
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Powered by rAI */}
          <div className="text-center mt-6">
            <p className="text-text-tertiary text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap">
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00abff] flex-shrink-0" />
              <span>Powered by</span>
              <span className="text-white font-medium">rAI</span>
              <span className="hidden sm:inline">- Yestoryd&apos;s Reading Intelligence</span>
            </p>
          </div>
        </div>

        {/* Trust Indicators */}
        <TrustBadges badges={trustBadges} className="mt-8" />
      </main>

      {/* STICKY BOTTOM BAR - Recording Controls (rendered at ROOT level for proper fixed positioning) */}
      {currentStep === 2 && passage && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-50"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          <div className="max-w-lg mx-auto px-4 pt-4">
            {/* Hidden audio element */}
            {audioUrl && (
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
              />
            )}

            {/* Main controls row */}
            <div className="flex items-center justify-between gap-4">
              {/* Timer */}
              <div className={`font-mono text-2xl font-bold tracking-wider transition-all duration-300 min-w-[70px] ${
                isRecording
                  ? 'text-red-500 drop-shadow-[0_0_10px_rgba(255,0,0,0.3)]'
                  : audioBlob ? 'text-green-600' : 'text-gray-400'
              }`}>
                {formatTime(recordingTime)}
              </div>

              {/* Record/Playback Button */}
              {!audioBlob ? (
                <div className="relative">
                  {/* Pulse rings when recording */}
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40"></div>
                      <div className="absolute inset-[-8px] rounded-full border-2 border-red-500/30 animate-pulse"></div>
                    </>
                  )}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative w-16 h-16 min-w-[64px] min-h-[64px] rounded-full flex items-center justify-center transition-all duration-200 shadow-xl z-10 border-4 ${
                      isRecording
                        ? 'bg-red-600 border-red-400 scale-95'
                        : 'border-white hover:scale-105 active:scale-95'
                    }`}
                    style={!isRecording ? { background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` } : {}}
                  >
                    {isRecording ? (
                      <Square className="w-7 h-7 text-white fill-white" />
                    ) : (
                      <Mic className="w-7 h-7 text-white" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlayback}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all shadow-lg"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={resetRecording}
                    className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-surface-3 flex items-center justify-center hover:bg-surface-4 active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-5 h-5 text-text-secondary" />
                  </button>
                </div>
              )}

              {/* Status text */}
              <div className={`text-sm font-medium text-right min-w-[90px] ${
                isRecording ? 'text-red-500' : audioBlob ? 'text-green-400' : 'text-text-tertiary'
              }`}>
                {isRecording ? (
                  <span className="flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    Recording...
                  </span>
                ) : audioBlob ? (
                  <span>Done! ✓</span>
                ) : (
                  <span>Tap to start</span>
                )}
              </div>
            </div>

            {/* Submit button - appears after recording */}
            {audioBlob && (
              <button
                onClick={handleSubmitRecording}
                disabled={isAnalyzing}
                className="w-full mt-4 font-bold py-4 px-6 rounded-2xl text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: `linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple})` }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    rAI is analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Get Results
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function AssessmentPageClient({ settings }: AssessmentPageClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF0099]"></div>
      </div>
    }>
      <AssessmentPageContent settings={settings} />
    </Suspense>
  );
}

