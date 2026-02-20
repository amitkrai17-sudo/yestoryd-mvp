'use client';

import {
  CheckCircle, Loader2, AlertTriangle,
  BarChart3,
} from 'lucide-react';

interface StruggleArea {
  skill: string;
  sessions_struggling?: number;
  severity?: string;
}

interface SkillProgressCardProps {
  masteredSkills: string[];
  activeSkills: string[];
  struggleAreas: StruggleArea[];
  childName: string;
}

function formatSkillTag(tag: string): string {
  return tag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

const SEVERITY_CONFIG: Record<string, { color: string; bgColor: string }> = {
  mild: { color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' },
  moderate: { color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30' },
  severe: { color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' },
};

export default function SkillProgressCard({
  masteredSkills,
  activeSkills,
  struggleAreas,
  childName,
}: SkillProgressCardProps) {
  const hasAnyData = masteredSkills.length > 0 || activeSkills.length > 0 || struggleAreas.length > 0;
  if (!hasAnyData) return null;

  return (
    <div className="bg-surface-1 rounded-2xl border border-[#7b008b]/20
                    shadow-lg shadow-black/20 overflow-hidden w-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.08]">
        <h2 className="font-semibold text-white flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5 text-[#FF0099]" />
          {childName}&apos;s Skills
        </h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Mastered Skills */}
        {masteredSkills.length > 0 && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium mb-2">
              Mastered
            </p>
            <div className="flex flex-wrap gap-2">
              {masteredSkills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                           bg-green-500/15 text-green-400 border border-green-500/25"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {formatSkillTag(skill)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Active Skills */}
        {activeSkills.length > 0 && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium mb-2">
              Working On
            </p>
            <div className="flex flex-wrap gap-2">
              {activeSkills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                           bg-blue-500/15 text-blue-400 border border-blue-500/25"
                >
                  <Loader2 className="w-3.5 h-3.5" />
                  {formatSkillTag(skill)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Struggle Areas */}
        {struggleAreas.length > 0 && (
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wide font-medium mb-2">
              Needs Extra Practice
            </p>
            <div className="flex flex-wrap gap-2">
              {struggleAreas.map((area, i) => {
                const severity = SEVERITY_CONFIG[area.severity || 'mild'] || SEVERITY_CONFIG.mild;
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             ${severity.bgColor} ${severity.color} border`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {formatSkillTag(area.skill)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
