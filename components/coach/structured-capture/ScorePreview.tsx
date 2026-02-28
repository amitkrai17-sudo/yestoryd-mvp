// ============================================================
// ScorePreview — Circular score gauge with 5-signal breakdown
// ============================================================

'use client';

import { Check, X } from 'lucide-react';
import { DEFAULT_WEIGHTS } from '@/lib/intelligence/score';

interface ScorePreviewProps {
  score: number;
  signals: {
    hasSkills: boolean;
    hasPerformance: boolean;
    hasArtifact: boolean;
    hasObservations: boolean;
    hasEngagement: boolean;
  };
  size?: 'sm' | 'md';
}

const SIGNAL_LABELS = [
  { key: 'hasSkills', label: 'Skills Covered', weight: DEFAULT_WEIGHTS.skillCoverage },
  { key: 'hasPerformance', label: 'Performance Ratings', weight: DEFAULT_WEIGHTS.performance },
  { key: 'hasArtifact', label: 'Child Artifact', weight: DEFAULT_WEIGHTS.childArtifact },
  { key: 'hasObservations', label: 'Observations', weight: DEFAULT_WEIGHTS.observations },
  { key: 'hasEngagement', label: 'Engagement Level', weight: DEFAULT_WEIGHTS.engagement },
] as const;

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 55) return '#eab308'; // yellow
  if (score >= 30) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function ScorePreview({ score, signals, size = 'md' }: ScorePreviewProps) {
  const isSm = size === 'sm';
  const radius = isSm ? 36 : 48;
  const stroke = isSm ? 5 : 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (radius + stroke) * 2;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Circular gauge */}
      <div className="relative">
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-white/10"
          />
          {/* Score arc */}
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold transition-colors duration-500"
            style={{ color, fontSize: isSm ? '1.25rem' : '1.75rem', lineHeight: 1 }}
          >
            {score}
          </span>
          <span className="text-text-tertiary" style={{ fontSize: isSm ? '0.625rem' : '0.7rem' }}>
            / 100
          </span>
        </div>
      </div>

      {/* Signal breakdown */}
      <div className={`w-full space-y-1.5 ${isSm ? 'text-[10px]' : 'text-xs'}`}>
        {SIGNAL_LABELS.map(({ key, label, weight }) => {
          const active = signals[key as keyof typeof signals];
          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {active ? (
                  <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                ) : (
                  <X className="w-3 h-3 text-text-tertiary flex-shrink-0" />
                )}
                <span className={active ? 'text-white' : 'text-text-tertiary'}>{label}</span>
              </div>
              <span className={active ? 'text-green-400' : 'text-text-tertiary'}>
                +{Math.round(weight * 100)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
