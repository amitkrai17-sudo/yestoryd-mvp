'use client';

import { PortalType, getNavConfig } from '@/components/config/navigation';
import BottomNav from '@/components/shared/navigation/BottomNav';
import Sidebar from '@/components/shared/navigation/Sidebar';
import MobileHeader from '@/components/shared/navigation/MobileHeader';

interface PortalLayoutProps {
  children: React.ReactNode;
  portal: PortalType;

  // Mobile header options
  mobileTitle?: string;
  showMobileBack?: boolean;
  mobileBackHref?: string;
  mobileHeaderRight?: React.ReactNode;

  // Layout options
  hideMobileHeader?: boolean;
  hideBottomNav?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '7xl' | 'full';
  noPadding?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

export default function PortalLayout({
  children,
  portal,
  mobileTitle,
  showMobileBack = false,
  mobileBackHref,
  mobileHeaderRight,
  hideMobileHeader = false,
  hideBottomNav = false,
  maxWidth = '4xl',
  noPadding = false,
}: PortalLayoutProps) {
  const config = getNavConfig(portal);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Desktop Sidebar */}
      <Sidebar
        items={config.sidebar}
        basePath={config.basePath}
        portalName={config.portalName}
      />

      {/* Mobile Header */}
      {!hideMobileHeader && (mobileTitle || showMobileBack) && (
        <MobileHeader
          title={mobileTitle}
          showBack={showMobileBack}
          backHref={mobileBackHref}
          rightContent={mobileHeaderRight}
        />
      )}

      {/* Main Content */}
      <main
        className={`
          lg:pl-56
          ${!hideBottomNav ? 'pb-20' : ''}
          lg:pb-0
        `}
      >
        {noPadding ? (
          children
        ) : (
          <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 py-4`}>
            {children}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      {!hideBottomNav && (
        <BottomNav items={config.bottomNav} basePath={config.basePath} />
      )}
    </div>
  );
}
