'use client';

import Link from 'next/link';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

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
      <a
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-6 z-30 bg-surface-1/80 backdrop-blur-sm p-3.5 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center gap-2 group"
        aria-label="Chat on WhatsApp"
      >
        <WhatsAppIcon className="w-7 h-7 text-[#25D366]" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out text-[#25D366] font-bold whitespace-nowrap text-sm">
          {whatsappHoverText}
        </span>
      </a>

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
