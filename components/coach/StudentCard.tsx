'use client';

import Link from 'next/link';
import { ChevronRight, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

interface StudentCardProps {
  student: {
    id: string;
    child_name: string;
    age: number;
    age_band?: string | null;
    assessment_score?: number | null;
    sessions_completed: number;
    total_sessions: number;
    status: string;
    is_coach_lead?: boolean;
    trend?: string;
    focus_area?: string;
  };
}

export default function StudentCard({ student }: StudentCardProps) {
  const progress = student.total_sessions > 0
    ? (student.sessions_completed / student.total_sessions) * 100
    : 0;

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-400';
    if (score >= 8) return 'text-green-400';
    if (score >= 5) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-3 hover:border-gray-700 transition-colors">
      {/* Single Row: Avatar | Info | Actions */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00ABFF] to-[#0066CC] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {student.child_name?.charAt(0) || 'S'}
        </div>

        {/* Info - Compact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-white text-sm truncate max-w-[120px]">
              {student.child_name}
            </span>
            <span className="text-[10px] text-gray-500">{student.age}y</span>
            <AgeBandBadge ageBand={student.age_band} age={student.age} />
            {student.is_coach_lead && (
              <span className="px-1.5 py-0.5 bg-[#00ABFF]/20 text-[#00ABFF] text-[9px] rounded font-medium">
                70%
              </span>
            )}
            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
              student.status === 'active'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {student.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${getScoreColor(student.assessment_score)}`}>
              {student.assessment_score ? `${student.assessment_score}/10` : '-/10'}
            </span>
            <span className="text-[10px] text-gray-500">
              {student.sessions_completed}/{student.total_sessions} sessions
            </span>
            {student.trend && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                student.trend === 'improving' ? 'text-green-400' :
                student.trend === 'declining' ? 'text-amber-400' :
                'text-blue-400'
              }`}>
                {student.trend === 'improving' ? <TrendingUp className="w-3 h-3" /> :
                 student.trend === 'declining' ? <TrendingDown className="w-3 h-3" /> :
                 <ArrowRight className="w-3 h-3" />}
                {student.trend === 'improving' ? '↑' : student.trend === 'declining' ? '↓' : '→'}
              </span>
            )}
          </div>
          {student.focus_area && (
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">
              Focus: {student.focus_area}
            </p>
          )}
        </div>

        {/* Action Button */}
        <Link
          href={`/coach/students/${student.id}`}
          className="h-8 px-3 bg-[#00ABFF] hover:bg-[#00ABFF]/80 text-white text-xs font-medium rounded-lg flex items-center gap-1 flex-shrink-0 transition-colors"
        >
          View
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#00ABFF] to-[#00ABFF] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
