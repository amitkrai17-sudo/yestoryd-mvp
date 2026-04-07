'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { usePortalTheme } from '@/components/providers/ThemeProvider';
import { NavItem } from '@/components/config/navigation';

interface BottomNavProps {
  items: NavItem[];
  basePath: string;
}

export default function BottomNav({ items, basePath }: BottomNavProps) {
  const pathname = usePathname();
  const { theme } = usePortalTheme();

  const isActive = (href: string) => {
    if (href === basePath || href === `${basePath}/dashboard`) {
      return pathname === href || pathname === basePath || pathname === `${basePath}/dashboard`;
    }
    return pathname.startsWith(href);
  };

  const isLight = theme.mode === 'light';

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t ${
        isLight
          ? 'bg-white/95 backdrop-blur-md border-gray-200'
          : 'bg-[#0a0a0f]/95 backdrop-blur-md border-white/[0.08]'
      }`}
      style={{ height: '64px' }}
    >
      <div className="flex w-full pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center transition-colors ${
                active
                  ? 'font-medium'
                  : isLight
                    ? 'text-gray-400 active:text-gray-600'
                    : 'text-gray-400 active:text-gray-200'
              }`}
              style={active ? { color: theme.accent } : undefined}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className={`text-[10px] mt-0.5 ${active ? 'font-medium' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
