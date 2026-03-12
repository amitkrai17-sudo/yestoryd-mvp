'use client';

// ============================================================
// FILE: app/my-child/[childId]/MyChildPortalClient.tsx
// ============================================================
// Client component for the "My Child" portal.
// Mobile-first, single scrollable page, standalone (no nav bar).
// Uses parent portal light/pink theme.
// ============================================================

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Lock, Search, Flame, Trophy, Award, BookOpen } from 'lucide-react';

// ── Types ──

interface ChildOverview {
  id: string;
  name: string;
  age: number | null;
  age_band: string | null;
  is_enrolled: boolean | null;
  current_streak: number;
  total_classes_attended: number;
}

interface ClassHistoryItem {
  id: string;
  event_type: string;
  date: string | null;
  insight_text: string | null;
  class_name: string | null;
  session_id: string | null;
  badges_earned: string[];
}

interface SkillItem {
  skill: string;
  count: number;
}

interface BadgeItem {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  rarity: string | null;
  earned_at: string | null;
}

interface RecommendedClass {
  session_id: string;
  title: string;
  icon: string | null;
  description: string | null;
  date: string;
  time: string;
  price: number | null;
  is_new_type: boolean;
}

interface GamificationData {
  streak: number;
  total_attended: number;
  xp: number;
  level: number;
}

interface PortalData {
  child: ChildOverview;
  class_history: ClassHistoryItem[];
  skills_explored: SkillItem[];
  badges: BadgeItem[];
  gamification: GamificationData | null;
  recommended_classes: RecommendedClass[];
  attendance_count: number;
}

type AuthState = 'authenticated' | 'needs_phone' | 'invalid_token' | 'not_found';

interface Props {
  childId: string;
  authState: AuthState;
  data: PortalData | null;
  token: string | null;
}

// ── Colors (parent portal pink theme) ──

const ACCENT = '#FF0099';
const ACCENT_LIGHT = 'rgba(255, 0, 153, 0.1)';
const SKILL_COLORS = [
  '#FF0099', '#7B008B', '#00ABFF', '#E6C600', '#25D366',
  '#FF6B35', '#9B59B6', '#3498DB',
];

// ── Helpers ──

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getCtaContent(name: string, count: number): { heading: string; body: string; cta: string } {
  if (count <= 2) {
    return {
      heading: `Want to understand ${name}'s complete reading profile?`,
      body: `After ${count} group class${count > 1 ? 'es' : ''}, ${name} is off to a great start. A free AI assessment reveals exactly where they stand across reading, comprehension, and fluency.`,
      cta: 'Take a Free AI Assessment',
    };
  }
  if (count <= 4) {
    return {
      heading: `See how ${name}'s group class skills compare`,
      body: `${name} has attended ${count} classes and explored multiple skills. A quick assessment shows you the full picture — strengths, growth areas, and what to focus on next.`,
      cta: 'Get a Full Reading Assessment',
    };
  }
  return {
    heading: `${name} has built a great foundation`,
    body: `With ${count} classes under their belt, ${name} is ready for the next level. Explore personalized 1:1 coaching that builds on what they've learned in group classes.`,
    cta: 'Explore 1:1 Coaching',
  };
}

// ── Main Component ──

export default function MyChildPortalClient({ childId, authState, data, token }: Props) {
  const [shareToast, setShareToast] = useState(false);

  // ── Error / Auth states ──

  if (authState === 'invalid_token') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-400" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired or Invalid</h1>
          <p className="text-gray-600 text-sm max-w-xs">
            This link may have expired or been tampered with. Please use the latest link from your WhatsApp messages.
          </p>
        </div>
      </Shell>
    );
  }

  if (authState === 'not_found') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="flex justify-center mb-4"><Search className="w-12 h-12 text-gray-400" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Child Not Found</h1>
          <p className="text-gray-600 text-sm max-w-xs">
            We couldn&apos;t find this profile. Please contact support if you think this is an error.
          </p>
        </div>
      </Shell>
    );
  }

  if (authState === 'needs_phone') {
    return (
      <Shell>
        <PhoneAccessForm childId={childId} />
      </Shell>
    );
  }

  if (!data) return null;

  const { child, class_history, skills_explored, badges, gamification, recommended_classes, attendance_count } = data;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/my-child/${childId}?token=${token}`;
    const shareData = {
      title: `${child.name}'s Learning Journey`,
      text: `See ${child.name}'s group class progress on Yestoryd`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <Shell>
      {/* ── Header ── */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#FF0099] uppercase tracking-wider">Yestoryd</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{child.name}&apos;s Journey</h1>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#FF0099] bg-[#FF0099]/10 rounded-lg active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* ── Section 1: Overview Card ── */}
      <section className="px-4 pb-4">
        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #7B008B)` }}
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            <StatBox label="Classes" value={child.total_classes_attended} />
            <StatBox label="Streak" value={child.current_streak} icon={<Flame className="w-4 h-4 inline-block ml-1 text-orange-300" />} />
            <StatBox label="Age" value={child.age ? `${child.age}y` : '-'} />
          </div>
          {gamification && gamification.xp > 0 && (
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
              <span>Level {gamification.level}</span>
              <span>{gamification.xp} XP earned</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Class History with Micro-Insights ── */}
      {class_history.length > 0 && (
        <section className="px-4 pb-6">
          <SectionTitle title="Class Insights" />
          <div className="space-y-3">
            {class_history.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {item.class_name || 'Group Class'}
                    </span>
                    {item.badges_earned.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                        <Trophy className="w-3 h-3" /> Badge!
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                    {formatDate(item.date)}
                  </span>
                </div>
                {item.insight_text && (
                  <p className="text-sm text-gray-600 leading-relaxed">{item.insight_text}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Skills Explored (Bar Chart) ── */}
      {skills_explored.length > 0 && (
        <section className="px-4 pb-6">
          <SectionTitle title="Skills Explored" />
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={skills_explored.length * 44 + 20}>
              <BarChart
                data={skills_explored}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="skill"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} class${value > 1 ? 'es' : ''}`, 'Exposure']}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                  {skills_explored.map((_, i) => (
                    <Cell key={i} fill={SKILL_COLORS[i % SKILL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Section 4: Badges Earned ── */}
      {badges.length > 0 && (
        <section className="px-4 pb-6">
          <SectionTitle title="Badges Earned" />
          <div className="grid grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm text-center"
              >
                <div className="flex justify-center mb-1.5">
                  {badge.icon ? <span className="text-3xl">{badge.icon}</span> : <Award className="w-8 h-8 text-amber-500" />}
                </div>
                <p className="text-xs font-semibold text-gray-900 leading-tight">{badge.name}</p>
                {badge.rarity && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF0099]/10 text-[#FF0099] font-medium">
                    {badge.rarity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 5: Recommended Next Classes ── */}
      {recommended_classes.length > 0 && (
        <section className="px-4 pb-6">
          <SectionTitle title="Recommended Next Classes" />
          <div className="space-y-3">
            {recommended_classes.map((cls) => (
              <div
                key={cls.session_id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0">{cls.icon ? <span className="text-2xl">{cls.icon}</span> : <BookOpen className="w-6 h-6 text-[#FF0099]" />}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{cls.title}</h4>
                      {cls.is_new_type && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                          New!
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(cls.date)} at {formatTime(cls.time)}
                    </p>
                    {cls.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{cls.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm font-bold text-gray-900">
                        {cls.price ? `₹${cls.price}` : 'Free'}
                      </span>
                      <a
                        href={`/group-classes?session=${cls.session_id}`}
                        className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white rounded-lg active:scale-95 transition-transform"
                        style={{ backgroundColor: ACCENT }}
                      >
                        Register
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 6: Soft Upgrade CTA ── */}
      {!child.is_enrolled && attendance_count > 0 && (
        <section className="px-4 pb-8">
          <UpgradeCTA name={child.name} attendanceCount={attendance_count} />
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="px-4 pb-8 text-center">
        <p className="text-xs text-gray-400">
          Powered by Yestoryd — AI Reading Coach for Kids
        </p>
      </footer>

      {/* ── Share toast ── */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          Link copied to clipboard
        </div>
      )}
    </Shell>
  );
}

// ── Sub-components ──

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-base font-bold text-gray-900 mb-3">{title}</h2>;
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}{icon}</div>
      <div className="text-xs text-white/70 mt-0.5">{label}</div>
    </div>
  );
}

function UpgradeCTA({ name, attendanceCount }: { name: string; attendanceCount: number }) {
  const { heading, body, cta } = getCtaContent(name, attendanceCount);

  return (
    <div className="rounded-2xl border-2 border-[#FF0099]/20 bg-gradient-to-br from-[#FF0099]/5 to-purple-50 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-2">{heading}</h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{body}</p>
      <a
        href="/assessment"
        className="block w-full text-center py-3 px-4 rounded-xl text-white font-semibold text-sm active:scale-[0.98] transition-transform"
        style={{ background: `linear-gradient(135deg, ${ACCENT}, #7B008B)` }}
      >
        {cta}
      </a>
    </div>
  );
}

function PhoneAccessForm({ childId }: { childId: string }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/my-child/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, phone: cleaned }),
      });

      const data = await res.json();

      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setError(data.error || 'Could not verify phone number. Please try the link from WhatsApp.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="flex justify-center mb-4"><BookOpen className="w-12 h-12 text-[#FF0099]" /></div>
      <h1 className="text-xl font-bold text-gray-900 mb-2 text-center">
        View Your Child&apos;s Learning Journey
      </h1>
      <p className="text-sm text-gray-600 text-center mb-6 max-w-xs">
        Enter the phone number you used when registering for group classes.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+91</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number"
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099]"
            maxLength={12}
            autoFocus
          />
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: ACCENT }}
        >
          {loading ? 'Verifying...' : 'Access Portal'}
        </button>
      </form>

      <p className="text-xs text-gray-400 mt-6 text-center max-w-xs">
        For the easiest access, use the direct link sent to you via WhatsApp after each class.
      </p>
    </div>
  );
}
