'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NavItem } from '@/components/config/navigation';

interface BottomNavProps {
  items: NavItem[];
  basePath: string;
}

export default function BottomNav({ items, basePath }: BottomNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Handle dashboard/home as default route
    if (href === basePath || href === `${basePath}/dashboard`) {
      return (
        pathname === href ||
        pathname === basePath ||
        pathname === `${basePath}/dashboard`
      );
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-gray-800 lg:hidden z-50">
      {/* Safe area padding for notched phones */}
      <div className="flex pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors ${
                active ? 'text-[#FF0099]' : 'text-gray-500 active:text-gray-300'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF0099] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium">
                {item.shortLabel || item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
