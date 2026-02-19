'use client';

import type { TrackedActivity } from './types';

interface ProgressBarProps {
  activities: TrackedActivity[];
  currentIndex: number;
}

export default function ProgressBar({ activities, currentIndex }: ProgressBarProps) {
  if (activities.length === 0) return null;

  return (
    <div className="flex gap-1 w-full">
      {activities.map((activity, i) => {
        let bg = 'bg-white/10'; // future
        if (i < currentIndex || activity.status) {
          switch (activity.status) {
            case 'completed': bg = 'bg-green-500'; break;
            case 'partial': bg = 'bg-amber-500'; break;
            case 'skipped': bg = 'bg-white/20'; break;
            case 'struggled': bg = 'bg-red-500'; break;
            default: bg = 'bg-white/10';
          }
        } else if (i === currentIndex) {
          bg = 'bg-[#00ABFF] animate-pulse';
        }

        return (
          <div
            key={i}
            className={`h-1.5 rounded-full flex-1 transition-colors duration-300 ${bg}`}
          />
        );
      })}
    </div>
  );
}
