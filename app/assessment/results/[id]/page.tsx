'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap, Volume2, MessageSquare, Calendar, BookOpen, Share2, Download, Mail,
  CheckCircle, Loader2, Sparkles, MessageCircle, Shield, Users, Star,
  ArrowRight, AlertTriangle, ChevronDown, ChevronUp, Target, AlertCircle,
  TrendingUp, Lightbulb, BookOpenCheck,
} from 'lucide-react';

// Brand Colors
const COLORS = {
  pink: '#ff0099',
  blue: '#00abff',
  yellow: '#ffde00',
  purple: '#7b008b',
};

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

function getScoreConfig(score: number, childName: string) {
  if (score >= 8) return { color: 'bg-green-500', text: 'text-green-600', ring: 'border-green-500', label: 'Excellent!', emoji: '🌟', headline: `${childName} is a reading star!`, subheadline: 'Take their skills to the advanced level', primaryCTA: `Take ${childName} to Advanced Level`, ctaStyle: 'from-green-500 to-emerald-600' };
  if (score >= 6) return { color: 'bg-yellow-500', text: 'text-yellow-600', ring: 'border-yellow-500', label: 'Good Progress!', emoji: '⭐', headline: `${childName} shows great potential!`, subheadline: 'Unlock their full reading abilities', primaryCTA: `Unlock ${childName}'s Full Potential`, ctaStyle: 'from-yellow-500 to-amber-600' };
  if (score >= 4) return { color: 'bg-orange-500', text: 'text-orange-600', ring: 'border-orange-500', label: 'Keep Practicing!', emoji: '💪', headline: `${childName} is ready to improve!`, subheadline: 'Accelerate their reading progress', primaryCTA: `Accelerate ${childName}'s Progress`, ctaStyle: 'from-orange-500 to-red-500' };
  return { color: 'bg-red-500', text: 'text-red-600', ring: 'border-red-500', label: 'Needs Support', emoji: '📚', headline: `${childName} needs expert guidance`, subheadline: 'Get personalized support from our coaches', primaryCTA: `Get ${childName} the Help They Need`, ctaStyle: 'from-red-500 to-pink-600' };
}

const TESTIMONIALS = [
  { text: "My daughter's score improved from 4 to 8 in just 6 weeks!", name: "Priya M.", child: "Mother of Ananya, Age 7" },
  { text: "The coaches understood exactly where my son was struggling.", name: "Rahul S.", child: "Father of Arjun, Age 9" },
  { text: "Best investment for our child's education.", name: "Meera K.", child: "Mother of Diya, Age 6" },
];

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

function getFluencyLabel(s: number) { return s >= 8 ? 'Smooth' : s >= 6 ? 'Good' : s >= 4 ? 'Choppy' : 'Developing'; }
function getClarityLabel(s: number) { return s >= 8 ? 'Clear' : s >= 6 ? 'Mostly Clear' : s >= 4 ? 'Inconsistent' : 'Unclear'; }

export default function ResultsPage() {
  const params = useParams();
  const childId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssessmentData | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    async function fetchData() {
      if (!childId) { setError('No assessment ID'); setLoading(false); return; }
      try {
        const res = await fetch(`/api/assessment/result/${childId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        setData(await res.json());
      } catch { setError('Failed to load results'); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [childId]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTestimonial(p => (p + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const sendCertificateEmail = useCallback(async () => {
    if (!data?.parentEmail || emailSent || sendingEmail) return;
    setSendingEmail(true);
    try {
      const res = await fetch('/api/certificate/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.parentEmail, childName: data.childName, childAge: data.childAge,
          score: data.overall_score, wpm: data.wpm,
          fluency: getFluencyLabel(data.fluency_score), pronunciation: getClarityLabel(data.clarity_score),
          clarityScore: data.clarity_score, fluencyScore: data.fluency_score, speedScore: data.speed_score,
          feedback: data.feedback, strengths: data.strengths, areasToImprove: data.areas_to_improve,
          phonicsAnalysis: data.phonics_analysis, skillBreakdown: data.skill_breakdown,
          errorClassification: data.error_classification, practiceRecommendations: data.practice_recommendations,
        }),
      });
      if (res.ok) setEmailSent(true);
    } catch {} finally { setSendingEmail(false); }
  }, [data, emailSent, sendingEmail]);

  useEffect(() => { if (data) sendCertificateEmail(); }, [data, sendCertificateEmail]);

  const getWhatsAppMessage = useCallback(() => {
    if (!data) return '';
    const config = getScoreConfig(data.overall_score, data.childName);
    return encodeURIComponent(`🎉 *${data.childName}'s Reading Assessment*\n\n${config.emoji} *Score: ${data.overall_score}/10* - ${config.label}\n⚡ Speed: ${data.wpm} WPM\n\n📝 ${data.feedback}\n\n🚀 Get FREE Assessment: https://yestoryd.com/assessment`);
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

  const config = getScoreConfig(data.overall_score, data.childName);
  const checkoutUrl = `/checkout?childId=${childId}&childName=${encodeURIComponent(data.childName)}&parentEmail=${encodeURIComponent(data.parentEmail)}&parentPhone=${encodeURIComponent(data.parentPhone || '')}&source=assessment`;

  const totalErrors = data.error_classification ? 
    (data.error_classification.substitutions?.length || 0) + (data.error_classification.omissions?.length || 0) + 
    (data.error_classification.mispronunciations?.length || 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              <span className="text-[#ff0099]">Yest</span>
              <span className="text-gray-800">or</span>
              <span className="text-[#ffde00]">yd</span>
            </span>
          </Link>
          <button onClick={shareOnWhatsApp} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        {/* Certificate Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#ff0099] to-[#7b008b] p-5 text-center">
            <div className="w-20 h-20 mx-auto mb-3 bg-white rounded-2xl flex items-center justify-center">
              <span className="text-4xl">📚</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Yestoryd</h1>
            <p className="text-white/80 text-sm uppercase tracking-widest mt-1">Reading Assessment Report</p>
          </div>

          {/* Body */}
          <div className="p-6 text-center">
            <p className="text-[#00abff] text-base font-semibold">Certificate of Achievement</p>
            <p className="text-gray-500 text-sm mt-1">Proudly presented to</p>
            <h2 className="text-3xl font-bold text-[#7b008b] mt-2">{data.childName}</h2>
            {data.childAge && <p className="text-gray-500 text-sm mt-1">Age {data.childAge}</p>}

            {/* Score Circle */}
            <div className="relative w-36 h-36 mx-auto my-6">
              <div className={`w-full h-full rounded-full border-8 ${config.ring} flex items-center justify-center bg-white shadow-lg`}>
                <span className={`text-5xl font-black ${config.text}`}>{data.overall_score}</span>
              </div>
            </div>

            <div className={`inline-flex items-center gap-2 ${config.color} text-white px-6 py-2 rounded-full text-base mb-5`}>
              <span className="text-xl">{config.emoji}</span>
              <span className="font-bold">{config.label}</span>
            </div>

            {/* Stats - INTEGER SCORES */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <Zap className="w-6 h-6 text-[#00abff] mx-auto mb-1" />
                <p className="text-xs text-gray-500">Speed</p>
                <p className="font-bold text-[#7b008b] text-lg">{data.wpm}</p>
                <p className="text-[10px] text-gray-400">WPM</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <Volume2 className="w-6 h-6 text-[#ff0099] mx-auto mb-1" />
                <p className="text-xs text-gray-500">Fluency</p>
                <p className="font-bold text-[#7b008b] text-lg">{data.fluency_score}/10</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <MessageSquare className="w-6 h-6 text-[#7b008b] mx-auto mb-1" />
                <p className="text-xs text-gray-500">Clarity</p>
                <p className="font-bold text-[#7b008b] text-lg">{data.clarity_score}/10</p>
              </div>
            </div>

            {/* Feedback */}
            {data.feedback && (
              <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left border-l-4 border-[#ff0099]">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-[#ffde00]" />
                  <span className="font-bold text-[#7b008b]">Coach Feedback</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{data.feedback}</p>
              </div>
            )}

            {/* Email Status */}
            <div className="print:hidden">
              {data.parentEmail && (
                <div className="mb-4">
                  <div className={`flex items-center justify-center gap-2 text-sm ${emailSent ? 'text-green-600' : 'text-gray-500'}`}>
                    {sendingEmail ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 
                     emailSent ? <><CheckCircle className="w-4 h-4" /> Sent to {data.parentEmail}</> : 
                     <><Mail className="w-4 h-4" /> Sending...</>}
                  </div>
                  {emailSent && (
                    <div className="flex items-center justify-center gap-1 mt-1 text-xs text-amber-600">
                      <AlertTriangle className="w-3 h-3" /><span>Check spam folder</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-gray-400 text-xs mt-3">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • yestoryd.com
            </p>
          </div>
        </div>

        {/* Enhanced Analysis */}
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

        {/* CTA Section */}
        <div className="mt-6 print:hidden">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">{config.headline}</h3>
            <p className="text-gray-500 text-sm mt-1">{config.subheadline}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-4">
            <Link href={checkoutUrl}>
              <button className={`w-full py-4 bg-gradient-to-r ${config.ctaStyle} text-white font-bold rounded-xl text-lg flex items-center justify-center gap-2 hover:opacity-90 shadow-lg`}>
                {config.primaryCTA} <ArrowRight className="w-5 h-5" />
              </button>
            </Link>

            <div className="mt-4 space-y-2">
              {['6 personalized sessions', 'Dedicated coach', 'FREE learning resources'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" /><span>{f}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-sm text-amber-600">
              <Users className="w-4 h-4" /><span>🔥 12 parents enrolled today</span>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield className="w-4 h-4 text-green-500" /><span>100% refund guarantee</span>
            </div>

            <div className="mt-3 text-center">
              <span className="text-2xl font-bold text-gray-800">₹5,999</span>
              <span className="text-gray-500 text-sm ml-2">one-time</span>
            </div>
          </div>

          <Link href={`/lets-talk?source=assessment&childName=${encodeURIComponent(data.childName)}&parentEmail=${encodeURIComponent(data.parentEmail)}`}>
            <button className="w-full py-3.5 bg-gray-100 text-gray-800 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 border border-gray-200 mb-4">
              <Calendar className="w-5 h-5" /> Talk to Coach First
            </button>
          </Link>

          <button onClick={shareOnWhatsApp} className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 mb-6">
            <MessageCircle className="w-5 h-5" /> Share Results
          </button>

          {/* Testimonial */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            <div className="flex gap-1 mb-2">{[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}</div>
            <p className="text-gray-700 text-sm italic mb-3">&ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#ff0099] rounded-full flex items-center justify-center text-white font-bold text-sm">
                {TESTIMONIALS[currentTestimonial].name.charAt(0)}
              </div>
              <div>
                <p className="text-gray-800 text-sm font-medium">{TESTIMONIALS[currentTestimonial].name}</p>
                <p className="text-gray-500 text-xs">{TESTIMONIALS[currentTestimonial].child}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3 print:hidden">
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