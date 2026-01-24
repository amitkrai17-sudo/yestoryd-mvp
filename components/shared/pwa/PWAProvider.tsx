'use client';

import { useServiceWorker } from '@/hooks/useServiceWorker';
import InstallPrompt from './InstallPrompt';

interface PWAProviderProps {
  children: React.ReactNode;
}

export default function PWAProvider({ children }: PWAProviderProps) {
  // Register service worker
  useServiceWorker();

  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
