'use client';

import { BookOpen, Zap, TrendingUp, MessageSquare } from 'lucide-react';

interface SkillScore {
  score: number;
  notes: string;
}

interface SkillBarProps {
  skill: string;
  data: SkillScore;
}

const SKILL_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  decoding: { icon: <BookOpen className="w-4 h-4" />, label: 'Decoding' },
  sight_words: { icon: <Zap className="w-4 h-4" />, label: 'Sight Words' },
  blending: { icon: <TrendingUp className="w-4 h-4" />, label: 'Blending' },
  expression: { icon: <MessageSquare className="w-4 h-4" />, label: 'Expression' },
};

export function SkillBar({ skill, data }: SkillBarProps) {
  const config = SKILL_CONFIG[skill];
  if (!config || !data) return null;

  const pct = (data.score / 10) * 100;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[#FF0099]">{config.icon}</span>
          <span className="text-text-secondary text-sm font-medium">{config.label}</span>
        </div>
        <span className="text-white font-bold text-sm">{data.score}/10</span>
      </div>
      <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FF0099] to-[#00ABFF] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {data.notes && <p className="text-text-tertiary text-xs mt-1.5 break-words">{data.notes}</p>}
    </div>
  );
}
