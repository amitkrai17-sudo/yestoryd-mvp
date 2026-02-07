'use client';

import { CheckCircle, Brain, Heart, Eye } from 'lucide-react';

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
      <div className="bg-gray-800/50 rounded-3xl shadow-xl border border-gray-700 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white text-center py-3 px-4">
          <p className="font-bold text-sm sm:text-base">{header}</p>
        </div>

        {/* Before/After Grid */}
        <div className="grid grid-cols-2 divide-x divide-border-subtle">

          {/* BEFORE Column */}
          <div className="p-4 sm:p-5">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 text-center">Before</p>
            <div className="space-y-2.5">
              {beforeItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20"
                >
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-text-secondary leading-tight">
                    {typeof item === 'string' ? item : (item as any)?.title || (item as any)?.description || 'Item'}
                  </span>
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
                  <span className="text-xs sm:text-sm text-text-secondary font-medium leading-tight">
                    {typeof item === 'string' ? item : (item as any)?.title || (item as any)?.description || 'Item'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom CTA hint - Icons with text */}
        <div className="bg-gradient-to-r from-[#00ABFF]/10 to-[#ff0099]/10 px-4 py-3 border-t border-border-subtle">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-[#00ABFF]" />
              <span className="text-[#00ABFF]">rAI finds the gaps</span>
            </span>
            <span className="hidden sm:inline text-text-tertiary">•</span>
            <span className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-[#ff0099]" />
              <span className="text-[#ff0099]">Coach fills them</span>
            </span>
            <span className="hidden sm:inline text-text-tertiary">•</span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-green-400" />
              <span className="text-green-400">You see progress</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
