'use client';

import { Target, CheckCircle, TrendingUp, Clock, BookOpen, IndianRupee } from 'lucide-react';

interface ProgressPanelProps {
  completedSessions: number;
  totalSessions: number;
  sessionsPurchased: number | null;
  latestScore: number | null;
  getDaysRemaining: () => number;
  getProgressPercentage: () => number;
  // Tuition-specific props
  isTuition?: boolean;
  sessionsRemaining: number | null;
  sessionRate: number | null; // paise
  upcomingSessionDate: string | null;
}

export default function ProgressPanel({
  completedSessions,
  totalSessions,
  sessionsPurchased,
  latestScore,
  getDaysRemaining,
  getProgressPercentage,
  isTuition = false,
  sessionsRemaining,
  sessionRate,
  upcomingSessionDate,
}: ProgressPanelProps) {
  const displayTotal = sessionsPurchased || totalSessions;

  // Format upcoming session date for display
  function formatUpcoming(dateStr: string | null): string {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return '--';
    }
  }

  // Tuition-specific stats grid
  if (isTuition) {
    const rateDisplay =
      sessionRate != null
        ? `\u20B9${Math.round(sessionRate / 100)}/session`
        : '--';

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Sessions Left */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-amber-700" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {sessionsRemaining != null ? sessionsRemaining : '--'}
          </p>
          <p className="text-sm text-gray-500 mt-1">Sessions Left</p>
        </div>

        {/* Sessions Done */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-700" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedSessions}</p>
          <p className="text-sm text-gray-500 mt-1">Sessions Done</p>
        </div>

        {/* Rate */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <IndianRupee className="w-5 h-5 text-blue-700" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{rateDisplay}</p>
          <p className="text-sm text-gray-500 mt-1">Rate</p>
        </div>

        {/* Next Session */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-[#FF0099]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatUpcoming(upcomingSessionDate)}</p>
          <p className="text-sm text-gray-500 mt-1">Next Session</p>
        </div>
      </div>
    );
  }

  // Coaching stats grid (existing)
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Progress Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center mb-3">
          <Target className="w-5 h-5 text-[#FF0099]" />
        </div>
        <p className="text-2xl font-bold text-gray-900">{getProgressPercentage()}%</p>
        <p className="text-sm text-gray-500 mt-1">Progress</p>
        <div className="mt-3 h-2 bg-gray-50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-full transition-all duration-500"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Sessions Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
          <CheckCircle className="w-5 h-5 text-emerald-700" />
        </div>
        <p className="text-2xl font-bold text-gray-900">
          {completedSessions}/{displayTotal}
        </p>
        <p className="text-sm text-gray-500 mt-1">Sessions</p>
      </div>

      {/* Score Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
          <TrendingUp className="w-5 h-5 text-blue-700" />
        </div>
        <p className="text-2xl font-bold text-gray-900">{latestScore ?? '--'}/10</p>
        <p className="text-sm text-gray-500 mt-1">Latest Score</p>
      </div>

      {/* Days Left Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
          <Clock className="w-5 h-5 text-amber-700" />
        </div>
        <p className="text-2xl font-bold text-gray-900">{getDaysRemaining()}</p>
        <p className="text-sm text-gray-500 mt-1">Days Left</p>
      </div>
    </div>
  );
}
