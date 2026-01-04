'use client';

import { CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const PROMISES = [
  {
    text: 'Read a book one grade level higher — without pausing',
    icon: '📖',
  },
  {
    text: 'Volunteer to read aloud in class',
    icon: '🙋',
  },
  {
    text: 'Pick up books for fun, not just homework',
    icon: '📚',
  },
  {
    text: 'Explain stories confidently in their own words',
    icon: '💬',
  },
];

interface NinetyDayPromiseProps {
  ctaHref?: string;
  ctaText?: string;
  variant?: 'default' | 'compact';
}

export default function NinetyDayPromise({
  ctaHref = '/assessment',
  ctaText = 'Start Free Assessment',
  variant = 'default',
}: NinetyDayPromiseProps) {
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-[#fff5fa] to-[#f0f9ff] rounded-2xl p-6 border border-pink-100">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          In <span className="text-[#ff0099]">90 days</span>, your child will:
        </h3>
        <ul className="space-y-2 mb-4">
          {PROMISES.map((promise, index) => (
            <li key={index} className="flex items-center gap-2 text-gray-700">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">{promise.text}</span>
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 text-[#ff0099] font-semibold hover:underline"
        >
          {ctaText}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <section className="py-16 sm:py-20 px-4 bg-gradient-to-br from-[#fff5fa] via-white to-[#f0f9ff]">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1 bg-[#ff0099]/10 text-[#ff0099] text-sm font-semibold rounded-full mb-4">
            THE YESTORYD FLUENCY ARC™
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Where will your child be in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff0099] to-[#7b008b]">
              90 days
            </span>
            ?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            After completing just 9 sessions with our certified coaches, 
            parents consistently report these transformations:
          </p>
        </div>

        {/* Promise Cards */}
        <div className="grid gap-6 sm:grid-cols-2 mb-12">
          {PROMISES.map((promise, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#ff0099]/20 transition-all duration-300"
            >
              {/* Number badge */}
              <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                {index + 1}
              </div>
              
              <div className="flex items-start gap-4 ml-4">
                <span className="text-3xl">{promise.icon}</span>
                <div>
                  <p className="text-gray-800 font-medium text-lg">
                    {promise.text}
                  </p>
                </div>
              </div>

              {/* Checkmark on hover */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-16 mb-12 py-6 border-y border-gray-200">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-[#ff0099]">500+</div>
            <div className="text-sm text-gray-600">Children Transformed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-[#7b008b]">9</div>
            <div className="text-sm text-gray-600">Sessions Only</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-[#00abff]">90</div>
            <div className="text-sm text-gray-600">Days to Confidence</div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            {ctaText}
            <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Free 5-minute assessment • No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}
