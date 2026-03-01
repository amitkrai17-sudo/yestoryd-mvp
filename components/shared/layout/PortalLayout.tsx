'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { ThemeProvider, usePortalTheme } from '@/components/providers/ThemeProvider';
import { PortalType, getNavConfig } from '@/components/config/navigation';
import BottomNav from '@/components/shared/navigation/BottomNav';
import Sidebar from '@/components/shared/navigation/Sidebar';

interface PortalLayoutProps {
  children: React.ReactNode;
  portal: PortalType;
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: React.ReactNode;
  sidebarExtra?: React.ReactNode;  // For parent child selector
  chatWidget?: React.ReactNode;    // ChatWidget component instance
}

function PortalLayoutInner({
  children,
  portal,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
  sidebarExtra,
  chatWidget,
}: PortalLayoutProps) {
  const pathname = usePathname();
  const { theme } = usePortalTheme();
  const config = getNavConfig(portal);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={`min-h-screen ${theme.bg.page}`}>
      {/* Desktop Sidebar */}
      <Sidebar
        items={config.sidebar}
        basePath={config.basePath}
        portalName={config.portalName}
        onSignOut={onSignOut}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        headerExtra={sidebarExtra}
      />

      {/* Mobile sidebar (slide-over) */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-in-out border-r ${
          theme.border.default
        } ${theme.bg.sidebar} ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile sidebar header */}
        <div className={`h-16 flex items-center justify-between px-4 border-b ${theme.border.default}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF0099] rounded-lg flex items-center justify-center text-white font-bold text-sm">
              Y
            </div>
            <span className={`font-bold text-sm ${theme.text.primary}`}>
              {config.portalName}
            </span>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className={`p-2 rounded-lg ${
              theme.mode === 'dark'
                ? 'hover:bg-white/[0.05] text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile sidebar extra (child selector for parent) */}
        {sidebarExtra && (
          <div className={`border-b ${theme.border.default}`}>
            {sidebarExtra}
          </div>
        )}

        {/* Mobile sidebar nav */}
        <nav className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {config.sidebar.map((item) => {
            const active = (() => {
              const href = item.href;
              if (href === config.basePath || href === `${config.basePath}/dashboard`) {
                return pathname === href || pathname === config.basePath || pathname === `${config.basePath}/dashboard`;
              }
              return pathname.startsWith(href);
            })();
            const Icon = item.icon;

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 h-11 rounded-lg transition-colors ${
                  active
                    ? `${theme.nav.activeBg} ${theme.nav.activeText}`
                    : `${theme.nav.inactiveText} ${theme.nav.hoverBg}`
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm truncate">{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Mobile sidebar footer */}
        {onSignOut && (
          <div className={`absolute bottom-0 left-0 right-0 p-3 border-t ${theme.border.default} ${theme.bg.sidebar}`}>
            <div className="flex items-center gap-3 px-1">
              {userAvatar || (
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                  theme.mode === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {userName?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${theme.text.primary}`}>{userName || 'User'}</p>
                {userEmail && (
                  <p className={`text-xs truncate ${theme.text.tertiary}`}>{userEmail}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile hamburger button (tablet only — mobile uses bottom nav) */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className={`hidden md:flex lg:hidden fixed top-4 left-4 z-40 p-3 rounded-xl shadow-lg border min-w-[48px] min-h-[48px] items-center justify-center ${
          theme.mode === 'dark'
            ? 'bg-[#121217] border-white/[0.08]'
            : 'bg-white border-gray-200 shadow-gray-200/50'
        }`}
        aria-label="Open menu"
      >
        <Menu className={`w-6 h-6 ${theme.mode === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
      </button>

      {/* Main Content */}
      <main className="lg:ml-64 pb-20 lg:pb-0 min-h-screen">
        <div className="px-4 lg:px-6 py-4 lg:py-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav items={config.bottomNav} basePath={config.basePath} />

      {/* Chat Widget — renders its own fixed positioning */}
      {chatWidget}
    </div>
  );
}

export default function PortalLayout(props: PortalLayoutProps) {
  return (
    <ThemeProvider portal={props.portal}>
      <PortalLayoutInner {...props} />
    </ThemeProvider>
  );
}
