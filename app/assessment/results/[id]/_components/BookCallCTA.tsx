'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';

interface BookCallCTAProps {
  childId: string;
  childName: string;
  score: number;
}

export function BookCallCTA({ childId, childName, score }: BookCallCTAProps) {
  const bookCallUrl = `/lets-talk?childId=${childId}&childName=${encodeURIComponent(childName)}&score=${score}&source=results_cta`;

  return (
    <div className="rounded-2xl border border-[#FF0099]/20 bg-gradient-to-r from-[#FF0099]/10 to-[#7B008B]/10 p-4 md:p-5 print:hidden">
      <div className="text-center">
        <h3 className="text-base md:text-lg font-semibold text-white mb-2 break-words">
          Want to improve {childName}&apos;s reading?
        </h3>
        <p className="text-text-secondary text-sm mb-4">
          Book a FREE 15-minute call with our reading coach to discuss these results and create a personalized improvement plan.
        </p>
        <Link
          href={bookCallUrl}
          className="inline-flex items-center justify-center gap-2 w-full md:w-auto min-h-[44px] px-6 py-3 rounded-full bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold transition-all shadow-lg shadow-black/25"
        >
          <Calendar className="w-5 h-5" />
          Book FREE Call
        </Link>
      </div>
    </div>
  );
}
