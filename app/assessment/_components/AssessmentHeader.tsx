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
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-3 bg-pink-100 text-pink-600">
        <Sparkles className="w-4 h-4" />
        {badge}
      </div>
      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">
        {title}
      </h1>
      <p className="text-gray-500 text-sm md:text-base">
        {subtitle}
      </p>
    </div>
  );
}
