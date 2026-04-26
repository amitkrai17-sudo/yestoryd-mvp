// components/coach/SessionCard.tsx
// Redesigned session card: avatar + name + time row, meta line,
// consistent CTA sizing, contextual dropdown, no duplicate labels

'use client';

import { Video, ArrowRight, CheckCircle, FileText, ClipboardCheck, MapPin, Send, ClipboardList } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ActionDropdown, ActionIcons } from './ActionDropdown';
import { getSessionTypeLabel as _getLabel } from '@/lib/utils/session-labels';
import { CommunicationTrigger } from '@/components/shared/CommunicationTrigger';
import { formatTime12 } from '@/lib/utils/date-format';
import { getAvatarColor } from '@/lib/utils/avatar-colors';

interface Session {
  id: string;
  child_id: string;
  child_name: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  session_number: number | null;
  total_sessions?: number;
  duration_minutes?: number | null;
  is_diagnostic?: boolean;
  status: string;
  google_meet_link: string | null;
  parent_update_sent_at?: string | null;
  parent_phone?: string;
  parent_name?: string;
  session_mode?: string;
  offline_request_status?: string | null;
  report_submitted_at?: string | null;
  enrollment_type?: string | null;
  capture_id?: string | null;
  pending_capture?: { id: string; ai_prefilled: boolean } | null;
}

interface SessionCardProps {
  session: Session;
  isPast: boolean;
  isToday: boolean;
  canComplete: { allowed: boolean; blockedBy: number | null };
  onPrep: () => void;
  onComplete: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onMissed: () => void;
  onRequestOffline?: () => void;
  onSwitchToOnline?: () => void;
  coachEmail?: string;
  isActiveSession?: boolean;
  onOpenNotes?: () => void;
  microNoteCount?: number;
}

function isWithinMinutes(dateStr: string, timeStr: string, minutes: number): boolean {
  const sessionDateTime = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  const diffMs = sessionDateTime.getTime() - now.getTime();
  const diffMins = diffMs / (1000 * 60);
  return diffMins <= minutes && diffMins >= -60;
}

function getSessionTypeLabel(type: string): string {
  if (type === 'remedial') return _getLabel('skill_booster');
  return _getLabel(type);
}

export function SessionCard({
  session,
  isPast,
  isToday,
  canComplete,
  onPrep,
  onComplete,
  onReschedule,
  onCancel,
  onMissed,
  onRequestOffline,
  onSwitchToOnline,
  isActiveSession,
  onOpenNotes,
  microNoteCount,
}: SessionCardProps) {
  const isOffline = session.session_mode === 'offline';
  const isPending = session.status === 'scheduled' || session.status === 'pending' || session.status === 'confirmed';
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const isMissed = session.status === 'missed';
  const canTakeAction = !isCompleted && !isCancelled && !isMissed;

  // Time-aware past check: session end time has passed (even if same calendar date)
  const sessionEndPassed = (() => {
    try {
      const start = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
      const endMs = start.getTime() + (session.duration_minutes || 45) * 60_000;
      return Date.now() > endMs;
    } catch { return false; }
  })();
  const effectivePast = isPast || (isToday && sessionEndPassed);

  const showJoin = !isOffline && isToday && session.google_meet_link && isPending &&
    isWithinMinutes(session.scheduled_date, session.scheduled_time, 15);
  const needsParentUpdate = isCompleted && !session.parent_update_sent_at;

  // Capture state
  // A capture is confirmed when capture_id exists AND no pending (unconfirmed) capture remains
  const hasPendingAiCapture = !!session.pending_capture?.ai_prefilled;
  const hasPendingCapture = !!session.pending_capture;
  const hasConfirmedCapture = !!session.capture_id && !hasPendingCapture;
  const needsReport = effectivePast && !isCompleted && !isCancelled && !isMissed && !hasConfirmedCapture;
  const legacyNeedsCapture = isCompleted && !hasConfirmedCapture && !hasPendingCapture;

  // Report due: completed but capture not yet confirmed by coach
  const reportDue = isCompleted && !hasConfirmedCapture;

  // Program label
  const programLabel = session.enrollment_type === 'tuition'
    ? 'English Classes'
    : getSessionTypeLabel(session.session_type);

  // Session progress text
  const progressText = session.enrollment_type === 'tuition'
    ? (session.duration_minutes ? `${session.duration_minutes}m` : '')
    : [
        session.session_number ? `#${session.session_number}` : null,
        session.session_number && session.total_sessions ? `of ${session.total_sessions}` : null,
      ].filter(Boolean).join(' ');

  // ---- CTA Button ----
  const getCTA = () => {
    // Active session: green Session Notes
    if (isActiveSession && onOpenNotes) {
      return (
        <button
          onClick={onOpenNotes}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Session Notes{microNoteCount ? ` (${microNoteCount})` : ''}
        </button>
      );
    }

    // Past + needs report with AI capture: pink Review
    if (needsReport && hasPendingAiCapture) {
      return (
        <button
          onClick={onComplete}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white hover:bg-[#FF0099]/90 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Review</span>
        </button>
      );
    }

    // Past + needs report: pink Fill Report
    if (needsReport) {
      return (
        <button
          onClick={onComplete}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white hover:bg-[#FF0099]/90 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fill Report</span>
          <ArrowRight className="w-3.5 h-3.5 sm:hidden" />
        </button>
      );
    }

    // Join meeting
    if (showJoin) {
      return (
        <a
          href={session.google_meet_link!}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 px-4 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          Join
        </a>
      );
    }

    // Needs parent update
    if (needsParentUpdate) {
      return (
        <CommunicationTrigger
          contextType="session"
          contextId={session.id}
          recipientType="parent"
          recipientPhone={session.parent_phone}
          recipientName={session.parent_name}
          userRole="coach"
          triggerLabel="Update"
          triggerVariant="button"
        />
      );
    }

    // Completed with report due
    if (reportDue || legacyNeedsCapture) {
      return (
        <button
          onClick={onComplete}
          className="h-9 px-4 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          Update
        </button>
      );
    }

    // Upcoming scheduled: Prep
    if (isPending && !effectivePast) {
      return (
        <button
          onClick={onPrep}
          className="h-9 px-4 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <FileText className="w-3.5 h-3.5" />
          Prep
        </button>
      );
    }

    // Completed with confirmed capture: just a check
    if (isCompleted && hasConfirmedCapture) {
      return <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />;
    }

    return null;
  };

  // ---- Contextual Dropdown ----
  const dropdownActions = [];

  if (isCompleted) {
    // Completed state: limited actions
    if (legacyNeedsCapture || reportDue) {
      dropdownActions.push({
        label: hasPendingAiCapture ? 'Review AI Capture' : 'Fill Report',
        icon: <ClipboardCheck className="w-4 h-4" />,
        onClick: onComplete,
      });
    }
    if (session.is_diagnostic) {
      dropdownActions.push({
        label: 'View Diagnostic',
        icon: <ClipboardCheck className="w-4 h-4" />,
        onClick: () => { window.location.href = `/coach/sessions/${session.id}/diagnostic`; },
      });
    }
    dropdownActions.push({
      label: 'View Student',
      icon: ActionIcons.view,
      onClick: () => { window.location.href = `/coach/students/${session.child_id}`; },
    });
  } else if (isMissed) {
    // Missed: reschedule + view
    dropdownActions.push({
      label: 'Reschedule',
      icon: ActionIcons.reschedule,
      onClick: onReschedule,
    });
    dropdownActions.push({
      label: 'View Student',
      icon: ActionIcons.view,
      onClick: () => { window.location.href = `/coach/students/${session.child_id}`; },
    });
  } else if (isCancelled) {
    // Cancelled: view only
    dropdownActions.push({
      label: 'View Student',
      icon: ActionIcons.view,
      onClick: () => { window.location.href = `/coach/students/${session.child_id}`; },
    });
  } else {
    // Active/scheduled state: full menu
    if (!showJoin && session.google_meet_link && !isOffline) {
      dropdownActions.push({
        label: 'Join Meeting',
        icon: ActionIcons.view,
        onClick: () => window.open(session.google_meet_link!, '_blank'),
      });
    }

    if (needsReport) {
      dropdownActions.push({
        label: hasPendingAiCapture ? 'Review AI Capture' : 'Fill Report',
        icon: <Send className="w-4 h-4" />,
        onClick: onComplete,
      });
    } else if (!hasPendingCapture) {
      // Suppress when a pending capture exists: the API would 400 with
      // 'pending_capture' anyway, and the coach must clear the capture via
      // the SCF flow ("Review AI Capture" / "Fill Report") before any
      // completion action is meaningful. Phase 0 audit (Apr 26) confirmed
      // this branch was dead UX — coaches couldn't reach it for the 14
      // stuck sessions because needsReport=true always took the if-branch.
      dropdownActions.push({
        label: 'Mark as Complete',
        icon: ActionIcons.complete,
        onClick: onComplete,
        disabled: !canComplete.allowed,
        disabledReason: canComplete.blockedBy
          ? `Complete Session #${canComplete.blockedBy} first`
          : undefined,
      });
    }

    // Offline/online switch
    if (onRequestOffline && !isOffline && !effectivePast && isPending) {
      dropdownActions.push({
        label: 'Switch to In-Person',
        icon: <MapPin className="w-4 h-4" />,
        onClick: onRequestOffline,
      });
    }
    if (onSwitchToOnline && isOffline && !effectivePast && isPending) {
      dropdownActions.push({
        label: 'Switch to Online',
        icon: <Video className="w-4 h-4" />,
        onClick: onSwitchToOnline,
      });
    }

    if (effectivePast) {
      dropdownActions.push({
        label: 'Mark as Missed',
        icon: ActionIcons.missed,
        onClick: onMissed,
        variant: 'warning' as const,
      });
    }

    dropdownActions.push({
      label: 'Reschedule',
      icon: ActionIcons.reschedule,
      onClick: onReschedule,
    });

    dropdownActions.push({
      label: 'Cancel Session',
      icon: ActionIcons.cancel,
      onClick: onCancel,
      variant: 'danger' as const,
    });

    if (session.is_diagnostic) {
      dropdownActions.push({
        label: 'Diagnostic Form',
        icon: <ClipboardCheck className="w-4 h-4" />,
        onClick: () => { window.location.href = `/coach/sessions/${session.id}/diagnostic`; },
      });
    }

    dropdownActions.push({
      label: 'View Student',
      icon: ActionIcons.view,
      onClick: () => { window.location.href = `/coach/students/${session.child_id}`; },
    });
  }

  return (
    <div className={`group flex items-start gap-3 p-3 lg:p-4 rounded-2xl border transition-all duration-150 max-w-3xl ${
      isActiveSession
        ? 'bg-green-500/5 border-green-500/30 hover:border-green-500/50'
        : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50 hover:border-gray-600/50'
    }`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-gradient-to-br ${
        isActiveSession ? 'from-green-500 to-green-600' : getAvatarColor(session.child_name)
      }`}>
        {session.child_name.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + Time */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[15px] text-white truncate">{session.child_name}</span>
          <span className="text-sm text-gray-400 flex-shrink-0">{formatTime12(session.scheduled_time)}</span>
        </div>

        {/* Row 2: Meta line */}
        <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-400">
          <span className="truncate">{programLabel}</span>
          {session.duration_minutes && (
            <>
              <span className="text-gray-600">&middot;</span>
              <span>{session.duration_minutes}m</span>
            </>
          )}
          {isOffline && (
            <>
              <span className="text-gray-600">&middot;</span>
              <span className="text-purple-400/80 flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                In-Person
              </span>
            </>
          )}
        </div>

        {/* Row 3: Status + alerts + CTA */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isActiveSession ? (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                In Progress
              </span>
            ) : (
              <StatusBadge status={session.status} size="sm" />
            )}
            {session.is_diagnostic && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                Diagnostic
              </span>
            )}
            {(reportDue || (needsReport && !hasPendingAiCapture)) && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">
                Report Due
              </span>
            )}
            {progressText && (
              <span className="text-[11px] text-gray-500">
                Session {progressText}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {getCTA()}
            {dropdownActions.length > 0 && (
              <ActionDropdown actions={dropdownActions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
