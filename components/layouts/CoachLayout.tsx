'use client';

import PortalLayout from '@/components/shared/layout/PortalLayout';

interface CoachLayoutProps {
  children: React.ReactNode;
  mobileTitle?: string;
  showMobileBack?: boolean;
  mobileBackHref?: string;
  mobileHeaderRight?: React.ReactNode;
  hideMobileHeader?: boolean;
  hideBottomNav?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '7xl' | 'full';
  noPadding?: boolean;
}

export default function CoachLayout({
  children,
  ...props
}: CoachLayoutProps) {
  return (
    <PortalLayout portal="coach" {...props}>
      {children}
    </PortalLayout>
  );
}
