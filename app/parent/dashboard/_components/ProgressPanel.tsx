'use client';

import { Target, CheckCircle, TrendingUp, Clock } from 'lucide-react';

interface ProgressPanelProps {
  completedSessions: number;
  totalSessions: number;
  sessionsPurchased: number | null;
  latestScore: number | null;
  getDaysRemaining: () => number;
  getProgressPercentage: () => number;
}

export default function ProgressPanel({
  completedSessions,
  totalSessions,
  sessionsPurchased,
  latestScore,
  getDaysRemaining,
  getProgressPercentage,
}: ProgressPanelProps) {
  const displayTotal = sessionsPurchased || totalSessions;

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
