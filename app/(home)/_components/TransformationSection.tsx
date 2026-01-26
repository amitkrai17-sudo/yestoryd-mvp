'use client';

import { CheckCircle } from 'lucide-react';

interface TransformationSectionProps {
  header: string;
  beforeItems: string[];
  afterItems: string[];
  tagline: string;
}

export function TransformationSection({
  header,
  beforeItems,
  afterItems,
  tagline,
}: TransformationSectionProps) {
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="bg-surface-2 rounded-3xl shadow-xl border border-border overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white text-center py-3 px-4">
          <p className="font-bold text-sm sm:text-base">{header}</p>
        </div>

        {/* Before/After Grid */}
        <div className="grid grid-cols-2 divide-x divide-border-subtle">

          {/* BEFORE Column */}
          <div className="p-4 sm:p-5">
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider mb-3 text-center">Before</p>
            <div className="space-y-2.5">
              {beforeItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20"
                >
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-text-tertiary leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AFTER Column */}
          <div className="p-4 sm:p-5 bg-green-500/5">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3 text-center">After 90 Days</p>
            <div className="space-y-2.5">
              {afterItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-green-500/10 rounded-xl px-3 py-2 border border-green-500/20"
                >
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-text-secondary font-medium leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom CTA hint */}
        <div className="bg-gradient-to-r from-[#00ABFF]/10 to-[#ff0099]/10 px-4 py-3 text-center border-t border-border-subtle">
          <p className="text-xs text-text-secondary">
            {tagline.split(' • ').map((part, i, arr) => (
              <span key={i}>
                <span className={`font-bold ${i === 0 ? 'text-[#00ABFF]' : i === 1 ? 'text-[#ff0099]' : 'text-[#7b008b]'}`}>{part}</span>
                {i < arr.length - 1 && ' • '}
              </span>
            ))}
          </p>
        </div>

      </div>
    </div>
  );
}
