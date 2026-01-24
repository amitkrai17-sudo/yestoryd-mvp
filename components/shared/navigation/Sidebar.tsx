'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavItem } from '@/components/config/navigation';

interface SidebarProps {
  items: NavItem[];
  basePath: string;
  portalName: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export default function Sidebar({
  items,
  basePath,
  portalName,
  collapsible = true,
  defaultCollapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

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
    <aside
      className={`hidden lg:flex flex-col fixed left-0 top-0 h-full bg-[#0a0a0a] border-r border-gray-800 transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo / Portal Name */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800">
        {!collapsed && (
          <span className="text-base font-bold text-white truncate">
            {portalName}
          </span>
        )}
        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors ${
              collapsed ? 'mx-auto' : ''
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                active
                  ? 'bg-[#FF0099]/10 text-[#FF0099]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm truncate">{item.label}</span>
              )}
              {!collapsed && item.badge && item.badge > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-[#FF0099] text-white text-[10px] font-bold rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-4">
        {!collapsed && (
          <p className="text-[10px] text-gray-600 text-center">Yestoryd</p>
        )}
      </div>
    </aside>
  );
}
