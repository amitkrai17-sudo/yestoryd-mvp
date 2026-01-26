'use client';

import { User, Mic, Award, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Step {
  num: number;
  label: string;
  icon: LucideIcon;
}

interface ProgressStepperProps {
  currentStep: number;
  colors: { pink: string; purple: string };
}

const STEPS: Step[] = [
  { num: 1, label: 'Details', icon: User },
  { num: 2, label: 'Record', icon: Mic },
  { num: 3, label: 'Results', icon: Award },
];

export function ProgressStepper({ currentStep, colors }: ProgressStepperProps) {
  return (
    <div className="max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step) => (
          <div key={step.num} className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                currentStep >= step.num
                  ? 'text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400'
              }`}
              style={
                currentStep >= step.num
                  ? { background: `linear-gradient(135deg, ${colors.pink}, ${colors.purple})` }
                  : undefined
              }
            >
              {currentStep > step.num ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <step.icon className="w-5 h-5" />
              )}
            </div>
            <span
              className={`text-xs mt-2 font-medium ${
                currentStep >= step.num ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress line */}
      <div className="relative mt-[-28px] mx-12 h-1 bg-gray-200 rounded-full">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`,
            background: `linear-gradient(135deg, ${colors.pink}, ${colors.purple})`,
          }}
        />
      </div>
    </div>
  );
}
