'use client';

import PortalLayout from '@/components/shared/layout/PortalLayout';

interface AdminLayoutProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: React.ReactNode;
  chatWidget?: React.ReactNode;
}

export default function AdminLayout({
  children,
  onSignOut,
  userName,
  userEmail,
  userAvatar,
  chatWidget,
}: AdminLayoutProps) {
  // If called without onSignOut, this is page-level usage (redundant wrapper)
  if (!onSignOut) {
    return <>{children}</>;
  }

  return (
    <PortalLayout
      portal="admin"
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
