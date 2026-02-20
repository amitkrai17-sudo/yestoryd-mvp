'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Loader2, MessageCircle, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Target, Volume2, Lightbulb,
  BookOpenCheck, Sparkles, BookOpen, Zap, MessageSquare,
  TrendingUp, Download, Share2, AlertTriangle, Calendar, FileText,
  Play, Check,
} from 'lucide-react';
import Confetti from '@/components/Confetti';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';
import { getAgeBandFromAge } from '@/components/AgeBandBadge';

// Types
interface SkillScore { score: number; notes: string; }
interface AssessmentData {
  childId: string; childName: string; childAge: string;
  parentName: string; parentEmail: string; parentPhone: string;
  overall_score: number; clarity_score: number; fluency_score: number; speed_score: number;
  wpm: number; completeness: number; feedback: string;
  errors: string[]; strengths: string[]; areas_to_improve: string[];
  error_classification?: any; phonics_analysis?: any;
  skill_breakdown?: any; practice_recommendations?: any;
  parent_goals?: string[];
  mini_challenge_completed?: boolean;
  mini_challenge_data?: {
    quiz_score: number;
    quiz_total: number;
    xp_earned: number;
    goal: string;
  };
}

// Score-based messaging (matching email)
function getScoreMessage(score: number, childName: string, age: string) {
  // Use first name only for shorter CTA text
  const firstName = childName.split(' ')[0];

  if (score >= 8) return {
    headline: `${childName} Is Doing Amazingly!`,
    subheadline: 'A true reading champion',
    encouragement: `${score}/10 is excellent for age ${age}! Advanced coaching can take skills even higher.`,
    dailyTip: `Keep reading daily, ${childName.toLowerCase()}! Every page makes you stronger.`,
    ctaText: `Boost ${firstName}'s Reading`,
  };
  if (score >= 6) return {
    headline: `${childName} Shows Great Potential!`,
    subheadline: 'A rising reading star',
    encouragement: `${score}/10 shows promise for age ${age}! A few sessions can unlock their full ability.`,
    dailyTip: `Practice makes perfect, ${childName.toLowerCase()}! You're getting better every day.`,
    ctaText: `Boost ${firstName}'s Reading`,
  };
  if (score >= 4) return {
    headline: `${childName} Is On The Right Track!`,
    subheadline: 'Building reading confidence',
    encouragement: `${score}/10 is a great start for age ${age}! Targeted coaching will accelerate progress.`,
    dailyTip: `Every small step counts, ${childName.toLowerCase()}! Keep going!`,
    ctaText: `Boost ${firstName}'s Reading`,
  };
  return {
    headline: `${childName} Has Taken The First Step!`,
    subheadline: 'Every reader starts somewhere',
    encouragement: `Our coaches specialize in building strong foundations for age ${age}. Let's begin!`,
    dailyTip: `The journey of a thousand books begins with one page, ${childName.toLowerCase()}!`,
    ctaText: `Start ${firstName}'s Journey`,
  };
}

// Mini Challenge CTA Component
function MiniChallengeCTA({ childId, goalArea }: { childId: string; goalArea?: string }) {
  const goalParam = goalArea ? `?goal=${goalArea}` : '';

  return (
    <div className="mt-4 bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-[#FF0099]/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-[#FF0099]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            Ready for a Quick Challenge?
          </h3>
          <p className="text-gray-400 mt-1 text-sm">
            Try a fun mini challenge based on your reading goals!
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link
          href={`/mini-challenge/${childId}${goalParam}`}
          className="flex-1 h-12 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Play className="w-5 h-5" />
          Start Challenge
        </Link>
        <Link
          href={`/enroll?childId=${childId}&source=assessment`}
          className="h-12 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center transition-colors"
        >
          Skip
        </Link>
      </div>
    </div>
  );
}

// Mini Challenge Completed Badge
function MiniChallengeCompletedBadge({ data }: { data: AssessmentData['mini_challenge_data'] }) {
  if (!data) return null;

  return (
    <div className="mt-4 bg-green-900/20 border border-green-700 rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
          <Check className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p className="text-white font-medium">Mini Challenge Completed!</p>
          <p className="text-gray-400 text-sm">
            Score: {data.quiz_score}/{data.quiz_total} • XP: {data.xp_earned}
          </p>
        </div>
      </div>
    </div>
  );
}

const SKILL_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  decoding: { icon: <BookOpen className="w-4 h-4" />, label: 'Decoding' },
  sight_words: { icon: <Zap className="w-4 h-4" />, label: 'Sight Words' },
  blending: { icon: <TrendingUp className="w-4 h-4" />, label: 'Blending' },
  expression: { icon: <MessageSquare className="w-4 h-4" />, label: 'Expression' },
};

function SkillBar({ skill, data }: { skill: string; data: SkillScore }) {
  const config = SKILL_CONFIG[skill];
  if (!config || !data) return null;
  const pct = (data.score / 10) * 100;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#FF0099]">{config.icon}</span>
          <span className="text-text-secondary text-sm font-medium">{config.label}</span>
        </div>
        <span className="text-white font-bold text-sm">{data.score}/10</span>
      </div>
      <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FF0099] to-[#00ABFF] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {data.notes && <p className="text-text-tertiary text-xs mt-1.5 break-words">{data.notes}</p>}
    </div>
  );
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: string; }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface-1 rounded-2xl border border-border shadow-md shadow-black/20 overflow-hidden mb-3">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-surface-2 transition-colors min-h-[44px]">
        <div className="flex items-center gap-3">
          <span className="text-[#ff0099]">{icon}</span>
          <span className="text-white font-semibold">{title}</span>
          {badge && <span className="bg-[#ff0099]/20 text-[#ff0099] text-xs px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-text-tertiary" /> : <ChevronDown className="w-5 h-5 text-text-tertiary" />}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-border-subtle">{children}</div>}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const childId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssessmentData | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [ageBandConfig, setAgeBandConfig] = useState<{ label: string; total_sessions: number; sessions_per_week: number; session_duration_minutes: number; frequency_label: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!childId) { setError('No assessment ID'); setLoading(false); return; }
      try {
        const res = await fetch(`/api/assessment/results/${childId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        setData(await res.json());
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } catch { setError('Failed to load results'); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [childId]);

  const sendCertificateEmail = useCallback(async (goals?: string[]) => {
    if (!data?.parentEmail || emailSent || sendingEmail) return;
    setSendingEmail(true);
    try {
      const res = await fetch('/api/certificate/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.parentEmail, childName: data.childName, childId, childAge: data.childAge,
          score: data.overall_score, wpm: data.wpm,
          clarityScore: data.clarity_score, fluencyScore: data.fluency_score, speedScore: data.speed_score,
          feedback: data.feedback, strengths: data.strengths, areasToImprove: data.areas_to_improve,
          phonicsAnalysis: data.phonics_analysis, skillBreakdown: data.skill_breakdown,
          errorClassification: data.error_classification, practiceRecommendations: data.practice_recommendations,
          goals: goals || [],
        }),
      });
      if (res.ok) setEmailSent(true);
    } catch {} finally { setSendingEmail(false); }
  }, [data, childId, emailSent, sendingEmail]);

  useEffect(() => { if (data) sendCertificateEmail(); }, [data, sendCertificateEmail]);

  // Fetch age band config when data loads
  useEffect(() => {
    if (!data?.childAge) return;
    const age = parseInt(data.childAge);
    if (isNaN(age) || age < 4 || age > 12) return;
    fetch(`/api/age-band-config?age=${age}`)
      .then(res => res.json())
      .then(d => { if (d.success && d.config) setAgeBandConfig(d.config); })
      .catch(() => {});
  }, [data?.childAge]);

  const getWhatsAppMessage = useCallback(() => {
    if (!data) return '';

    // Extract top 3 errors (if available)
    const topErrors = data.errors?.slice(0, 3) || [];
    const errorsText = topErrors.length > 0
      ? `\n*Words to practice:* ${topErrors.join(', ')}`
      : '';

    // Extract key strength (if available)
    const strength = data.strengths?.[0] || '';
    const strengthText = strength
      ? `\n*Strength:* ${strength}`
      : '';

    // Build the share message with link to results page
    const reportLink = `https://yestoryd.com/assessment/results/${childId}`;

    return encodeURIComponent(`📊 *${data.childName}'s Reading Assessment Results*

*Scores:*
Overall: ${data.overall_score}/10 | Clarity: ${data.clarity_score}/10
Fluency: ${data.fluency_score}/10 | Speed: ${data.speed_score}/10

*Key Observations:*${errorsText}${strengthText}

*What's Next?*
View the full report and book a FREE 15-min call with our reading coach.

👉 ${reportLink}

_Assessed by rAI | yestoryd.com_`);
  }, [data, childId]);

  const shareOnWhatsApp = () => window.open(`https://wa.me/?text=${getWhatsAppMessage()}`, '_blank');

  const nativeShare = async () => {
    if (!data) return;
    const reportLink = `https://yestoryd.com/assessment/results/${childId}`;
    const text = `${data.childName}'s Reading Assessment: ${data.overall_score}/10. Check out the full report!`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${data.childName}'s Reading Report`, text, url: reportLink });
      } catch {
        // User cancelled or share failed — fall back to WhatsApp
        shareOnWhatsApp();
      }
    } else {
      shareOnWhatsApp();
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff0099] mx-auto mb-4" />
        <p className="text-text-tertiary">Loading results...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-white text-lg mb-2">Something went wrong</p>
        <p className="text-text-tertiary mb-4">{error}</p>
        <Link href="/assessment"><button className="px-6 py-3 bg-[#ff0099] text-white rounded-full font-semibold min-h-[44px]">Reading Test - Free</button></Link>
      </div>
    </div>
  );

  const msg = getScoreMessage(data.overall_score, data.childName, data.childAge);
  const goalsParam = selectedGoals.length > 0 ? `&goals=${encodeURIComponent(selectedGoals.join(','))}` : '';
  const baseParams = `childId=${childId}&childName=${encodeURIComponent(data.childName)}&childAge=${encodeURIComponent(data.childAge)}&parentName=${encodeURIComponent(data.parentName || '')}&parentEmail=${encodeURIComponent(data.parentEmail)}&parentPhone=${encodeURIComponent(data.parentPhone || '')}&assessmentScore=${data.overall_score}`;
  const checkoutUrl = `/checkout?${baseParams}&source=assessment${goalsParam}`;
  const enrollUrl = `/enroll?${baseParams}&source=results${goalsParam}`;
  const bookCallUrl = `/lets-talk?${baseParams}&source=results${goalsParam}`;

  const totalErrors = data.error_classification ?
    (data.error_classification.substitutions?.length || 0) + (data.error_classification.omissions?.length || 0) +
    (data.error_classification.mispronunciations?.length || 0) : 0;

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Confetti */}
      {showConfetti && <Confetti duration={4000} />}

      {/* Header */}
      <header className="bg-surface-1 border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={40}
              className="h-9 w-auto"
            />
          </Link>
          <button onClick={shareOnWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold hover:bg-green-600 min-h-[44px]">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Certificate Card - MATCHING EMAIL */}
        <div className="bg-surface-1 rounded-3xl shadow-xl shadow-black/30 overflow-hidden border border-border">

          {/* Purple Header with rAI Logo */}
          <div className="bg-gradient-to-br from-[#c847f4] to-[#7b008b] p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
              <Image
                src="/images/rai-mascot.png"
                alt="rAI"
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white">Yestoryd</h1>
            <p className="text-white/80 text-xs uppercase tracking-widest mt-1">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-6 text-center">
            <div className="flex justify-center mb-3">
              <Sparkles className="w-12 h-12 text-[#ff0099]" />
            </div>
            <h2 className="text-2xl font-bold text-white break-words">{msg.headline}</h2>
            <p className="text-text-tertiary mt-1">{msg.subheadline}</p>

            {/* Score Row */}
            <div className="flex items-center justify-between mt-6 mb-4 px-2">
              <div className="flex items-center gap-3">
                {/* Gradient border score circle */}
                <div className="p-[3px] rounded-full bg-gradient-to-br from-[#FF0099] to-[#00ABFF]">
                  <div className="w-14 h-14 rounded-full bg-surface-1 flex items-center justify-center">
                    <span className="text-2xl font-black text-white">{data.overall_score}</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-text-tertiary text-xs uppercase tracking-wide">Overall Score</p>
                  <p className="text-text-secondary font-medium">out of 10</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-text-tertiary text-xs uppercase tracking-wide">Speed</p>
                <p className="text-[#00ABFF] text-xl font-bold">{data.wpm} <span className="text-sm">WPM</span></p>
              </div>
            </div>

            {/* Yellow Encouragement */}
            <div className="bg-[#ffde00]/10 border border-[#ffde00]/30 rounded-xl px-4 py-3 mb-5">
              <p className="text-[#ffde00] text-sm flex items-start gap-2">
                <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="break-words">{msg.encouragement}</span>
              </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-5 border-t border-b border-border-subtle py-4">
              <div className="text-center">
                <p className="text-text-tertiary text-xs uppercase">Clarity</p>
                <p className="text-[#7b008b] text-2xl font-bold">{data.clarity_score}</p>
              </div>
              <div className="text-center border-l border-r border-border-subtle">
                <p className="text-text-tertiary text-xs uppercase">Fluency</p>
                <p className="text-[#7b008b] text-2xl font-bold">{data.fluency_score}</p>
              </div>
              <div className="text-center">
                <p className="text-text-tertiary text-xs uppercase">Speed</p>
                <p className="text-[#7b008b] text-2xl font-bold">{data.speed_score}</p>
              </div>
            </div>

            {/* rAI Analysis */}
            {data.feedback && (
              <div className="bg-surface-2 rounded-xl p-4 mb-4 text-left border-l-4 border-[#ff0099]">
                <div className="flex items-center gap-2 mb-2">
                  <Image
                    src="/images/rai-mascot.png"
                    alt="rAI"
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                  <span className="font-bold text-[#ff0099]">rAI Analysis</span>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed break-words">{data.feedback}</p>
              </div>
            )}

            {/* Goals Capture - Optional */}
            <GoalsCapture
              childId={childId}
              childName={data.childName}
              childAge={parseInt(data.childAge) || 8}
              className="mb-4"
              onGoalsSaved={(goals) => setSelectedGoals(goals)}
            />

            {/* Mini Challenge CTA - Show if goals selected and not completed */}
            {selectedGoals.length > 0 && !data.mini_challenge_completed && (
              <MiniChallengeCTA
                childId={childId}
                goalArea={selectedGoals[0]}
              />
            )}

            {/* Mini Challenge Completed Badge */}
            {data.mini_challenge_completed && data.mini_challenge_data && (
              <MiniChallengeCompletedBadge data={data.mini_challenge_data} />
            )}

            {/* Yellow Daily Tip */}
            <div className="bg-[#ffde00] rounded-xl px-4 py-3 mb-4">
              <p className="text-[#7b008b] text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span className="break-words">{msg.dailyTip}</span>
              </p>
            </div>

            <p className="text-text-tertiary text-sm mb-4">Join 100+ families already improving</p>

            {/* CTA Button */}
            <Link href={enrollUrl}>
              <button className="w-full py-4 bg-gradient-to-r from-[#ff0099] to-[#ff6b6b] text-white font-bold rounded-full text-base hover:opacity-90 shadow-lg mb-3 whitespace-nowrap min-h-[44px]">
                {msg.ctaText}
              </button>
            </Link>

            {ageBandConfig && (
              <p className="text-[#00ABFF] text-xs font-medium">
                {ageBandConfig.label} Program · {ageBandConfig.total_sessions} sessions · {ageBandConfig.frequency_label}/week · {ageBandConfig.session_duration_minutes} min
              </p>
            )}
            <p className="text-text-tertiary text-xs mt-1">100% Refund Guarantee · Start within 3-5 days</p>

            <Link href={bookCallUrl}>
              <button className="w-full mt-4 py-3 bg-surface-2 text-text-secondary font-semibold rounded-full border border-border hover:bg-surface-1 whitespace-nowrap text-sm flex items-center justify-center gap-2 min-h-[44px]">
                <Calendar className="w-4 h-4" />
                Questions? Talk to Coach
              </button>
            </Link>

            {/* Email Status */}
            <div className="mt-6 print:hidden">
              {data.parentEmail && (
                <div>
                  <div className={`flex items-center justify-center gap-2 text-sm ${emailSent ? 'text-green-500' : 'text-text-tertiary'}`}>
                    {sendingEmail ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> :
                     emailSent ? <><CheckCircle className="w-4 h-4" /> Sent to {data.parentEmail}</> :
                     <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>}
                  </div>
                  {emailSent && <p className="text-amber-500 text-xs mt-1"><AlertTriangle className="w-3 h-3 inline" /> Check spam folder</p>}
                </div>
              )}
            </div>

            <p className="text-text-tertiary text-xs mt-4">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* Detailed Analysis */}
        {(data.skill_breakdown || data.phonics_analysis || data.error_classification) && (
          <div className="mt-6 space-y-3 print:hidden">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-[#ff0099]" /> Detailed Analysis
            </h3>

            {data.skill_breakdown && (
              <CollapsibleSection title="Reading Skills" icon={<Target className="w-5 h-5" />} defaultOpen={true}>
                <div className="pt-4">
                  {Object.entries(data.skill_breakdown).map(([skill, d]) => <SkillBar key={skill} skill={skill} data={d as SkillScore} />)}
                </div>
              </CollapsibleSection>
            )}

            {data.phonics_analysis && (
              <CollapsibleSection title="Phonics Analysis" icon={<Volume2 className="w-5 h-5" />} badge={data.phonics_analysis.struggling_phonemes?.length ? `${data.phonics_analysis.struggling_phonemes.length} to improve` : undefined} defaultOpen={true}>
                <div className="pt-4 space-y-4">
                  {data.phonics_analysis.recommended_focus && (
                    <div className="bg-[#ff0099]/10 border border-[#ff0099]/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-4 h-4 text-[#ff0099]" />
                        <span className="text-[#ff0099] font-semibold text-sm">Focus Area</span>
                      </div>
                      <p className="text-white text-sm break-words">{data.phonics_analysis.recommended_focus}</p>
                    </div>
                  )}
                  {data.phonics_analysis.struggling_phonemes?.length > 0 && (
                    <div>
                      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">Needs Practice</p>
                      <div className="flex flex-wrap gap-2">
                        {data.phonics_analysis.struggling_phonemes.map((p: string, i: number) => (
                          <span key={i} className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm border border-red-500/30">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.phonics_analysis.strong_phonemes?.length > 0 && (
                    <div>
                      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2 flex items-center gap-1">Strong <CheckCircle className="w-3 h-3 text-green-400" /></p>
                      <div className="flex flex-wrap gap-2">
                        {data.phonics_analysis.strong_phonemes.map((p: string, i: number) => (
                          <span key={i} className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm border border-green-500/30">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {data.error_classification && totalErrors > 0 && (
              <CollapsibleSection title="Reading Errors" icon={<AlertCircle className="w-5 h-5" />} badge={`${totalErrors} errors`}>
                <div className="pt-4 space-y-3">
                  {data.error_classification.substitutions?.length > 0 && (
                    <div>
                      <p className="text-text-tertiary text-xs uppercase mb-2">Substitutions</p>
                      {data.error_classification.substitutions.map((s: any, i: number) => (
                        <div key={i} className="bg-surface-2 rounded px-3 py-2 mb-1 text-sm border border-border">
                          <span className="text-red-400 line-through">{s.original}</span>
                          <span className="text-text-tertiary mx-2">→</span>
                          <span className="text-[#00abff]">{s.read_as}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.error_classification.omissions?.length > 0 && (
                    <div>
                      <p className="text-text-tertiary text-xs uppercase mb-2">Skipped</p>
                      <div className="flex flex-wrap gap-2">
                        {data.error_classification.omissions.map((w: string, i: number) => (
                          <span key={i} className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-sm">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.error_classification.mispronunciations?.length > 0 && (
                    <div>
                      <p className="text-text-tertiary text-xs uppercase mb-2">Mispronunciations</p>
                      {data.error_classification.mispronunciations.map((m: any, i: number) => (
                        <div key={i} className="bg-surface-2 rounded px-3 py-2 mb-1 text-sm border border-border">
                          <span className="text-[#7b008b] font-medium">{m.word}:</span> <span className="text-text-secondary">{m.issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {data.practice_recommendations && (
              <CollapsibleSection title="Practice at Home" icon={<Sparkles className="w-5 h-5" />} defaultOpen={true}>
                <div className="pt-4 space-y-4">
                  {data.practice_recommendations.daily_words?.length > 0 && (
                    <div>
                      <p className="text-text-tertiary text-xs uppercase mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Daily Words
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {data.practice_recommendations.daily_words.map((w: string, i: number) => (
                          <span key={i} className="bg-[#00abff]/20 text-[#00abff] px-3 py-2 rounded-lg text-sm font-medium border border-[#00abff]/30">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.practice_recommendations.phonics_focus && (
                    <div className="bg-[#7b008b]/20 border border-[#7b008b]/30 rounded-lg p-3">
                      <p className="text-[#c847f4] font-semibold text-sm mb-1 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> Phonics Focus
                      </p>
                      <p className="text-white text-sm break-words">{data.practice_recommendations.phonics_focus}</p>
                    </div>
                  )}
                  {data.practice_recommendations.suggested_activity && (
                    <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                      <p className="text-green-400 font-semibold text-sm mb-1 flex items-center gap-1.5">
                        <Target className="w-4 h-4" /> Activity
                      </p>
                      <p className="text-white text-sm break-words">{data.practice_recommendations.suggested_activity}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* What Happens Next — Bridging Score → Coaching */}
        <div className="mt-6 bg-surface-1 rounded-2xl border border-border overflow-hidden print:hidden">
          <div className="bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 p-5 border-b border-border">
            <h3 className="text-lg font-semibold text-white text-center">
              What Happens Next?
            </h3>
            <p className="text-text-secondary text-sm text-center mt-1">
              From assessment to confident reader in 90 days
            </p>
          </div>
          <div className="p-5 space-y-4">
            {[
              {
                step: '1',
                title: 'You just completed this',
                desc: `rAI identified ${data.areas_to_improve?.length || 'key'} areas where ${data.childName} can improve.`,
                color: '#FF0099',
                done: true,
              },
              {
                step: '2',
                title: 'Talk to a reading coach',
                desc: 'A 15-min FREE call to discuss results and create a personalized plan.',
                color: '#00ABFF',
                done: false,
              },
              {
                step: '3',
                title: `${data.childName} starts coaching`,
                desc: ageBandConfig
                  ? `${ageBandConfig.total_sessions} sessions, ${ageBandConfig.frequency_label}/week, ${ageBandConfig.session_duration_minutes} min each.`
                  : '1:1 sessions with an expert phonics coach, tailored to their exact gaps.',
                color: '#c847f4',
                done: false,
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    item.done
                      ? 'bg-green-500/20 text-green-400'
                      : 'border-2 text-white'
                  }`}
                  style={!item.done ? { borderColor: item.color, color: item.color } : undefined}
                >
                  {item.done ? <CheckCircle className="w-4 h-4" /> : item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{item.title}</p>
                  <p className="text-text-tertiary text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 flex flex-col gap-3">
            <Link
              href={bookCallUrl}
              className="w-full py-3 bg-[#ff0099] hover:bg-[#ff0099]/90 text-white font-semibold rounded-full flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              <Calendar className="w-5 h-5" />
              Book FREE Coach Call
            </Link>
            <Link
              href={enrollUrl}
              className="w-full py-3 bg-surface-2 text-text-secondary font-medium rounded-full flex items-center justify-center gap-2 border border-border hover:bg-surface-1 transition-colors min-h-[44px] text-sm"
            >
              Skip Call — Enroll Directly
            </Link>
          </div>
        </div>

        {/* WhatsApp Share */}
        <button onClick={shareOnWhatsApp} className="w-full mt-4 py-3 bg-green-500 text-white font-semibold rounded-full flex items-center justify-center gap-2 hover:bg-green-600 print:hidden min-h-[44px]">
          <MessageCircle className="w-5 h-5" /> Share Results on WhatsApp
        </button>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-3 gap-3 print:hidden">
          <button onClick={nativeShare} className="flex flex-col items-center gap-1.5 p-3 bg-surface-1 border border-border text-text-secondary rounded-2xl text-sm font-medium hover:bg-surface-2 min-h-[44px]">
            <Share2 className="w-5 h-5" /> Share
          </button>
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1.5 p-3 bg-surface-1 border border-border text-text-secondary rounded-2xl text-sm font-medium hover:bg-surface-2 min-h-[44px]">
            <Download className="w-5 h-5" /> Download
          </button>
          <Link href="/assessment" className="flex flex-col items-center gap-1.5 p-3 bg-surface-1 border border-border text-text-secondary rounded-2xl text-sm font-medium hover:bg-surface-2 min-h-[44px]">
            <BookOpen className="w-5 h-5" /> Retake
          </Link>
        </div>
      </main>
    </div>
  );
}
