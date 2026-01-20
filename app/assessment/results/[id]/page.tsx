'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Loader2, MessageCircle, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Target, Volume2, Lightbulb,
  BookOpenCheck, Sparkles, BookOpen, Zap, MessageSquare,
  TrendingUp, Download, Share2, AlertTriangle,
} from 'lucide-react';
import Confetti from '@/components/Confetti';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';

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
}

// Score-based messaging (matching email)
function getScoreMessage(score: number, childName: string, age: string) {
  // Use first name only for shorter CTA text
  const firstName = childName.split(' ')[0];

  if (score >= 8) return {
    headline: `${childName} Is Doing Amazingly!`,
    subheadline: 'A true reading champion',
    emoji: '⭐',
    encouragement: `${score}/10 is excellent for age ${age}! Advanced coaching can take skills even higher.`,
    dailyTip: `Keep reading daily, ${childName.toLowerCase()}! Every page makes you stronger.`,
    ctaText: `Boost ${firstName}'s Reading`,
  };
  if (score >= 6) return {
    headline: `${childName} Shows Great Potential!`,
    subheadline: 'A rising reading star',
    emoji: '🌟',
    encouragement: `${score}/10 shows promise for age ${age}! A few sessions can unlock their full ability.`,
    dailyTip: `Practice makes perfect, ${childName.toLowerCase()}! You're getting better every day.`,
    ctaText: `Boost ${firstName}'s Reading`,
  };
  if (score >= 4) return {
    headline: `${childName} Is On The Right Track!`,
    subheadline: 'Building reading confidence',
    emoji: '📖',
    encouragement: `${score}/10 is a great start for age ${age}! Targeted coaching will accelerate progress.`,
    dailyTip: `Every small step counts, ${childName.toLowerCase()}! Keep going!`,
    ctaText: `Boost ${firstName}'s Reading`,
  };
  return {
    headline: `${childName} Has Taken The First Step!`,
    subheadline: 'Every reader starts somewhere',
    emoji: '🚀',
    encouragement: `Our coaches specialize in building strong foundations for age ${age}. Let's begin!`,
    dailyTip: `The journey of a thousand books begins with one page, ${childName.toLowerCase()}!`,
    ctaText: `Start ${firstName}'s Journey`,
  };
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
  const color = data.score >= 7 ? 'bg-green-500' : data.score >= 5 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[#7b008b]">{config.icon}</span>
          <span className="text-gray-700 text-sm">{config.label}</span>
        </div>
        <span className="text-[#7b008b] font-bold text-sm">{data.score}/10</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {data.notes && <p className="text-gray-500 text-xs mt-1">{data.notes}</p>}
    </div>
  );
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: string; }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-[#ff0099]">{icon}</span>
          <span className="text-gray-800 font-semibold">{title}</span>
          {badge && <span className="bg-pink-100 text-[#ff0099] text-xs px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
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

  const getWhatsAppMessage = useCallback(() => {
    if (!data) return '';
    const msg = getScoreMessage(data.overall_score, data.childName, data.childAge);
    return encodeURIComponent(`🎉 *${data.childName}'s Reading Assessment*\n\n${msg.emoji} *${msg.headline}*\n${msg.subheadline}\n\n📊 Score: ${data.overall_score}/10\n⚡ Speed: ${data.wpm} WPM\n\n💡 ${msg.encouragement}\n\n🚀 Get FREE Assessment: https://yestoryd.com/assessment`);
  }, [data]);

  const shareOnWhatsApp = () => window.open(`https://wa.me/?text=${getWhatsAppMessage()}`, '_blank');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff0099] mx-auto mb-4" />
        <p className="text-gray-500">Loading results...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-800 text-lg mb-2">Something went wrong</p>
        <p className="text-gray-500 mb-4">{error}</p>
        <Link href="/assessment"><button className="px-6 py-3 bg-[#ff0099] text-white rounded-full font-semibold">Take New Assessment</button></Link>
      </div>
    </div>
  );

  const msg = getScoreMessage(data.overall_score, data.childName, data.childAge);
  const goalsParam = selectedGoals.length > 0 ? `&goals=${encodeURIComponent(selectedGoals.join(','))}` : '';
  const baseParams = `childId=${childId}&childName=${encodeURIComponent(data.childName)}&childAge=${encodeURIComponent(data.childAge)}&parentEmail=${encodeURIComponent(data.parentEmail)}&parentPhone=${encodeURIComponent(data.parentPhone || '')}`;
  const checkoutUrl = `/checkout?${baseParams}&source=assessment${goalsParam}`;
  const enrollUrl = `/enroll?${baseParams}&source=results${goalsParam}`;
  const bookCallUrl = `/lets-talk?${baseParams}&source=results${goalsParam}`;

  const totalErrors = data.error_classification ? 
    (data.error_classification.substitutions?.length || 0) + (data.error_classification.omissions?.length || 0) + 
    (data.error_classification.mispronunciations?.length || 0) : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Confetti */}
      {showConfetti && <Confetti duration={4000} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 print:hidden">
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
          <button onClick={shareOnWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold hover:bg-green-600">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Certificate Card - MATCHING EMAIL */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          
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
            <div className="text-5xl mb-3">{msg.emoji}</div>
            <h2 className="text-2xl font-bold text-gray-800">{msg.headline}</h2>
            <p className="text-gray-500 mt-1">{msg.subheadline}</p>

            {/* Score Row */}
            <div className="flex items-center justify-between mt-6 mb-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#7b008b] flex items-center justify-center">
                  <span className="text-2xl font-black text-white">{data.overall_score}</span>
                </div>
                <div className="text-left">
                  <p className="text-gray-400 text-xs uppercase">Overall Score</p>
                  <p className="text-gray-700 font-medium">out of 10</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs uppercase">Speed</p>
                <p className="text-[#00abff] text-xl font-bold">{data.wpm} <span className="text-sm">WPM</span></p>
              </div>
            </div>

            {/* Yellow Encouragement */}
            <div className="bg-[#fff9e6] border border-[#ffde00] rounded-xl px-4 py-3 mb-5">
              <p className="text-gray-700 text-sm">💡 {msg.encouragement}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-5 border-t border-b border-gray-100 py-4">
              <div className="text-center">
                <p className="text-gray-400 text-xs uppercase">Clarity</p>
                <p className="text-[#7b008b] text-2xl font-bold">{data.clarity_score}</p>
              </div>
              <div className="text-center border-l border-r border-gray-100">
                <p className="text-gray-400 text-xs uppercase">Fluency</p>
                <p className="text-[#7b008b] text-2xl font-bold">{data.fluency_score}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs uppercase">Speed</p>
                <p className="text-[#7b008b] text-2xl font-bold">{data.speed_score}</p>
              </div>
            </div>

            {/* rAI Analysis */}
            {data.feedback && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left border-l-4 border-[#ff0099]">
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
                <p className="text-gray-700 text-sm leading-relaxed">{data.feedback}</p>
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

            {/* Yellow Daily Tip */}
            <div className="bg-[#ffde00] rounded-xl px-4 py-3 mb-4">
              <p className="text-[#7b008b] text-sm font-semibold">✨ {msg.dailyTip}</p>
            </div>

            <p className="text-gray-500 text-sm mb-4">❤️ Join 100+ families already improving</p>

            {/* CTA Button */}
            <Link href={enrollUrl}>
              <button className="w-full py-4 bg-gradient-to-r from-[#ff0099] to-[#ff6b6b] text-white font-bold rounded-xl text-base hover:opacity-90 shadow-lg mb-3 whitespace-nowrap">
                🚀 {msg.ctaText}
              </button>
            </Link>

            <p className="text-gray-400 text-xs">100% Refund Guarantee • Start within 3-5 days</p>

            <Link href={bookCallUrl}>
              <button className="w-full mt-4 py-3 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:bg-gray-50 whitespace-nowrap text-sm">
                📅 Questions? Talk to Coach
              </button>
            </Link>

            {/* Email Status */}
            <div className="mt-6 print:hidden">
              {data.parentEmail && (
                <div>
                  <div className={`flex items-center justify-center gap-2 text-sm ${emailSent ? 'text-green-600' : 'text-gray-500'}`}>
                    {sendingEmail ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 
                     emailSent ? <><CheckCircle className="w-4 h-4" /> Sent to {data.parentEmail}</> : 
                     <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>}
                  </div>
                  {emailSent && <p className="text-amber-600 text-xs mt-1"><AlertTriangle className="w-3 h-3 inline" /> Check spam folder</p>}
                </div>
              )}
            </div>

            <p className="text-gray-400 text-xs mt-4">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* Detailed Analysis */}
        {(data.skill_breakdown || data.phonics_analysis || data.error_classification) && (
          <div className="mt-6 space-y-3 print:hidden">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
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
                    <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-4 h-4 text-[#ff0099]" />
                        <span className="text-[#ff0099] font-semibold text-sm">Focus Area</span>
                      </div>
                      <p className="text-gray-800 text-sm">{data.phonics_analysis.recommended_focus}</p>
                    </div>
                  )}
                  {data.phonics_analysis.struggling_phonemes?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Needs Practice</p>
                      <div className="flex flex-wrap gap-2">
                        {data.phonics_analysis.struggling_phonemes.map((p: string, i: number) => (
                          <span key={i} className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-sm border border-red-200">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.phonics_analysis.strong_phonemes?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Strong ✓</p>
                      <div className="flex flex-wrap gap-2">
                        {data.phonics_analysis.strong_phonemes.map((p: string, i: number) => (
                          <span key={i} className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm border border-green-200">{p}</span>
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
                      <p className="text-gray-500 text-xs uppercase mb-2">Substitutions</p>
                      {data.error_classification.substitutions.map((s: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded px-3 py-2 mb-1 text-sm border border-gray-200">
                          <span className="text-red-500 line-through">{s.original}</span>
                          <span className="text-gray-400 mx-2">→</span>
                          <span className="text-[#00abff]">{s.read_as}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.error_classification.omissions?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-2">Skipped</p>
                      <div className="flex flex-wrap gap-2">
                        {data.error_classification.omissions.map((w: string, i: number) => (
                          <span key={i} className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-sm">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.error_classification.mispronunciations?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-2">Mispronunciations</p>
                      {data.error_classification.mispronunciations.map((m: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded px-3 py-2 mb-1 text-sm border border-gray-200">
                          <span className="text-[#7b008b] font-medium">{m.word}:</span> <span className="text-gray-600">{m.issue}</span>
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
                      <p className="text-gray-500 text-xs uppercase mb-2">📝 Daily Words</p>
                      <div className="flex flex-wrap gap-2">
                        {data.practice_recommendations.daily_words.map((w: string, i: number) => (
                          <span key={i} className="bg-blue-100 text-[#00abff] px-3 py-2 rounded-lg text-sm font-medium border border-blue-200">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.practice_recommendations.phonics_focus && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="text-[#7b008b] font-semibold text-sm mb-1">🔤 Phonics Focus</p>
                      <p className="text-gray-800 text-sm">{data.practice_recommendations.phonics_focus}</p>
                    </div>
                  )}
                  {data.practice_recommendations.suggested_activity && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-green-700 font-semibold text-sm mb-1">🎯 Activity</p>
                      <p className="text-gray-800 text-sm">{data.practice_recommendations.suggested_activity}</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* WhatsApp Share */}
        <button onClick={shareOnWhatsApp} className="w-full mt-6 py-3 bg-green-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 print:hidden">
          <MessageCircle className="w-5 h-5" /> Share Results on WhatsApp
        </button>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3 print:hidden">
          <button onClick={() => window.print()} className="flex flex-col items-center gap-1.5 p-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Download className="w-5 h-5" /> Download
          </button>
          <Link href="/assessment" className="flex flex-col items-center gap-1.5 p-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Share2 className="w-5 h-5" /> Try Again
          </Link>
        </div>
      </main>
    </div>
  );
}
