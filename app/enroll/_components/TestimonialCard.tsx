'use client';

import { Star } from 'lucide-react';

interface TestimonialCardProps {
  quote?: string;
  author?: string;
}

export function TestimonialCard({
  quote = "Amazing transformation! Aarav went from struggling to reading confidently in just 2 months.",
  author = "Priya S., Mumbai",
}: TestimonialCardProps) {
  return (
    <section className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-5 border border-amber-500/20">
      <div className="flex gap-0.5 mb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
        ))}
      </div>
      <blockquote className="text-text-secondary italic text-sm mb-3">
        &quot;{quote}&quot;
      </blockquote>
      <cite className="text-sm font-semibold text-white not-italic">
        — {author}
      </cite>
    </section>
  );
}
