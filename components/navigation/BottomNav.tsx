'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface BottomNavProps {
  items: NavItem[];
  baseRoute: string; // '/parent' or '/coach'
  theme?: 'light' | 'dark';
}

export default function BottomNav({ items, baseRoute, theme = 'light' }: BottomNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Handle dashboard as home
    if (href === `${baseRoute}/dashboard`) {
      return pathname === baseRoute || pathname === `${baseRoute}/dashboard`;
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'border-t',
        theme === 'light'
          ? 'bg-white border-gray-200'
          : 'bg-[#0f1419] border-gray-700'
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto pb-safe">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center',
                'min-w-[64px] min-h-[44px] px-3 py-1',
                'rounded-lg transition-colors',
                active
                  ? 'text-[#FF0099]'
                  : theme === 'light'
                    ? 'text-gray-500 active:text-gray-900'
                    : 'text-gray-400 active:text-white'
              )}
            >
              <Icon className={cn('w-6 h-6', active && 'stroke-[2.5px]')} />
              <span
                className={cn(
                  'text-xs mt-0.5',
                  active ? 'font-semibold' : 'font-medium'
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
}
