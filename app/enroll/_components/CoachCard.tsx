'use client';

import { Sparkles, Star } from 'lucide-react';

interface CoachSettings {
  name: string;
  title: string;
  rating: string;
  experience: string;
  families: string;
  initial: string;
}

interface CoachCardProps {
  coach: CoachSettings;
}

export function CoachCard({ coach }: CoachCardProps) {
  return (
    <section className="bg-surface-1 rounded-2xl p-5 border border-border">
      <h2 className="flex items-center gap-2 text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">
        <Sparkles className="w-4 h-4 text-[#FF0099]" />
        Your Reading Coach
      </h2>
      <div className="flex items-center gap-4 mb-3">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FF0099] to-[#FF0099]/70 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {coach.initial}
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Coach {coach.name}</h3>
          <p className="text-[#FF0099] font-medium text-sm">{coach.title}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span className="font-semibold">{coach.rating}</span>
        </span>
        <span>{coach.experience}</span>
        <span>{coach.families}</span>
      </div>
    </section>
  );
}
