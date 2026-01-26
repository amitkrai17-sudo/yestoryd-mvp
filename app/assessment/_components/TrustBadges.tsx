'use client';

import {
  Clock,
  Award,
  Mail,
  MessageCircle,
  Star,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TrustBadge {
  icon: string;
  text: string;
}

interface TrustBadgesProps {
  badges: TrustBadge[];
  className?: string;
}

// Map icon string to Lucide component
const iconMap: Record<string, LucideIcon> = {
  Clock,
  Award,
  Mail,
  MessageCircle,
  Star,
  Shield,
  CheckCircle2,
};

export function TrustBadges({ badges, className = '' }: TrustBadgesProps) {
  return (
    <div className={`flex flex-wrap justify-center gap-4 md:gap-8 text-gray-400 text-xs ${className}`}>
      {badges.map((item, idx) => {
        const IconComponent = iconMap[item.icon] || Clock;
        return (
          <div key={idx} className="flex items-center gap-2">
            <IconComponent className="w-4 h-4 text-pink-500" />
            <span>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}
