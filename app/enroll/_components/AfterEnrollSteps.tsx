'use client';

import { ArrowRight } from 'lucide-react';

interface AfterEnrollStepsProps {
  coachName: string;
}

export function AfterEnrollSteps({ coachName }: AfterEnrollStepsProps) {
  const steps = [
    'Confirmation email with receipt (instant)',
    `Coach ${coachName} WhatsApps to introduce herself`,
    'Calendar invites for all sessions',
    'First session within 3-5 days',
  ];

  return (
    <section className="hidden lg:block bg-blue-500/10 rounded-2xl p-5 border border-blue-500/20">
      <h3 className="font-semibold text-white flex items-center gap-2 mb-4 text-sm">
        <ArrowRight className="w-4 h-4 text-blue-400" />
        After You Enroll
      </h3>
      <ol className="space-y-2.5 text-xs text-text-secondary">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
