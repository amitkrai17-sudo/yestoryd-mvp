'use client';

import PortalLayout from '@/components/shared/layout/PortalLayout';

interface CoachLayoutProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: React.ReactNode;
  chatWidget?: React.ReactNode;
  // Legacy props from page-level usage (accepted but ignored)
  noPadding?: boolean;
  maxWidth?: string;
  showMobileBack?: boolean;
  mobileBackHref?: string;
  mobileTitle?: string;
  mobileHeaderRight?: React.ReactNode;
  hideMobileHeader?: boolean;
  hideBottomNav?: boolean;
}

export default function CoachLayout({
  children,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
  chatWidget,
}: CoachLayoutProps) {
  // If called without onSignOut, this is page-level usage (redundant wrapper)
  // since app/coach/layout.tsx already provides the full layout chrome.
  // Just render children directly to avoid double sidebar/nav.
  if (!onSignOut) {
    return <>{children}</>;
  }

  return (
    <PortalLayout
      portal="coach"
      onSignOut={onSignOut}
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      chatWidget={chatWidget}
    >
      {children}
    </PortalLayout>
  );
}
