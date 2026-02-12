'use client';

import { useState, useEffect } from 'react';
import { Clock, CalendarDays, Layers, Loader2 } from 'lucide-react';
import { AgeBandBadge, getAgeBandFromAge } from '@/components/AgeBandBadge';

interface AgeBandConfig {
  age_band: string;
  label: string;
  total_sessions: number;
  session_duration_minutes: number;
  sessions_per_week: number;
  frequency_label: string;
  program_duration_weeks: number;
}

interface AgeBandInfoCardProps {
  childAge: number | null;
}

export function AgeBandInfoCard({ childAge }: AgeBandInfoCardProps) {
  const [config, setConfig] = useState<AgeBandConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!childAge || childAge < 4 || childAge > 12) {
      setConfig(null);
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/age-band-config?age=${childAge}`);
        const data = await res.json();
        if (data.success && data.config) {
          setConfig(data.config);
        } else {
          setConfig(null);
        }
      } catch {
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [childAge]);

  if (!childAge || childAge < 4 || childAge > 12) return null;
  if (loading) {
    return (
      <div className="border border-border rounded-xl p-3 bg-surface-2 flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
      </div>
    );
  }
  if (!config) return null;

  const band = getAgeBandFromAge(childAge);

  return (
    <div className="border border-border rounded-xl p-4 bg-surface-2">
      <div className="flex items-center gap-2 mb-3">
        <AgeBandBadge ageBand={band} size="md" showEmoji />
        <span className="text-white text-sm font-medium">Program for age {childAge}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-text-tertiary mb-1">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <p className="text-white text-lg font-bold">{config.total_sessions}</p>
          <p className="text-text-tertiary text-xs">sessions</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-text-tertiary mb-1">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <p className="text-white text-lg font-bold">{config.frequency_label}</p>
          <p className="text-text-tertiary text-xs">per week</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-text-tertiary mb-1">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <p className="text-white text-lg font-bold">{config.session_duration_minutes}</p>
          <p className="text-text-tertiary text-xs">min each</p>
        </div>
      </div>
    </div>
  );
}
