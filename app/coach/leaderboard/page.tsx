'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import LeaderboardTab from '@/app/coach/components/LeaderboardTab';

export default function CoachLeaderboardPage() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/coach/login'; return; }
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!coach) { window.location.href = '/coach/login'; return; }
      setCoachId(coach.id);
      setLoading(false);
    })();
  }, []);

  if (loading || !coachId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-blue-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">Leaderboard</h1>
      <LeaderboardTab coachId={coachId} />
    </div>
  );
}
