'use client';

import { Sparkles } from 'lucide-react';

interface AssessmentHeaderProps {
  title: string;
  subtitle: string;
  badge: string;
}

export function AssessmentHeader({ title, subtitle, badge }: AssessmentHeaderProps) {
  return (
    <div className="text-center mb-6 md:mb-8">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-3 bg-[#ff0099]/20 text-[#ff0099]">
        <Sparkles className="w-4 h-4" />
        {badge}
      </div>
      <h1 className="text-xl sm:text-2xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-[#00abff] to-[#ff0099] bg-clip-text text-transparent px-4">
        {title}
      </h1>
      <p className="text-text-secondary text-sm md:text-base">
        {subtitle}
      </p>
    </div>
  );
}
