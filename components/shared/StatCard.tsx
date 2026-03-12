'use client';

import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: LucideIcon;
  color?: string;
  variant?: 'default' | 'accent';
  trend?: { value: number; positive: boolean };
  subtitle?: string;
  className?: string;
}

const COLOR_MAP: Record<string, { iconBg: string; iconText: string; accentBg: string; accentBorder: string; accentText: string }> = {
  blue:   { iconBg: 'bg-blue-500/20',    iconText: 'text-blue-400',    accentBg: 'bg-blue-500/10',    accentBorder: 'border-blue-500/30',    accentText: 'text-blue-400' },
  green:  { iconBg: 'bg-emerald-500/20',  iconText: 'text-emerald-400', accentBg: 'bg-emerald-500/10',  accentBorder: 'border-emerald-500/30', accentText: 'text-emerald-400' },
  yellow: { iconBg: 'bg-yellow-500/20',   iconText: 'text-yellow-400',  accentBg: 'bg-yellow-500/10',   accentBorder: 'border-yellow-500/30',  accentText: 'text-yellow-400' },
  red:    { iconBg: 'bg-red-500/20',      iconText: 'text-red-400',     accentBg: 'bg-red-500/10',      accentBorder: 'border-red-500/30',     accentText: 'text-red-400' },
  purple: { iconBg: 'bg-purple-500/20',   iconText: 'text-purple-400',  accentBg: 'bg-purple-500/10',   accentBorder: 'border-purple-500/30',  accentText: 'text-purple-400' },
  pink:   { iconBg: 'bg-pink-500/20',     iconText: 'text-pink-400',    accentBg: 'bg-pink-500/10',     accentBorder: 'border-pink-500/30',    accentText: 'text-pink-400' },
  orange: { iconBg: 'bg-orange-500/20',   iconText: 'text-orange-400',  accentBg: 'bg-orange-500/10',   accentBorder: 'border-orange-500/30',  accentText: 'text-orange-400' },
  gray:   { iconBg: 'bg-white/[0.08]',    iconText: 'text-gray-300',    accentBg: 'bg-white/[0.08]',    accentBorder: 'border-white/[0.08]',   accentText: 'text-gray-300' },
};

export function StatCard({
  value,
  label,
  icon: Icon,
  color = 'blue',
  variant = 'default',
  trend,
  subtitle,
  className = '',
}: StatCardProps) {
  const colors = COLOR_MAP[color] || COLOR_MAP.blue;

  if (variant === 'accent') {
    return (
      <div className={`${colors.accentBg} rounded-xl p-3 sm:p-4 border ${colors.accentBorder} ${className}`}>
        {Icon && (
          <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
            <Icon className={`w-4 h-4 ${colors.accentText}`} />
            <span className={`text-[10px] sm:text-xs font-medium ${colors.accentText}`}>{label}</span>
          </div>
        )}
        <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${colors.accentText}`}>{value}</p>
        {!Icon && <p className={`text-[10px] sm:text-xs ${colors.accentText}/70 mt-0.5`}>{label}</p>}
        {subtitle && <p className={`text-[10px] sm:text-xs ${colors.accentText}/70 mt-0.5`}>{subtitle}</p>}
      </div>
    );
  }

  return (
    <div className={`bg-surface-1 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border ${className}`}>
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        {Icon && (
          <div className={`w-9 h-9 sm:w-10 sm:h-10 ${colors.iconBg} rounded-xl flex items-center justify-center`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.iconText}`} />
          </div>
        )}
        {trend && (
          <span className={`text-xs sm:text-sm font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-primary">{value}</p>
      <p className="text-[10px] sm:text-xs text-text-tertiary mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] sm:text-xs text-text-tertiary mt-0.5">{subtitle}</p>}
    </div>
  );
}
