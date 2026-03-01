'use client';

import PortalLayout from '@/components/shared/layout/PortalLayout';

interface ParentLayoutProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
  chatWidget?: React.ReactNode;
}

export default function ParentLayout({
  children,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
  sidebarExtra,
  chatWidget,
}: ParentLayoutProps) {
  // If called without onSignOut, this is page-level usage (redundant wrapper)
  // since app/parent/layout.tsx already provides the full layout chrome.
  if (!onSignOut) {
    return <>{children}</>;
  }

  return (
    <PortalLayout
      portal="parent"
      onSignOut={onSignOut}
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      sidebarExtra={sidebarExtra}
      chatWidget={chatWidget}
    >
      {children}
    </PortalLayout>
  );
}
