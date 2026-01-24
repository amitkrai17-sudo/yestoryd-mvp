'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if running on iOS (doesn't support beforeinstallprompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      // On iOS, we could show a manual instruction banner
      // For now, we'll skip the prompt on iOS
      return;
    }

    // Check if user dismissed recently (within 7 days)
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a slight delay for better UX
      setTimeout(() => setShow(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] App installed');
    } else {
      console.log('[PWA] Install dismissed');
    }

    setDeferredPrompt(null);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-dismissed', Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:bottom-4 lg:left-auto lg:right-4 lg:w-80 bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 shadow-xl z-[60] animate-in slide-in-from-bottom-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF0099] to-[#7B008B] flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm">Install Yestoryd</h3>
          <p className="text-xs text-gray-400 mt-0.5">Quick access from your home screen</p>
        </div>
      </div>

      <button
        onClick={handleInstall}
        className="w-full mt-3 py-2.5 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Install App
      </button>
    </div>
  );
}
