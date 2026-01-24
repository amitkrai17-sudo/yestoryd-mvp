// components/coach/StatusBadge.tsx
// Reusable status badge component with consistent styling

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  scheduled: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'Scheduled',
  },
  pending: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'Scheduled',
  },
  active: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'Active',
  },
  pending_start: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    label: 'Pending Start',
  },
  completed: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
    label: 'Completed',
  },
  missed: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'Missed',
  },
  rescheduled: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    label: 'Rescheduled',
  },
  cancelled: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'Cancelled',
  },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`
        ${config.bg} ${config.text} ${config.border}
        ${sizeClasses}
        border rounded-full font-medium inline-flex items-center
      `}
    >
      {config.label}
    </span>
  );
}

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
}
