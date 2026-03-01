// components/coach/SessionCard.tsx
// Clean session card component with smart primary action
// Supports offline session badges and status indicators

'use client';

import Link from 'next/link';
import { Video, ArrowRight, CheckCircle, FileText, MessageSquare, ClipboardCheck, MapPin, Clock, Send, ClipboardList } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ActionDropdown, ActionIcons } from './ActionDropdown';
import { getSessionTypeLabel as _getLabel } from '@/lib/utils/session-labels';

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
  // Offline fields
  session_mode?: string;
  offline_request_status?: string | null;
  report_submitted_at?: string | null;
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
  onParentUpdate?: () => void;
  onRequestOffline?: () => void;
  coachEmail?: string;
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function isWithinMinutes(dateStr: string, timeStr: string, minutes: number): boolean {
  const sessionDateTime = new Date(`${dateStr}T${timeStr}`);
  const now = new Date();
  const diffMs = sessionDateTime.getTime() - now.getTime();
  const diffMins = diffMs / (1000 * 60);
  return diffMins <= minutes && diffMins >= -60; // Within time window or started within last hour
}

function getSessionTypeLabel(type: string): string {
  if (type === 'remedial') return _getLabel('skill_booster');
  return _getLabel(type);
}

// In-person status badge helper
function getInPersonStatusInfo(session: Session, isPast: boolean): { label: string; className: string; icon: 'mappin' | 'clipboard' | 'check' | 'clock' } | null {
  if (session.session_mode !== 'offline') return null;

  if (session.report_submitted_at) {
    return { label: 'Report Submitted', className: 'bg-green-500/20 text-green-400 border-green-500/30', icon: 'check' };
  }

  if (session.offline_request_status === 'pending') {
    return { label: 'In-Person Request Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: 'clock' };
  }

  const isApproved = session.offline_request_status === 'approved' || session.offline_request_status === 'auto_approved';

  if (isApproved && isPast && session.status !== 'completed') {
    return { label: 'Report Due', className: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse', icon: 'clipboard' };
  }

  if (isApproved) {
    return { label: 'In-Person Session', className: 'bg-green-500/20 text-green-400 border-green-500/30', icon: 'mappin' };
  }

  return null;
}

// Status icon component
function StatusIcon({ icon, className }: { icon: 'mappin' | 'clipboard' | 'check' | 'clock'; className?: string }) {
  const cls = className || 'w-2.5 h-2.5';
  switch (icon) {
    case 'mappin': return <MapPin className={cls} />;
    case 'clipboard': return <ClipboardList className={cls} />;
    case 'check': return <CheckCircle className={cls} />;
    case 'clock': return <Clock className={cls} />;
  }
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
  onParentUpdate,
  onRequestOffline,
}: SessionCardProps) {
  const isOffline = session.session_mode === 'offline';
  const isPending = session.status === 'scheduled' || session.status === 'pending' || session.status === 'confirmed';
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const canTakeAction = !isCompleted && !isCancelled; // Can reschedule, cancel, complete
  const showJoin = !isOffline && isToday && session.google_meet_link && isPending &&
    isWithinMinutes(session.scheduled_date, session.scheduled_time, 15);
  const needsParentUpdate = isCompleted && !session.parent_update_sent_at;
  const inPersonStatus = getInPersonStatusInfo(session, isPast);

  // Offline: needs report (approved, past, not completed)
  const isApprovedOffline = isOffline &&
    (session.offline_request_status === 'approved' || session.offline_request_status === 'auto_approved');
  const needsReport = isApprovedOffline && isPast && !session.report_submitted_at && session.status !== 'completed';

  // Determine primary action
  const getPrimaryAction = () => {
    // Offline session needing report — show Submit Report CTA
    if (needsReport) {
      return (
        <Link
          href={`/coach/sessions/${session.id}/report`}
          className="flex items-center gap-1.5 lg:gap-2 bg-red-500 text-white px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium hover:bg-red-600 transition-colors animate-pulse"
        >
          <Send className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          <span className="hidden sm:inline">Report</span>
        </Link>
      );
    }

    if (showJoin) {
      return (
        <a
          href={session.google_meet_link!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 lg:gap-2 bg-[#00ABFF] text-white px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium hover:bg-[#00ABFF]/90 transition-colors"
        >
          <Video className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          <span className="hidden sm:inline">Join</span>
          <ArrowRight className="w-3.5 h-3.5 lg:w-4 lg:h-4 sm:hidden" />
        </a>
      );
    }

    if (needsParentUpdate && onParentUpdate) {
      return (
        <button
          onClick={onParentUpdate}
          className="flex items-center gap-1.5 lg:gap-2 bg-[#00ABFF] text-white px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium hover:bg-[#00ABFF]/90 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          <span className="hidden sm:inline">Update</span>
        </button>
      );
    }

    if (isPending && !isPast) {
      return (
        <button
          onClick={onPrep}
          className="flex items-center gap-1.5 lg:gap-2 border border-gray-600 text-gray-300 px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
        >
          <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          Prep
        </button>
      );
    }

    if (isCompleted) {
      return (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5" />
        </div>
      );
    }

    return null;
  };

  // Build dropdown actions
  const dropdownActions = [];

  // Join meeting link (if available and not already showing as primary action)
  if (canTakeAction && !showJoin && session.google_meet_link && !isOffline) {
    dropdownActions.push({
      label: 'Join Meeting',
      icon: ActionIcons.view,
      onClick: () => window.open(session.google_meet_link!, '_blank'),
    });
  }

  // Submit Report — for offline sessions that need it
  if (needsReport) {
    dropdownActions.push({
      label: 'Submit Report',
      icon: <Send className="w-4 h-4" />,
      onClick: () => { window.location.href = `/coach/sessions/${session.id}/report`; },
    });
  }

  // Mark as Complete - show for all pending/scheduled sessions (not completed/cancelled)
  // For offline sessions, completion happens through the report flow
  if (canTakeAction && !isOffline) {
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

  // Request Offline — for online, upcoming, scheduled sessions
  if (onRequestOffline && !isOffline && canTakeAction && !isPast && isPending) {
    dropdownActions.push({
      label: 'Switch to In-Person',
      icon: <MapPin className="w-4 h-4" />,
      onClick: onRequestOffline,
    });
  }

  // Mark as Missed - only for past sessions
  if (canTakeAction && isPast) {
    dropdownActions.push({
      label: 'Mark as Missed',
      icon: ActionIcons.missed,
      onClick: onMissed,
      variant: 'warning' as const,
    });
  }

  // Reschedule - available for non-completed/cancelled sessions
  if (canTakeAction) {
    dropdownActions.push({
      label: 'Reschedule',
      icon: ActionIcons.reschedule,
      onClick: onReschedule,
    });
  }

  // Cancel - available for non-completed/cancelled sessions
  if (canTakeAction) {
    dropdownActions.push({
      label: 'Cancel Session',
      icon: ActionIcons.cancel,
      onClick: onCancel,
      variant: 'danger' as const,
    });
  }

  // Diagnostic form - for diagnostic sessions
  if (session.is_diagnostic) {
    dropdownActions.push({
      label: isCompleted ? 'View Diagnostic' : 'Diagnostic Form',
      icon: <ClipboardCheck className="w-4 h-4" />,
      onClick: () => { window.location.href = `/coach/sessions/${session.id}/diagnostic`; },
    });
  }

  // View Student - always available
  dropdownActions.push({
    label: 'View Student',
    icon: ActionIcons.view,
    onClick: () => { window.location.href = `/coach/students/${session.child_id}`; },
  });

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-2.5 lg:p-3 hover:border-gray-700 transition-colors w-full overflow-hidden">
      <div className="flex items-center gap-2.5 w-full">
        {/* Avatar - smaller on mobile */}
        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-[#00ABFF] to-[#0066CC] rounded-full flex items-center justify-center text-white font-bold text-xs lg:text-sm flex-shrink-0">
          {session.child_name.charAt(0).toUpperCase()}
        </div>

        {/* Content - compact single line on mobile */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-medium text-sm text-white truncate max-w-[100px] sm:max-w-[140px] lg:max-w-none">
              {session.child_name}
            </h3>
            <StatusBadge status={session.status} size="sm" />
            {/* In-Person badge */}
            {isOffline && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                In-Person
              </span>
            )}
            {session.is_diagnostic && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                Diagnostic
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-gray-500 text-[11px] lg:text-xs truncate">
              {getSessionTypeLabel(session.session_type)}
              {session.session_number && ` #${session.session_number}`}
              {session.session_number && session.total_sessions && ` of ${session.total_sessions}`}
              {session.duration_minutes && ` • ${session.duration_minutes}m`}
              <span className="sm:hidden"> • {formatTime(session.scheduled_time)}</span>
            </p>
            {/* In-person status indicator */}
            {inPersonStatus && (
              <span className={`px-1.5 py-0.5 text-[9px] rounded border font-medium whitespace-nowrap flex items-center gap-0.5 ${inPersonStatus.className}`}>
                <StatusIcon icon={inPersonStatus.icon} />
                {inPersonStatus.label}
              </span>
            )}
          </div>
        </div>

        {/* Time - visible on larger screens */}
        <div className="hidden sm:block text-right flex-shrink-0">
          <p className="text-gray-400 text-xs lg:text-sm">{formatTime(session.scheduled_time)}</p>
        </div>

        {/* Primary Action */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {getPrimaryAction()}
          {dropdownActions.length > 0 && (
            <ActionDropdown actions={dropdownActions} />
          )}
        </div>
      </div>
    </div>
  );
}
