'use client';

import { CheckCircle, Clock, AlertTriangle, XCircle, Pause, Circle, type LucideIcon } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

type StatusColor = 'green' | 'blue' | 'yellow' | 'red' | 'orange' | 'gray';

const STATUS_COLOR_MAP: Record<string, StatusColor> = {
  completed: 'green',
  complete: 'green',
  active: 'green',
  live: 'green',
  approved: 'green',
  paid: 'green',
  sent: 'green',
  on_track: 'green',
  enrolled: 'blue',
  assessed: 'blue',
  scheduled: 'blue',
  call_scheduled: 'blue',
  call_done: 'blue',
  confirmed: 'blue',
  booked: 'blue',
  in_progress: 'blue',
  ready: 'blue',
  contacted: 'yellow',
  follow_up: 'blue',
  pending: 'yellow',
  pending_review: 'yellow',
  draft: 'yellow',
  waiting: 'yellow',
  overdue: 'red',
  failed: 'red',
  cancelled: 'red',
  canceled: 'red',
  rejected: 'red',
  expired: 'red',
  lost: 'red',
  churned: 'red',
  not_interested: 'red',
  no_show: 'red',
  at_risk: 'orange',
  warning: 'orange',
  paused: 'gray',
  inactive: 'gray',
  disabled: 'gray',
  archived: 'gray',
};

const STATUS_ICON_MAP: Record<string, LucideIcon> = {
  completed: CheckCircle,
  complete: CheckCircle,
  approved: CheckCircle,
  paid: CheckCircle,
  sent: CheckCircle,
  active: Circle,
  live: Circle,
  enrolled: Circle,
  confirmed: Circle,
  booked: Circle,
  on_track: Circle,
  ready: Circle,
  scheduled: Clock,
  pending: Clock,
  pending_review: Clock,
  draft: Clock,
  waiting: Clock,
  in_progress: Clock,
  overdue: AlertTriangle,
  at_risk: AlertTriangle,
  warning: AlertTriangle,
  failed: XCircle,
  cancelled: XCircle,
  canceled: XCircle,
  rejected: XCircle,
  expired: XCircle,
  paused: Pause,
  inactive: Pause,
  disabled: Pause,
  archived: Pause,
};

const COLOR_CLASSES: Record<StatusColor, string> = {
  green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const SIZE_CLASSES = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
  md: 'px-2 py-1 text-xs gap-1',
};

const ICON_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
};

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function StatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className = '',
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().trim();
  const color = STATUS_COLOR_MAP[normalizedStatus] || 'gray';
  const Icon = STATUS_ICON_MAP[normalizedStatus] || Circle;

  return (
    <span
      className={`inline-flex items-center ${SIZE_CLASSES[size]} rounded-full font-medium border ${COLOR_CLASSES[color]} ${className}`}
    >
      {showIcon && <Icon className={ICON_SIZES[size]} />}
      {formatStatusLabel(status)}
    </span>
  );
}
