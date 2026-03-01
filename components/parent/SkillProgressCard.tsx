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
  mild: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  moderate: { color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  severe: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
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
    <div className="bg-white rounded-2xl border border-gray-100
                    shadow-sm overflow-hidden w-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5 text-[#FF0099]" />
          {childName}&apos;s Skills
        </h2>
      </div>

      <div className="p-5 space-y-4">
        {/* Mastered Skills */}
        {masteredSkills.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
              Mastered
            </p>
            <div className="flex flex-wrap gap-2">
              {masteredSkills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                           bg-emerald-50 text-emerald-700 border border-emerald-200"
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
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
              Working On
            </p>
            <div className="flex flex-wrap gap-2">
              {activeSkills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                           bg-blue-50 text-blue-700 border border-blue-200"
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
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
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
