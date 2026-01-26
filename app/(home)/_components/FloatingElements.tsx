'use client';

import Link from 'next/link';
import Image from 'next/image';

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
        className="fixed bottom-20 sm:bottom-6 right-6 z-30 bg-[#25d366] p-3 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 flex items-center gap-2 group"
      >
        <Image src="/images/rai-mascot.png" alt="Chat" width={40} height={40} className="w-8 h-8 rounded-full" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out text-white font-bold whitespace-nowrap text-sm">
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
          className="block w-full text-center bg-[#FF0099] text-white py-3 rounded-xl font-bold shadow-lg text-sm hover:bg-[#e6008a]"
        >
          {stickyCtaText}
        </Link>
      </div>
    </>
  );
}
