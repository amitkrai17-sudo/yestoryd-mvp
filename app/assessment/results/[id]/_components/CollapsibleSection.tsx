'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-surface-1 shadow-lg shadow-black/25 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-2 transition-colors min-h-[44px]"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#FF0099]">{icon}</span>
          <span className="text-white font-semibold">{title}</span>
          {badge && (
            <span className="rounded-full px-3 py-1 bg-[#FF0099]/20 text-[#FF0099] text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-text-tertiary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-text-tertiary" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
