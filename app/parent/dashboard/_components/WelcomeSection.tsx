'use client';

import { BookOpen, Rocket, Star, TrendingUp } from 'lucide-react';

interface WelcomeSectionProps {
  parentName: string;
  childName: string;
  enrollmentType: 'starter' | 'continuation' | 'full' | null | undefined;
}

const ENROLLMENT_TYPE_INFO = {
  starter: { label: 'Starter Pack', color: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Rocket },
  continuation: { label: 'Continuation', color: 'bg-purple-50 text-purple-700 border-purple-200', Icon: TrendingUp },
  full: { label: 'Full Program', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: Star },
  default: { label: 'Program', color: 'bg-gray-50 text-gray-600 border-gray-200', Icon: BookOpen },
} as const;

export default function WelcomeSection({ parentName, childName, enrollmentType }: WelcomeSectionProps) {
  const typeInfo = enrollmentType && enrollmentType in ENROLLMENT_TYPE_INFO
    ? ENROLLMENT_TYPE_INFO[enrollmentType]
    : ENROLLMENT_TYPE_INFO.default;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <div className="bg-gradient-to-r from-pink-50/50 to-white rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-gray-600 text-sm">
            {greeting}, {parentName ? parentName.split(' ')[0] : 'there'}
          </p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">
            {childName}&apos;s Learning Journey
          </h1>
        </div>
        {enrollmentType && (
          <span className={`px-4 py-2 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 whitespace-nowrap ${typeInfo.color}`}>
            <typeInfo.Icon className="w-4 h-4 flex-shrink-0" />
            {typeInfo.label}
          </span>
        )}
      </div>
    </div>
  );
}
