'use client';

interface ScoreStatsProps {
  clarity: number;
  fluency: number;
  speed: number;
}

export function ScoreStats({ clarity, fluency, speed }: ScoreStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 border-t border-b border-border py-4">
      <div className="text-center">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">Clarity</p>
        <p className="text-[#FF0099] text-2xl font-bold">{clarity}</p>
      </div>
      <div className="text-center border-l border-r border-border">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">Fluency</p>
        <p className="text-[#FF0099] text-2xl font-bold">{fluency}</p>
      </div>
      <div className="text-center">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">Speed</p>
        <p className="text-[#FF0099] text-2xl font-bold">{speed}</p>
      </div>
    </div>
  );
}
