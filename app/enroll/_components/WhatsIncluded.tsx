'use client';

import { Check, Gift } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  text: string;
}

interface WhatsIncludedProps {
  features: Feature[];
}

export function WhatsIncluded({ features }: WhatsIncludedProps) {
  return (
    <section className="bg-surface-1 rounded-2xl p-5 border border-border">
      <h2 className="font-semibold text-white flex items-center gap-2 mb-4 text-sm">
        <Gift className="w-4 h-4 text-[#FF0099]" />
        What&apos;s Included
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-text-secondary text-xs leading-tight">{feature.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
