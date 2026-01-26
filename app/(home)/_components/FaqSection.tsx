'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  items: FaqItem[];
  stillQuestionsText: string;
  whatsappCtaText: string;
  whatsappNumber: string;
}

export function FaqSection({
  badge,
  title,
  subtitle,
  items,
  stillQuestionsText,
  whatsappCtaText,
  whatsappNumber,
}: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 lg:py-24 bg-surface-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-[#00ABFF] uppercase tracking-wider mb-4">
            {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-lg text-text-secondary">
            {subtitle}
          </p>
        </div>

        <div className="space-y-4">
          {items.map((faq, index) => (
            <div
              key={index}
              className="bg-surface-2 rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
              >
                <span className="font-semibold text-white text-base sm:text-lg">
                  {faq.question}
                </span>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  openIndex === index
                    ? 'bg-[#ff0099] text-white rotate-180'
                    : 'bg-surface-3 text-text-tertiary'
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-text-secondary leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-10 text-center">
          <p className="text-text-secondary mb-4">{stillQuestionsText}</p>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi! I have a question about Yestoryd.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#25d366] font-semibold hover:underline"
          >
            <MessageCircle className="w-5 h-5" />
            {whatsappCtaText}
          </a>
        </div>
      </div>
    </section>
  );
}
