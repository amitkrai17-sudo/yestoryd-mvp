'use client';

import { MessageCircle } from 'lucide-react';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

/**
 * Build a WhatsApp deep link URL with optional pre-filled message.
 * Use instead of hand-rolling `https://wa.me/${phone}?text=${encodeURIComponent(...)}`.
 */
export function getWhatsAppHref(message?: string, phone: string = COMPANY_CONFIG.leadBotWhatsApp): string {
  const encoded = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${phone}${encoded ? `?text=${encoded}` : ''}`;
}

interface WhatsAppButtonProps {
  phone?: string;
  message?: string;
  label?: string;
  variant?: 'button' | 'link' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: { button: 'h-9 px-3 text-sm gap-1.5', icon: 'w-4 h-4', iconOnly: 'w-9 h-9' },
  md: { button: 'h-10 px-4 text-sm gap-2', icon: 'w-4 h-4', iconOnly: 'w-10 h-10' },
  lg: { button: 'h-12 px-5 text-base gap-2', icon: 'w-5 h-5', iconOnly: 'w-12 h-12' },
};

export function WhatsAppButton({
  phone = COMPANY_CONFIG.leadBotWhatsApp,
  message,
  label = 'Chat on WhatsApp',
  variant = 'button',
  size = 'md',
  className = '',
}: WhatsAppButtonProps) {
  const href = getWhatsAppHref(message, phone);
  const sizeClasses = SIZE_CLASSES[size];

  if (variant === 'icon-only') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center ${sizeClasses.iconOnly} rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white transition-colors ${className}`}
      >
        <MessageCircle className={sizeClasses.icon} />
      </a>
    );
  }

  if (variant === 'link') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-[#25D366] hover:text-[#20bd5a] font-medium transition-colors ${className}`}
      >
        <MessageCircle className={sizeClasses.icon} />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center ${sizeClasses.button} rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold transition-colors ${className}`}
    >
      <MessageCircle className={sizeClasses.icon} />
      {label}
    </a>
  );
}
