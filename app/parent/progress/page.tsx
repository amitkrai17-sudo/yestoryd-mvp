'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen, Check, Lock, Flame, Trophy,
  Star, GraduationCap, TrendingUp, Target,
  ChevronRight, MapPin,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useParentContext } from '@/app/parent/context';
import { FeatureGate } from '@/components/shared/FeatureGate';

// ============================================================
// Types
// ============================================================

interface SkillRating {
  skill_name: string;
  rating: string; // Emerging | Growing | Strong | Mastered
  rating_raw: string;
  trend: string;
}

interface IntelligenceProfile {
  overall_reading_level: string;
  skill_ratings: SkillRating[];
  narrative_summary: string;
  key_strengths: string[];
  growth_areas: string[];
  last_assessed: string;
}

interface LearningEvent {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  created_at: string;
}

// ============================================================
// Helpers
// ============================================================

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

function formatEventDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

// Map skill rating to progress bar width
function ratingToWidth(rating: string): string {
  switch (rating) {
    case 'Mastered': return 'w-full';
    case 'Strong': return 'w-3/4';
    case 'Growing': return 'w-1/2';
    case 'Emerging': return 'w-1/4';
    default: return 'w-0';
  }
}

function ratingToOpacity(rating: string): string {
  switch (rating) {
    case 'Mastered': return 'opacity-100';
    case 'Strong': return 'opacity-100';
    case 'Growing': return 'opacity-70';
    case 'Emerging': return 'opacity-50';
    default: return 'opacity-0';
  }
}

// Map rating_raw to parent-friendly display label
function ratingLabel(rating: string): string {
  switch (rating) {
    case 'Mastered': return 'Mastered';
    case 'Strong': return 'Developing';
    case 'Growing': return 'Emerging';
    case 'Emerging': return 'Emerging';
    default: return 'Not yet assessed';
  }
}

// Generate meaningful milestone text from learning events
function getMilestoneText(event: LearningEvent): string {
  const data = event.event_data || {};
  switch (event.event_type) {
    case 'session_completed':
      if (data.session_number) return `Completed session #${data.session_number}`;
      return 'Completed a coaching session';
    case 'assessment':
      if (data.score) return `Reading assessment: scored ${data.score}/10`;
      if (data.wpm) return `Reading speed: ${data.wpm} words per minute`;
      return 'Completed a reading assessment';
    case 'skill_mastered':
      return `${data.skill || 'A skill'} mastered`;
    case 'achievement':
      if (data.description) return data.description;
      if (data.achievement) return data.achievement;
      return 'Achievement unlocked';
    case 'practice_completed':
      return `Completed daily practice${data.skill_label ? `: ${data.skill_label}` : ''}`;
    default:
      return data.description || 'Learning milestone reached';
  }
}

// ============================================================
// Page Component
// ============================================================

export default function ParentProgressPageGated() {
  const { selectedChildId } = useParentContext();
  return (
    <FeatureGate featureKey="progress_cards" childId={selectedChildId}>
      <ParentProgressPageInner />
    </FeatureGate>
  );
}

function ParentProgressPageInner() {
  const { selectedChildId, selectedChild } = useParentContext();
  const childName = selectedChild?.child_name || selectedChild?.name || 'Your Child';

  const [loading, setLoading] = useState(true);

  // Enrollment/session data
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [enrollmentType, setEnrollmentType] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState('');

  // Intelligence profile
  const [hasProfile, setHasProfile] = useState(false);
  const [profile, setProfile] = useState<IntelligenceProfile | null>(null);

  // Learning events for milestones
  const [milestones, setMilestones] = useState<LearningEvent[]>([]);

  const fetchData = useCallback(async (childId: string) => {
    try {
      // Fetch dashboard (session counts) + intelligence profile in parallel
      const [dashboardRes, intelligenceRes] = await Promise.all([
        fetch('/api/parent/dashboard'),
        fetch(`/api/parent/intelligence/${childId}`),
      ]);

      const dashboardData = await dashboardRes.json();
      const intelligenceData = await intelligenceRes.json();

      // Dashboard data — session counts + recent sessions for milestones
      if (dashboardData.success && dashboardData.child) {
        setSessionsCompleted(dashboardData.child.sessionsCompleted || 0);
        setTotalSessions(dashboardData.child.totalSessions || 0);

        // Build milestones from recent session notes + upcoming sessions
        const sessionMilestones = (dashboardData.recentNotes || []).map((note: any) => ({
          id: note.id,
          event_type: 'session_completed',
          event_data: {
            session_number: note.scheduled_sessions?.session_number,
            focus_area: note.focus_area || note.scheduled_sessions?.session_type,
          },
          created_at: note.created_at,
        }));

        setMilestones(sessionMilestones.slice(0, 5));
      }

      // Intelligence data — skill ratings + reading level
      if (intelligenceData.success) {
        setHasProfile(intelligenceData.has_profile);
        if (intelligenceData.profile) {
          setProfile(intelligenceData.profile);
          setSeasonName(intelligenceData.profile.overall_reading_level || 'Building Reader');
        }
      }

      if (!intelligenceData.profile) {
        setSeasonName('Building Reader');
      }

    } catch (err) {
      console.error('Progress fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchData(selectedChildId).finally(() => setLoading(false));

    const handleChildChange = () => {
      setLoading(true);
      fetchData(selectedChildId).finally(() => setLoading(false));
    };
    window.addEventListener('childChanged', handleChildChange);
    return () => window.removeEventListener('childChanged', handleChildChange);
  }, [selectedChildId, fetchData]);

  // Computed values
  const remaining = Math.max(0, totalSessions - sessionsCompleted);
  const progressPercent = totalSessions > 0 ? Math.round((sessionsCompleted / totalSessions) * 100) : 0;

  // Motivational message
  function getMotivationalMessage(): string {
    if (remaining === 0 && totalSessions > 0) return `All ${totalSessions} sessions completed. Amazing progress!`;
    if (remaining === 1) return 'Almost there! 1 session remaining';
    if (remaining <= 3) return `Just ${remaining} sessions to go! Keep it up`;
    if (sessionsCompleted === 0) return 'The reading journey begins with the first session';
    return `${sessionsCompleted} sessions completed. Great momentum!`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 py-8">
            <EmptyState
              icon={BookOpen}
              title="No Active Enrollment"
              description="Enroll your child to start tracking progress."
              action={{ label: 'Reading Test - Free', href: '/assessment' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* ============ HEADER ============ */}
        <div>
          <h1 className="text-xl font-medium text-gray-900">{childName}&apos;s progress</h1>
          <p className="text-gray-500 text-sm mt-0.5">Reading journey overview</p>
        </div>

        {/* ============ SECTION 1: HERO — READING LEVEL ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-4">
            {/* Gradient icon */}
            <div className="w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-[#FF0099] to-[#7B008B] flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-medium text-gray-900">
                {seasonName || 'Building reader'}
              </p>
              <p className="text-sm text-gray-500">
                {enrollmentType === 'tuition' ? 'English Classes program' : 'Reading program'}
                {totalSessions > 0 && ` · ${pluralize(totalSessions, 'session')} total`}
              </p>
            </div>
          </div>

          {/* Season progress bar */}
          {totalSessions > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">Season progress</span>
                <span className="text-xs text-gray-500">
                  {sessionsCompleted} of {pluralize(totalSessions, 'session')}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF0099] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-[#FF0099] mt-1.5 font-medium">
                {getMotivationalMessage()}
              </p>
            </div>
          )}
        </div>

        {/* ── JOURNEY ACCESS ── */}
        <Link
          href="/parent/journey"
          className="bg-[#EEEDFE] rounded-2xl border border-[#534AB7]/20 p-4 flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-[#534AB7]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#3C3489]">Journey</p>
            <p className="text-xs text-[#534AB7]">View {childName}&apos;s learning roadmap</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#534AB7] group-hover:text-[#3C3489] flex-shrink-0" />
        </Link>

        {/* ============ SECTION 2: SKILL AREAS ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Skill areas</p>
            <Link
              href={`/parent/rai`}
              className="text-xs text-[#FF0099] font-medium flex items-center gap-0.5 hover:underline"
            >
              View full profile
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {hasProfile && profile?.skill_ratings && profile.skill_ratings.length > 0 ? (
            <div className="space-y-3">
              {profile.skill_ratings.map((skill, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-900">{skill.skill_name}</span>
                    <span className="text-xs text-gray-500">{ratingLabel(skill.rating)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-[#FF0099] rounded-full ${ratingToWidth(skill.rating)} ${ratingToOpacity(skill.rating)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Skill assessments will appear after a few sessions
              </p>
            </div>
          )}
        </div>

        {/* ============ SECTION 3: ACHIEVEMENTS ============ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Achievements</p>

          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {/* First Step */}
            <AchievementBadge
              icon={Trophy}
              name="First Step"
              unlocked={sessionsCompleted >= 1}
              detail={sessionsCompleted >= 1 ? 'Unlocked' : '1 session'}
            />

            {/* On Fire — 3 sessions */}
            <AchievementBadge
              icon={Flame}
              name="On Fire"
              unlocked={sessionsCompleted >= 3}
              detail={sessionsCompleted >= 3 ? '3 sessions' : `${sessionsCompleted}/3 sessions`}
            />

            {/* Consistent — 10 sessions */}
            <AchievementBadge
              icon={Star}
              name="Consistent"
              unlocked={sessionsCompleted >= 10}
              detail={sessionsCompleted >= 10 ? '10 sessions' : `${sessionsCompleted}/10 sessions`}
            />

            {/* Graduate */}
            <AchievementBadge
              icon={GraduationCap}
              name="Graduate"
              unlocked={totalSessions > 0 && sessionsCompleted >= totalSessions}
              detail={totalSessions > 0 && sessionsCompleted >= totalSessions ? 'Complete' : `${sessionsCompleted}/${totalSessions}`}
            />
          </div>
        </div>

        {/* ============ SECTION 4: RECENT MILESTONES ============ */}
        {milestones.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Recent milestones</p>

            <div className="border-l-2 border-[#FFD6E8] ml-2 space-y-4">
              {milestones.map((event, i) => (
                <div key={event.id} className="relative pl-5">
                  {/* Dot */}
                  <div
                    className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${
                      i === 0 ? 'bg-[#FF0099]' : 'bg-[#FFD6E8]'
                    }`}
                  />
                  <p className="text-sm text-gray-900">{getMilestoneText(event)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatEventDate(event.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty milestone state */}
        {milestones.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Recent milestones</p>
            <div className="text-center py-6">
              <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Milestones will appear as {childName} progresses
              </p>
            </div>
          </div>
        )}

        {/* ============ SECTION 5: MOTIVATIONAL BANNER ============ */}
        {sessionsCompleted > 0 && (
          <div className="bg-[#FFF5F9] rounded-2xl border border-[#FFD6E8] p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8FCF1] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Great progress!</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {remaining === 0
                  ? `${pluralize(sessionsCompleted, 'session')} completed. ${childName} finished the season!`
                  : `${pluralize(sessionsCompleted, 'session')} completed. ${pluralize(remaining, 'more')} to finish this season.`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Achievement Badge Component
// ============================================================

function AchievementBadge({
  icon: Icon,
  name,
  unlocked,
  detail,
}: {
  icon: typeof Trophy;
  name: string;
  unlocked: boolean;
  detail: string;
}) {
  return (
    <div
      className={`flex-shrink-0 w-[90px] p-3 rounded-2xl text-center snap-start ${
        unlocked
          ? 'bg-[#FFF5F9]'
          : 'bg-gray-100 opacity-50'
      }`}
    >
      <div className="flex justify-center mb-1.5">
        {unlocked ? (
          <Icon className="w-6 h-6 text-[#993556]" />
        ) : (
          <Lock className="w-6 h-6 text-gray-400" />
        )}
      </div>
      <p className={`text-xs font-semibold ${unlocked ? 'text-[#993556]' : 'text-gray-400'}`}>
        {name}
      </p>
      <p className={`text-[10px] mt-0.5 ${unlocked ? 'text-[#993556]/70' : 'text-gray-400'}`}>
        {detail}
      </p>
    </div>
  );
}
