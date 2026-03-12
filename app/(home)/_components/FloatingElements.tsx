'use client';

import Link from 'next/link';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';

interface FloatingElementsProps {
  whatsappNumber: string;
  whatsappMessage: string;
  whatsappHoverText: string;
  stickyCtaText: string;
  showStickyCta: boolean;
  onCTAClick: () => void;
}

export function FloatingElements({
  whatsappNumber,
  whatsappMessage,
  whatsappHoverText,
  stickyCtaText,
  showStickyCta,
  onCTAClick,
}: FloatingElementsProps) {
  return (
    <>
      {/* Floating WhatsApp Button */}
      <WhatsAppButton
        phone={whatsappNumber}
        message={whatsappMessage}
        variant="icon-only"
        className="fixed bottom-20 sm:bottom-6 right-6 z-30 rounded-full"
      />

      {/* Sticky Mobile CTA (Shows after hero) */}
      <div className={`fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-border p-3 sm:hidden z-30 transition-transform duration-300 ${
        showStickyCta ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <Link
          href="/assessment"
          onClick={onCTAClick}
          className="block w-full min-h-[44px] text-center bg-[#FF0099] text-white px-6 py-3 rounded-xl font-bold shadow-lg text-sm hover:bg-[#FF0099]/90 transition-all"
        >
          {stickyCtaText}
        </Link>
      </div>
    </>
  );
}
