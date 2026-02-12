'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { LiveSessionPanel } from '@/components/coach/live-session';
import type { LiveSessionData } from '@/components/coach/live-session/types';

export default function LiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LiveSessionData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/coach/sessions/${sessionId}/live`);
        const result = await res.json();

        if (!res.ok || !result.success) {
          setError(result.error || 'Failed to load session');
          return;
        }

        if (!result.child) {
          setError('Child data not found for this session');
          return;
        }

        setData({
          session: result.session,
          child: result.child,
          template: result.template,
          recent_sessions: result.recent_sessions,
          parent_tasks: result.parent_tasks,
          recent_struggles: result.recent_struggles || [],
          coach_sessions_logged: result.coach_sessions_logged || 0,
          next_session_id: result.next_session_id || null,
        });
      } catch {
        setError('Failed to load session data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF0099] mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-white mb-2">{error}</p>
          <button
            onClick={() => router.back()}
            className="text-[#FF0099] font-medium active:opacity-70"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <LiveSessionPanel data={data} />;
}
