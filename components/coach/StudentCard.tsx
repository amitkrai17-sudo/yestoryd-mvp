'use client';

import Link from 'next/link';
import {
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Calendar,
  Plus,
  Clock,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';
import { CommunicationTrigger } from '@/components/shared/CommunicationTrigger';

export interface StudentData {
  child_id: string;
  child_name: string;
  age: number;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  enrollment_id: string;
  enrollment_type: string;
  status: string;
  age_band: string | null;
  billing_model: string | null;
  is_coach_lead: boolean;
  sessions_completed: number;
  total_sessions: number;
  session_rate: number | null;
  sessions_remaining: number | null;
  sessions_purchased: number | null;
  schedule_preference: string | null;
  default_session_mode: string | null;
  default_duration_minutes: number | null;
  assessment_score: number | null;
  focus_areas: string | null;
  trend: string | null;
  last_session_date: string | null;
  last_session_focus: string | null;
  next_session_date: string | null;
  next_session_time: string | null;
}

interface StudentCardProps {
  student: StudentData;
  onSchedule?: (student: StudentData) => void;
  onRecordPayment?: (student: StudentData) => void;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatSchedulePref(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const days = Array.isArray(parsed.days) ? parsed.days.join(', ') : '';
      const slot = parsed.timeSlot || '';
      const preferred = parsed.preferredTime || '';
      const parts = [days, slot].filter(Boolean).join(' \u2014 ');
      return preferred ? `${parts} (${preferred})` : parts;
    }
  } catch {
    // Not JSON — return as-is (already a formatted string)
  }
  return raw;
}

function getBalanceColor(remaining: number, purchased: number): string {
  if (purchased === 0) return 'bg-gray-500';
  const pct = remaining / purchased;
  if (pct > 0.5) return 'bg-green-500';
  if (pct > 0.25) return 'bg-amber-500';
  return 'bg-red-500';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'paused':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'payment_pending':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'completed':
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}

export default function StudentCard({ student, onSchedule, onRecordPayment }: StudentCardProps) {
  const isTuition = student.enrollment_type === 'tuition';
  const progress = student.total_sessions > 0
    ? (student.sessions_completed / student.total_sessions) * 100
    : 0;

  const balanceColor = isTuition
    ? getBalanceColor(student.sessions_remaining ?? 0, student.sessions_purchased ?? 0)
    : '';

  return (
    <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-3 lg:p-4 hover:border-gray-600 transition-colors">
      {/* Row 1: Avatar + Name + Badges */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
          isTuition
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-[#00ABFF] to-[#0066CC]'
        }`}>
          {student.child_name?.charAt(0) || 'S'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-white text-sm truncate max-w-[130px]">
              {student.child_name}
            </span>
            <span className="text-[10px] text-gray-500">{student.age}y</span>

            {/* Type badge */}
            {isTuition ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <BookOpen className="w-2.5 h-2.5" />
                Tuition
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <GraduationCap className="w-2.5 h-2.5" />
                Coaching
              </span>
            )}

            {/* Status badge */}
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium border ${getStatusBadge(student.status)}`}>
              {student.status === 'payment_pending' ? 'Payment Pending' : student.status}
            </span>

            {!isTuition && student.age_band && (
              <AgeBandBadge ageBand={student.age_band} age={student.age} />
            )}

            {student.is_coach_lead && (
              <span className="px-1.5 py-0.5 bg-[#00ABFF]/20 text-[#00ABFF] text-[9px] rounded font-medium">
                70%
              </span>
            )}
          </div>

          {/* Row 2: Session info */}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
            {/* Last session */}
            {student.last_session_date && (
              <span className="truncate">
                Last: {formatDateShort(student.last_session_date)}
                {student.last_session_focus && ` — ${student.last_session_focus}`}
              </span>
            )}
            {!student.last_session_date && (
              <span className="text-gray-500">No sessions yet</span>
            )}
          </div>

          {/* Row 3: Next session */}
          <div className="flex items-center gap-1 mt-0.5 text-[11px]">
            <Calendar className="w-3 h-3 text-gray-500 flex-shrink-0" />
            {student.next_session_date ? (
              <span className="text-gray-300">
                Next: {formatDateShort(student.next_session_date)}
                {student.next_session_time && ` ${formatTime(student.next_session_time)}`}
              </span>
            ) : (
              <span className="text-gray-500">Not scheduled</span>
            )}
          </div>
        </div>

        {/* View rAI */}
        <Link
          href={`/coach/students/${student.child_id}`}
          className="h-8 px-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-xl flex items-center gap-1 flex-shrink-0 transition-colors"
          title="View in rAI"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Tuition-specific: Balance + Rate + Schedule Pref */}
      {isTuition && (
        <div className="mt-3 space-y-2">
          {/* Balance bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-400">
                  {student.sessions_remaining}/{student.sessions_purchased} sessions
                </span>
                {student.session_rate && (
                  <span className="text-[11px] text-gray-500">
                    ₹{Math.round(student.session_rate / 100)}/session
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${balanceColor}`}
                  style={{
                    width: `${student.sessions_purchased
                      ? Math.min(100, ((student.sessions_remaining ?? 0) / student.sessions_purchased) * 100)
                      : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Schedule preference */}
          {student.schedule_preference && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{formatSchedulePref(student.schedule_preference)}</span>
            </div>
          )}
        </div>
      )}

      {/* Coaching-specific: Progress bar + score + trend */}
      {!isTuition && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">
              Session {student.sessions_completed}/{student.total_sessions}
            </span>
            <div className="flex items-center gap-2">
              {student.assessment_score && (
                <span className={`text-[11px] ${
                  student.assessment_score >= 8 ? 'text-green-400' :
                  student.assessment_score >= 5 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  {student.assessment_score}/10
                </span>
              )}
              {student.trend && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                  student.trend === 'improving' ? 'text-green-400' :
                  student.trend === 'declining' ? 'text-amber-400' :
                  'text-blue-400'
                }`}>
                  {student.trend === 'improving' ? <TrendingUp className="w-3 h-3" /> :
                   student.trend === 'declining' ? <TrendingDown className="w-3 h-3" /> :
                   <ArrowRight className="w-3 h-3" />}
                </span>
              )}
            </div>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00ABFF] to-[#0066CC] rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          {student.focus_areas && (
            <p className="text-[10px] text-gray-500 mt-1 truncate">
              Focus: {student.focus_areas}
            </p>
          )}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-3">
        {/* Message Parent */}
        <CommunicationTrigger
          contextType={isTuition ? 'tuition' : 'general'}
          contextId={student.enrollment_id}
          recipientType="parent"
          recipientName={student.parent_name || undefined}
          recipientPhone={student.parent_phone || undefined}
          recipientEmail={student.parent_email || undefined}
          userRole="coach"
          triggerVariant="icon-only"
        />

        {/* Record Payment — tuition only */}
        {isTuition && onRecordPayment && (
          <button
            onClick={() => onRecordPayment(student)}
            className="flex items-center justify-center gap-1.5 px-3 h-10 rounded-xl bg-[#00ABFF]/10 text-[#00ABFF] text-xs font-medium hover:bg-[#00ABFF]/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Payment
          </button>
        )}

        {/* Schedule Session — tuition only */}
        {isTuition && student.status === 'active' && (student.sessions_remaining ?? 0) > 0 && onSchedule && (
          <button
            onClick={() => onSchedule(student)}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule
          </button>
        )}

        {/* View in rAI — full button on desktop */}
        <Link
          href={`/coach/students/${student.child_id}`}
          className="hidden lg:flex items-center gap-1.5 px-3 h-10 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium transition-colors"
        >
          View in rAI
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
