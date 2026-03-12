'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  sticky?: boolean;
  backHref?: string;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  sticky = false,
  backHref,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 mb-6 ${
        sticky ? 'sticky top-0 z-10 bg-inherit backdrop-blur-sm py-4 -mt-4' : ''
      } ${className}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              className="p-1.5 rounded-xl hover:bg-surface-2 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5 text-text-secondary" />
            </Link>
          )}
          <h1 className="text-xl sm:text-2xl font-bold font-display text-text-primary truncate">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
