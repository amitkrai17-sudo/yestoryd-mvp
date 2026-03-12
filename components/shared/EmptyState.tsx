'use client';

import Link from 'next/link';
import { Inbox, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[40vh] text-center px-4 ${className}`}>
      <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-text-tertiary" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-sm">{description}</p>
      )}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-4 px-4 h-10 inline-flex items-center justify-center rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-4 px-4 h-10 inline-flex items-center justify-center rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
