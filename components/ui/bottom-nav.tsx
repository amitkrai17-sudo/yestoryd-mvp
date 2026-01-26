'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

interface BottomNavProps {
  items: NavItem[];
  className?: string;
}

const BottomNav = ({ items, className }: BottomNavProps) => {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30',
        'bg-surface-1 border-t border-border',
        'safe-area-bottom',
        'md:hidden', // Hide on desktop
        className
      )}
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center',
                'min-h-[56px] min-w-[64px] px-3 py-2',
                'transition-colors duration-200',
                isActive
                  ? 'text-brand-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <Icon
                className={cn(
                  'h-6 w-6 mb-1',
                  isActive && 'stroke-[2.5px]'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-brand-primary' : 'text-text-tertiary'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

BottomNav.displayName = 'BottomNav';

// Spacer component to prevent content from being hidden behind bottom nav
const BottomNavSpacer = ({ className }: { className?: string }) => (
  <div className={cn('h-[72px] md:hidden', className)} />
);

BottomNavSpacer.displayName = 'BottomNavSpacer';

export { BottomNav, BottomNavSpacer };
