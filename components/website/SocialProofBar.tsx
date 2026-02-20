'use client';

import { useEffect, useState, useRef } from 'react';
import { Users, BookOpen, GraduationCap, Award } from 'lucide-react';

interface Stats {
  assessments_completed: number;
  active_enrollments: number;
  sessions_delivered: number;
  active_coaches: number;
}

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current || target === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1200;
          const steps = 30;
          const increment = target / steps;
          let current = 0;
          const interval = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(interval);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="text-xl sm:text-2xl font-bold text-white tabular-nums">
      {count > 0 ? count : target}
      {suffix}
    </span>
  );
}

export default function SocialProofBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // Don't render if all stats are 0 or fetch failed
  if (!stats || (stats.assessments_completed === 0 && stats.sessions_delivered === 0)) {
    return null;
  }

  const items = [
    {
      icon: BookOpen,
      value: stats.assessments_completed,
      suffix: '+',
      label: 'Assessments',
      color: 'text-[#FF0099]',
      bg: 'bg-[#FF0099]/10',
    },
    {
      icon: Users,
      value: stats.active_enrollments,
      suffix: '+',
      label: 'Families',
      color: 'text-[#00ABFF]',
      bg: 'bg-[#00ABFF]/10',
    },
    {
      icon: GraduationCap,
      value: stats.sessions_delivered,
      suffix: '+',
      label: 'Sessions',
      color: 'text-[#c847f4]',
      bg: 'bg-[#c847f4]/10',
    },
    {
      icon: Award,
      value: stats.active_coaches,
      suffix: '',
      label: 'Expert Coaches',
      color: 'text-[#ffde00]',
      bg: 'bg-[#ffde00]/10',
    },
  ];

  return (
    <section className="py-6 sm:py-8 bg-surface-1 border-y border-border">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col items-center text-center gap-1.5">
              <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <AnimatedCounter target={item.value} suffix={item.suffix} />
              <span className="text-text-tertiary text-xs sm:text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
