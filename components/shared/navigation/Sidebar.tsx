'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { usePortalTheme } from '@/components/providers/ThemeProvider';
import { NavItem } from '@/components/config/navigation';

interface SidebarProps {
  items: NavItem[];
  basePath: string;
  portalName: string;
  onSignOut?: () => void;
  userAvatar?: React.ReactNode;
  userName?: string;
  userEmail?: string;
  headerExtra?: React.ReactNode;  // For parent child selector
}

const STORAGE_KEY = 'yestoryd-sidebar-collapsed';

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined') return localStorage.getItem(key);
  } catch { /* noop */ }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch { /* noop */ }
}

export default function Sidebar({
  items,
  basePath,
  portalName,
  onSignOut,
  userAvatar,
  userName,
  userEmail,
  headerExtra,
}: SidebarProps) {
  const pathname = usePathname();
  const { theme } = usePortalTheme();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = safeGetItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    safeSetItem(STORAGE_KEY, String(next));
  };

  const isActive = (href: string) => {
    if (href === basePath || href === `${basePath}/dashboard`) {
      return pathname === href || pathname === basePath || pathname === `${basePath}/dashboard`;
    }
    return pathname.startsWith(href);
  };

  // Group items by group field
  const groups: { label: string; items: NavItem[] }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const g = item.group || '';
    if (!seen.has(g)) {
      seen.add(g);
      groups.push({ label: g, items: [] });
    }
    groups.find(gr => gr.label === g)!.items.push(item);
  }

  const isDark = theme.mode === 'dark';

  return (
    <aside
      className={`hidden lg:flex flex-col fixed left-0 top-0 h-full z-40 transition-all duration-300 border-r ${
        theme.border.default
      } ${theme.bg.sidebar} ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`h-16 flex items-center justify-between px-4 border-b ${theme.border.default}`}>
        {!collapsed && (
          <Link href={basePath} className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-[#FF0099] rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              Y
            </div>
            <span className={`font-bold text-sm truncate ${theme.text.primary}`}>
              {portalName}
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-[#FF0099] rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto">
            Y
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
              : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
          } ${collapsed ? 'mx-auto mt-2' : 'flex-shrink-0'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Header Extra (e.g., parent child selector) */}
      {!collapsed && headerExtra && (
        <div className={`border-b ${theme.border.default}`}>
          {headerExtra}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={group.label || gi} className={gi > 0 ? 'mt-4' : ''}>
            {/* Group label */}
            {!collapsed && group.label && (
              <p className={`px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${theme.text.tertiary}`}>
                {group.label}
              </p>
            )}
            {collapsed && gi > 0 && (
              <div className={`mx-4 my-2 border-t ${theme.border.subtle}`} />
            )}

            {/* Items */}
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`relative flex items-center gap-3 h-11 rounded-lg transition-colors ${
                      collapsed ? 'justify-center px-0' : 'px-3'
                    } ${
                      active
                        ? `${theme.nav.activeBg} ${theme.nav.activeText}`
                        : `${theme.nav.inactiveText} ${theme.nav.hoverBg}`
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator */}
                    {active && (
                      <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full ${theme.nav.activeIndicator}`} />
                    )}
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="text-sm truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge != null && item.badge > 0 && (
                      <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full ${theme.badge.bg} ${theme.badge.text}`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer - User Profile */}
      <div className={`border-t ${theme.border.default} p-3`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-1'}`}>
          {userAvatar || (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
              isDark
                ? 'bg-white/10 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}>
              {userName?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${theme.text.primary}`}>
                  {userName || 'User'}
                </p>
                {userEmail && (
                  <p className={`text-xs truncate ${theme.text.tertiary}`}>{userEmail}</p>
                )}
              </div>
              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    isDark
                      ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20'
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
