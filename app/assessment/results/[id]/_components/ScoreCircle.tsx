'use client';

interface ScoreCircleProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreCircle({ score, size = 'md', showLabel = true }: ScoreCircleProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-3xl',
  };

  return (
    <div className="flex items-center gap-3">
      {/* Gradient border wrapper */}
      <div className="p-[3px] rounded-full bg-gradient-to-br from-[#FF0099] to-[#00ABFF]">
        <div className={`${sizeClasses[size]} rounded-full bg-surface-1 flex items-center justify-center`}>
          <span className="font-black text-white">{score}</span>
        </div>
      </div>
      {showLabel && (
        <div className="text-left">
          <p className="text-text-tertiary text-xs uppercase tracking-wide">Overall Score</p>
          <p className="text-text-secondary font-medium">out of 10</p>
        </div>
      )}
    </div>
  );
}
