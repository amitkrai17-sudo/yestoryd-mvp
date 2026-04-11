// app/coach/dashboard/CoachDashboardClient.tsx
// Unified coach dashboard — earnings, sessions, students, "How I earn"
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, Clock, Users, ChevronRight,
  IndianRupee, Video, MapPin, AlertCircle, BookOpen,
  GraduationCap, UserPlus, ClipboardCheck,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { ProductBadge } from '@/components/shared/RevenueCalculator';
import { getAvatarColor } from '@/lib/utils/avatar-colors';
import { formatTime12 } from '@/lib/utils/date-format';

// ============================================================
// TYPES
// ============================================================

interface DashboardData {
  coach: { name: string; tierName: string };
  todaySessions: SessionItem[];
  batchGroups: Record<string, string[]>;
  stats: {
    sessionsToday: number;
    completedThisMonth: number;
    upcoming: number;
    tuitionStudents: number;
    coachingStudents: number;
  };
  earnings: {
    total: number;
    byProduct: Record<string, { amount: number; sessions: number }>;
    nextPayoutDate: string | null;
  };
  howIEarn: {
    tuition: { coachPercent: number; leadPercent: number; platformPercent: number };
    coaching: { coachPercent: number; leadPercent: number; platformPercent: number };
    workshop: { coachPercent: number; leadPercent: number; platformPercent: number };
    tierName: string;
  };
  activeRates: { rateRupees: number; duration: number; childName: string; coachShare: number }[];
  students: StudentItem[];
  pendingActions: { captures: number };
}

interface SessionItem {
  id: string;
  time: string;
  sessionType: string;
  status: string;
  meetLink: string | null;
  childId: string;
  childName: string;
  sessionNumber: number | null;
  durationMinutes: number;
  rateRupees: number | null;
  batchId: string | null;
}

interface StudentItem {
  childId: string;
  childName: string;
  product: 'tuition' | 'coaching';
  rate: number | null;
  duration: number | null;
  purchased: number;
  completed: number;
}

// ============================================================
// HELPERS
// ============================================================

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRupees(amount: number): string {
  return `\u20B9${Math.round(amount).toLocaleString('en-IN')}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ============================================================
// COMPONENT
// ============================================================

export default function CoachDashboardClient({ coachName }: { coachName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tuition' | 'coaching' | 'workshop'>('tuition');

  useEffect(() => {
    fetch('/api/coach/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-text-tertiary">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        Failed to load dashboard. Please refresh.
      </div>
    );
  }

  const { stats, earnings, howIEarn, todaySessions, students, activeRates, pendingActions } = data;
  const currentMonth = MONTH_NAMES[new Date().getMonth()];
  const totalStudents = stats.tuitionStudents + stats.coachingStudents;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* SECTION 1 — Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white">
          {getGreeting()}, {(coachName || 'Coach').split(' ')[0]}
        </h1>
        <p className="text-sm text-text-tertiary mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          {totalStudents > 0 && ` \u00B7 ${stats.tuitionStudents} tuition \u00B7 ${stats.coachingStudents} coaching students`}
        </p>
      </div>

      {/* SECTION 2 — Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { value: stats.sessionsToday, label: 'Today', icon: Calendar, color: 'text-[#00ABFF]' },
          { value: stats.completedThisMonth, label: 'Completed', icon: ClipboardCheck, color: 'text-green-400' },
          { value: stats.upcoming, label: 'Upcoming', icon: Clock, color: 'text-purple-400' },
        ].map(card => (
          <div key={card.label} className="bg-surface-1/50 rounded-xl border border-border p-3 text-center">
            <card.icon className={`w-4 h-4 mx-auto mb-1 ${card.color}`} />
            <p className="text-[22px] font-bold text-white">{card.value}</p>
            <p className="text-[13px] text-text-tertiary">{card.label}</p>
          </div>
        ))}
      </div>

      {/* SECTION 3 — Today's sessions */}
      <div>
        <h2 className="text-[13px] uppercase tracking-wide text-text-tertiary font-medium mb-3">
          Today&apos;s Sessions
        </h2>
        {todaySessions.length === 0 ? (
          <div className="bg-surface-1/50 rounded-xl border border-border p-6 text-center">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-text-tertiary" />
            <p className="text-sm text-text-tertiary">No sessions scheduled today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(session => {
              const batchChildren = session.batchId ? data.batchGroups[session.batchId] : null;
              return (
                <div key={session.id} className="bg-surface-1/50 rounded-xl border border-border p-3 flex items-center gap-3">
                  {/* Time */}
                  <div className="text-center w-14 flex-shrink-0">
                    <p className="text-sm font-semibold text-white">{formatTime12(session.time)}</p>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {batchChildren && batchChildren.length > 1
                          ? batchChildren.join(', ')
                          : session.childName
                        }
                      </span>
                      <ProductBadge product={session.sessionType === 'tuition' ? 'tuition' : session.sessionType === 'remedial' ? 'coaching' : 'coaching'} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
                      <span>{session.durationMinutes}m</span>
                      {session.rateRupees && (
                        <>
                          <span>&middot;</span>
                          <span>{formatRupees(session.rateRupees)}/sess</span>
                        </>
                      )}
                      {session.meetLink && (
                        <>
                          <span>&middot;</span>
                          <Video className="w-3 h-3 inline" />
                        </>
                      )}
                    </div>
                  </div>
                  {/* CTA */}
                  <Link
                    href={`/coach/sessions`}
                    className="h-8 px-3 rounded-xl text-xs font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center gap-1 flex-shrink-0"
                  >
                    View
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4 — Earnings */}
      <div className="bg-surface-1/50 rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] uppercase tracking-wide text-text-tertiary font-medium">
            {currentMonth} Earnings
          </h2>
          <Link href="/coach/earnings" className="text-xs text-[#00ABFF] hover:underline flex items-center gap-0.5">
            View all<ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div>
          <p className="text-2xl font-bold text-white">{formatRupees(earnings.total)}</p>
          <p className="text-xs text-text-tertiary mt-0.5">
            {Object.values(earnings.byProduct).reduce((s, p) => s + p.sessions, 0)} sessions
            {earnings.nextPayoutDate && ` \u00B7 Next payout: ${new Date(earnings.nextPayoutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>

        {/* Stacked bar */}
        {earnings.total > 0 && (
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden flex">
            {(earnings.byProduct.tuition?.amount ?? 0) > 0 && (
              <div className="bg-blue-500" style={{ width: `${(earnings.byProduct.tuition.amount / earnings.total) * 100}%` }} />
            )}
            {(earnings.byProduct.coaching?.amount ?? 0) > 0 && (
              <div className="bg-purple-500" style={{ width: `${(earnings.byProduct.coaching.amount / earnings.total) * 100}%` }} />
            )}
            {(earnings.byProduct.workshop?.amount ?? 0) > 0 && (
              <div className="bg-teal-500" style={{ width: `${(earnings.byProduct.workshop.amount / earnings.total) * 100}%` }} />
            )}
          </div>
        )}

        {/* Breakdown rows */}
        <div className="space-y-1.5">
          {[
            { key: 'tuition', label: 'English Classes', dot: 'bg-blue-500' },
            { key: 'coaching', label: 'Coaching', dot: 'bg-purple-500' },
            { key: 'workshop', label: 'Workshops', dot: 'bg-teal-500' },
          ].map(row => {
            const prod = earnings.byProduct[row.key];
            return (
              <div key={row.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${row.dot}`} />
                  <span className="text-text-secondary">{row.label}</span>
                </div>
                <span className="text-text-tertiary">
                  {formatRupees(prod?.amount ?? 0)} &middot; {prod?.sessions ?? 0} sess
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 5 — How I earn (tabbed) */}
      <div className="bg-surface-1/50 rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {(['tuition', 'coaching', 'workshop'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[#00ABFF] border-b-2 border-[#00ABFF]'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab === 'tuition' ? 'English Classes' : tab === 'coaching' ? 'Coaching' : 'Workshops'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {activeTab === 'tuition' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Your share</span>
                <span className="text-white font-medium">{howIEarn.tuition.coachPercent}% of session rate</span>
              </div>
              <p className="text-xs text-text-tertiary">Rate set per child based on session duration and type</p>

              {activeRates.length > 0 && (
                <div className="bg-surface-2/50 rounded-lg p-3 space-y-1.5">
                  <p className="text-xs text-text-tertiary font-medium">Your current rates</p>
                  {activeRates.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-text-secondary">{formatRupees(r.rateRupees)}/sess ({r.duration}m)</span>
                      <span className="text-green-400 font-medium">{formatRupees(r.coachShare)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-text-tertiary pt-1">
                {howIEarn.tuition.leadPercent}% lead &middot; {howIEarn.tuition.coachPercent}% you &middot; {howIEarn.tuition.platformPercent}% platform
              </div>
            </>
          )}

          {activeTab === 'coaching' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Your tier</span>
                <span className="text-white font-medium">{howIEarn.tierName} ({howIEarn.coaching.coachPercent}%)</span>
              </div>
              <p className="text-xs text-text-tertiary">Per enrollment split applied to each coaching program</p>
              <div className="bg-surface-2/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-text-tertiary font-medium">Tier ladder</p>
                {[
                  { name: 'Rising', pct: 50 },
                  { name: 'Expert', pct: 55 },
                  { name: 'Master', pct: 60 },
                ].map(tier => (
                  <div key={tier.name} className="flex justify-between text-sm">
                    <span className={`text-text-secondary ${tier.name === howIEarn.tierName?.split(' ')[0] ? 'text-[#00ABFF] font-medium' : ''}`}>
                      {tier.name}
                    </span>
                    <span className="text-text-tertiary">{tier.pct}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-tertiary">Self-referral: earn lead cost too (10%)</p>
            </>
          )}

          {activeTab === 'workshop' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Your share</span>
                <span className="text-white font-medium">{howIEarn.workshop.coachPercent}% of workshop fee</span>
              </div>
              <p className="text-xs text-text-tertiary">Split varies by workshop type: blueprint 40-50%, own content 55-65%</p>
            </>
          )}
        </div>
      </div>

      {/* SECTION 6 — My students */}
      {students.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] uppercase tracking-wide text-text-tertiary font-medium">
              My Students ({students.length})
            </h2>
            <Link href="/coach/students" className="text-xs text-[#00ABFF] hover:underline flex items-center gap-0.5">
              View all<ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1.5">
            {students.slice(0, 6).map(student => {
              const pct = student.purchased > 0 ? Math.round((student.completed / student.purchased) * 100) : 0;
              return (
                <div key={`${student.childId}-${student.product}`} className="bg-surface-1/50 rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br ${getAvatarColor(student.childName)}`}>
                    {student.childName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white truncate">{student.childName}</span>
                      <ProductBadge product={student.product} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-16 h-1 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00ABFF] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-text-tertiary">{student.completed}/{student.purchased}</span>
                      {student.rate && <span className="text-xs text-text-tertiary">{formatRupees(student.rate)}/s</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 7 — Pending actions */}
      {pendingActions.captures > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/coach/sessions"
            className="h-8 px-3 rounded-xl text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            {pendingActions.captures} captures pending
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/coach/onboard-student"
          className="bg-surface-1/50 rounded-xl border border-border p-3 flex items-center gap-2 hover:bg-surface-1/80 transition-colors"
        >
          <UserPlus className="w-4 h-4 text-[#00ABFF]" />
          <span className="text-sm text-white">Onboard Student</span>
        </Link>
        <Link
          href="/coach/batches"
          className="bg-surface-1/50 rounded-xl border border-border p-3 flex items-center gap-2 hover:bg-surface-1/80 transition-colors"
        >
          <BookOpen className="w-4 h-4 text-[#00ABFF]" />
          <span className="text-sm text-white">My Classes</span>
        </Link>
      </div>
    </div>
  );
}
