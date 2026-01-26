'use client';

import Link from 'next/link';
import { ArrowRight, MessageCircle, Shield, Clock, TrendingUp } from 'lucide-react';

interface CtaSectionProps {
  titleLine1: string;
  titleLine2: string;
  description: string;
  subdescription: string;
  urgencyText: string;
  whatsappButtonText: string;
  whatsappNumber: string;
  whatsappMessage: string;
  onCTAClick: () => void;
}

export function CtaSection({
  titleLine1,
  titleLine2,
  description,
  subdescription,
  urgencyText,
  whatsappButtonText,
  whatsappNumber,
  whatsappMessage,
  onCTAClick,
}: CtaSectionProps) {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-[#e6008a] to-[#7b008b] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
          {titleLine1}
          <br />
          <span className="text-[#ffde00]">{titleLine2}</span>
        </h2>

        <p className="text-lg sm:text-xl text-white/80 mb-4 max-w-2xl mx-auto">
          {description.includes('87% of parents') ? (
            <>
              <span className="text-white font-bold">87% of parents</span> finally understood WHY their child struggled — after just one 5-minute assessment.
            </>
          ) : description}
        </p>

        <p className="text-base text-white/60 mb-10 max-w-xl mx-auto">
          {subdescription}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/assessment"
            onClick={onCTAClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[#e6008a] px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
          >
            Reading Test - Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#25d366] text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-[#20bd5a] transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            {whatsappButtonText}
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-white/60 text-sm">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            100% Free
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            5 Minutes Only
          </span>
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Instant Results
          </span>
        </div>

        {/* Urgency note */}
        <p className="mt-8 text-xs text-white/50">
          {urgencyText}
        </p>
      </div>
    </section>
  );
}
