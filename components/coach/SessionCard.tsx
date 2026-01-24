// components/coach/SessionCard.tsx
// Clean session card component with smart primary action

'use client';

import Link from 'next/link';
import { Video, ArrowRight, CheckCircle, FileText, MessageSquare } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ActionDropdown, ActionIcons } from './ActionDropdown';

interface Session {
  id: string;
  child_id: string;
  child_name: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  session_number: number | null;
  status: string;
  google_meet_link: string | null;
  parent_update_sent_at?: string | null;
  parent_phone?: string;
  parent_name?: string;
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
  switch (type) {
    case 'coaching':
      return 'Coaching';
    case 'parent_checkin':
      return 'Parent Check-in';
    case 'remedial':
      return 'Skill Booster';
    default:
      return type;
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
}: SessionCardProps) {
  const isPending = session.status === 'scheduled' || session.status === 'pending' || session.status === 'confirmed';
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const canTakeAction = !isCompleted && !isCancelled; // Can reschedule, cancel, complete
  const showJoin = isToday && session.google_meet_link && isPending &&
    isWithinMinutes(session.scheduled_date, session.scheduled_time, 15);
  const needsParentUpdate = isCompleted && !session.parent_update_sent_at;

  // Determine primary action
  const getPrimaryAction = () => {
    if (showJoin) {
      return (
        <a
          href={session.google_meet_link!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#00ABFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#00ABFF]/90 transition-colors"
        >
          <Video className="w-4 h-4" />
          Join
          <ArrowRight className="w-4 h-4" />
        </a>
      );
    }

    if (needsParentUpdate && onParentUpdate) {
      return (
        <button
          onClick={onParentUpdate}
          className="flex items-center gap-2 bg-[#FF0099] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#FF0099]/90 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Update Parent
        </button>
      );
    }

    if (isPending && !isPast) {
      return (
        <button
          onClick={onPrep}
          className="flex items-center gap-2 border border-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 hover:text-white transition-colors"
        >
          <FileText className="w-4 h-4" />
          Prep
        </button>
      );
    }

    if (isCompleted) {
      return (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-5 h-5" />
        </div>
      );
    }

    return null;
  };

  // Build dropdown actions
  const dropdownActions = [];

  // Join meeting link (if available and not already showing as primary action)
  if (canTakeAction && !showJoin && session.google_meet_link) {
    dropdownActions.push({
      label: 'Join Meeting',
      icon: ActionIcons.view,
      onClick: () => window.open(session.google_meet_link!, '_blank'),
    });
  }

  // Mark as Complete - show for today or past sessions that aren't completed/cancelled
  if (canTakeAction && (isPast || isToday)) {
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

  // View Student - always available
  dropdownActions.push({
    label: 'View Student',
    icon: ActionIcons.view,
    onClick: () => window.location.href = `/coach/students/${session.child_id}`,
  });

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-11 h-11 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
          {session.child_name.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">
              {session.child_name}
            </h3>
            <StatusBadge status={session.status} />
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            {getSessionTypeLabel(session.session_type)}
            {session.session_number && ` \u2022 Session #${session.session_number}`}
          </p>
        </div>

        {/* Time - visible on larger screens */}
        <div className="hidden sm:block text-right">
          <p className="text-white font-medium">{formatTime(session.scheduled_time)}</p>
        </div>

        {/* Primary Action */}
        <div className="flex items-center gap-2">
          {getPrimaryAction()}
          {dropdownActions.length > 0 && (
            <ActionDropdown actions={dropdownActions} />
          )}
        </div>
      </div>

      {/* Time - visible on mobile */}
      <div className="sm:hidden mt-3 pt-3 border-t border-gray-800">
        <p className="text-gray-400 text-sm">
          {formatTime(session.scheduled_time)}
        </p>
      </div>
    </div>
  );
}
