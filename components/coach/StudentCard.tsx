// components/coach/StudentCard.tsx
// Compact student card: 2-row collapsed, expandable detail accordion
// Consistent with SessionCard redesign (h-9 CTAs, rounded-2xl, max-w-3xl)

'use client';

import { useState } from 'react';
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
  MapPin,
  AlertTriangle,
  Eye,
  MessageSquare,
  CreditCard,
} from 'lucide-react';
import { ActionDropdown } from './ActionDropdown';
import { CommunicationTrigger } from '@/components/shared/CommunicationTrigger';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';

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
  freshness_status?: string | null;
}

interface StudentCardProps {
  student: StudentData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSchedule?: (student: StudentData) => void;
  onRecordPayment?: (student: StudentData) => void;
}

// Avatar color based on child name hash
function getAvatarColor(name: string): string {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
    'from-amber-500 to-amber-600',
    'from-indigo-500 to-indigo-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
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
    // Not JSON
  }
  return raw;
}

// Smart name shortening for tight spaces
function formatChildName(name: string, compact: boolean = false): string {
  if (!compact) return name;
  const parts = name.trim().split(' ');
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

// Determine alert state
function getAlert(student: StudentData): { text: string; className: string } | null {
  const isTuition = student.enrollment_type === 'tuition';
  const hasRemaining = isTuition
    ? (student.sessions_remaining ?? 0) > 0
    : student.sessions_completed < student.total_sessions;

  if (student.status === 'payment_pending') {
    return { text: 'Payment Due', className: 'bg-red-500/20 text-red-400 border-red-500/30' };
  }
  if (hasRemaining && !student.next_session_date) {
    return { text: 'Not scheduled', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  }
  if (!hasRemaining && student.status === 'active') {
    return { text: 'Course complete', className: 'bg-green-500/20 text-green-400 border-green-500/30' };
  }
  if (student.status === 'paused') {
    return { text: 'Paused', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  }
  // Inactive > 14 days
  if (student.last_session_date) {
    const daysSince = Math.floor((Date.now() - new Date(student.last_session_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14 && hasRemaining) {
      return { text: 'Inactive', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  }
  return null;
}

export default function StudentCard({ student, isExpanded, onToggleExpand, onSchedule, onRecordPayment }: StudentCardProps) {
  const isTuition = student.enrollment_type === 'tuition';
  const completed = student.sessions_completed;
  const total = isTuition ? (student.sessions_purchased ?? student.total_sessions) : student.total_sessions;
  const hasRemaining = isTuition
    ? (student.sessions_remaining ?? 0) > 0
    : completed < total;
  const alert = getAlert(student);
  const isInPerson = student.default_session_mode === 'offline';
  const programLabel = isTuition ? 'English Classes' : '1:1 Coaching';

  // Primary CTA logic
  const getCTA = () => {
    if (student.status === 'payment_pending' && onRecordPayment) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onRecordPayment(student); }}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Payment</span>
        </button>
      );
    }
    if (hasRemaining && !student.next_session_date && onSchedule) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onSchedule(student); }}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white hover:bg-[#FF0099]/90 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Schedule</span>
          <ArrowRight className="w-3.5 h-3.5 sm:hidden" />
        </button>
      );
    }
    if (!hasRemaining && student.status === 'active') {
      return (
        <Link
          href={`/coach/students/${student.child_id}`}
          onClick={(e) => e.stopPropagation()}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white hover:bg-[#FF0099]/90 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          Re-enroll
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      );
    }
    if (hasRemaining && student.next_session_date && onSchedule) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onSchedule(student); }}
          className="h-9 px-4 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Session</span>
        </button>
      );
    }
    // Fallback: view arrow
    return (
      <Link
        href={`/coach/students/${student.child_id}`}
        onClick={(e) => e.stopPropagation()}
        className="h-9 px-3 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors flex items-center flex-shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    );
  };

  // Dropdown actions
  const dropdownActions = [];

  dropdownActions.push({
    label: 'View Student',
    icon: <Eye className="w-4 h-4" />,
    onClick: () => { window.location.href = `/coach/students/${student.child_id}`; },
  });

  if (onSchedule && hasRemaining) {
    dropdownActions.push({
      label: 'Add Session',
      icon: <Calendar className="w-4 h-4" />,
      onClick: () => onSchedule(student),
    });
  }

  if (isTuition && onRecordPayment) {
    dropdownActions.push({
      label: 'Record Payment',
      icon: <CreditCard className="w-4 h-4" />,
      onClick: () => onRecordPayment(student),
    });
  }

  dropdownActions.push({
    label: 'View in rAI',
    icon: <ChevronRight className="w-4 h-4" />,
    onClick: () => { window.location.href = `/coach/students/${student.child_id}`; },
  });

  return (
    <div
      className="group rounded-2xl border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 hover:border-gray-600/50 transition-all duration-150 max-w-3xl cursor-pointer"
      onClick={onToggleExpand}
    >
      {/* Collapsed view — always visible */}
      <div className="flex items-start gap-3 p-3 lg:p-4">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-gradient-to-br ${getAvatarColor(student.child_name)}`}>
          {student.child_name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + age + progress + CTA */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[15px] text-white truncate" title={student.child_name}>
                <span className="sm:hidden">{formatChildName(student.child_name, true)}</span>
                <span className="hidden sm:inline">{student.child_name}</span>
              </span>
              <span className="text-sm text-gray-500 flex-shrink-0">{student.age}y</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-gray-400">{completed}/{total}</span>
              {getCTA()}
            </div>
          </div>

          {/* Row 2: Program + mode + next session / alert + dropdown */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-400 min-w-0">
              <span className="flex-shrink-0">{programLabel}</span>
              {isInPerson && (
                <>
                  <span className="text-gray-600">&middot;</span>
                  <span className="text-purple-400/80 flex items-center gap-0.5 flex-shrink-0">
                    <MapPin className="w-3 h-3" />
                    <span className="hidden sm:inline">In-Person</span>
                  </span>
                </>
              )}
              {student.next_session_date && !alert ? (
                <>
                  <span className="text-gray-600">&middot;</span>
                  <span className="truncate">
                    Next: {formatDateShort(student.next_session_date)}
                    {student.next_session_time && (
                      <span className="hidden sm:inline"> {formatTime12(student.next_session_time)}</span>
                    )}
                  </span>
                </>
              ) : alert ? (
                <>
                  <span className="text-gray-600">&middot;</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-full border font-medium flex items-center gap-0.5 ${alert.className}`}>
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {alert.text}
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <ActionDropdown actions={dropdownActions} />
            </div>
          </div>
        </div>
      </div>

      {/* Expanded view — accordion detail */}
      {isExpanded && (
        <div className="border-t border-gray-700/30 px-4 pb-4 pt-3 space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isTuition ? getBalanceBarColor(student.sessions_remaining ?? 0, student.sessions_purchased ?? 0) : 'bg-gradient-to-r from-[#00ABFF] to-[#0066CC]'
                  }`}
                  style={{ width: `${total > 0 ? Math.min(100, (completed / total) * 100) : 0}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{completed}/{total} sessions</span>
            {student.session_rate && (
              <span className="text-xs text-gray-500 flex-shrink-0">
                &middot; Rs.{Math.round(student.session_rate / 100)}/session
              </span>
            )}
          </div>

          {/* Schedule preference */}
          {student.schedule_preference && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{formatSchedulePref(student.schedule_preference)}</span>
            </div>
          )}

          {/* Last session */}
          {student.last_session_date && (
            <div className="text-xs text-gray-500">
              Last: {formatDateShort(student.last_session_date)}
              {student.last_session_focus && ` \u2014 ${student.last_session_focus}`}
            </div>
          )}

          {/* Coaching-specific: score + trend */}
          {!isTuition && (student.assessment_score || student.trend || student.focus_areas) && (
            <div className="flex items-center gap-3 text-xs">
              {student.assessment_score != null && (
                <span className={`font-medium ${
                  student.assessment_score >= 8 ? 'text-green-400' :
                  student.assessment_score >= 5 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  Score: {student.assessment_score}/10
                </span>
              )}
              {student.trend && (
                <span className={`flex items-center gap-0.5 ${
                  student.trend === 'improving' ? 'text-green-400' :
                  student.trend === 'declining' ? 'text-amber-400' :
                  'text-blue-400'
                }`}>
                  {student.trend === 'improving' ? <TrendingUp className="w-3 h-3" /> :
                   student.trend === 'declining' ? <TrendingDown className="w-3 h-3" /> :
                   <ArrowRight className="w-3 h-3" />}
                  {student.trend}
                </span>
              )}
              {student.focus_areas && (
                <span className="text-gray-500 truncate">Focus: {student.focus_areas}</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
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

            {isTuition && onRecordPayment && (
              <button
                onClick={() => onRecordPayment(student)}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-[#00ABFF]/10 text-[#00ABFF] hover:bg-[#00ABFF]/20 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Payment
              </button>
            )}

            {onSchedule && hasRemaining && (
              <button
                onClick={() => onSchedule(student)}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Session
              </button>
            )}

            <Link
              href={`/coach/students/${student.child_id}`}
              className="h-9 px-3 rounded-xl text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors flex items-center gap-1.5 ml-auto"
            >
              View in rAI
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function getBalanceBarColor(remaining: number, purchased: number): string {
  if (purchased === 0) return 'bg-gray-500';
  const pct = remaining / purchased;
  if (pct > 0.5) return 'bg-green-500';
  if (pct > 0.25) return 'bg-amber-500';
  return 'bg-red-500';
}
