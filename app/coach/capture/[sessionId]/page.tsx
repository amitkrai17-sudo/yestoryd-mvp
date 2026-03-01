// ============================================================
// Standalone Capture Page — /coach/capture/[sessionId]
// Query params: childId, modality, groupSessionId
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCoachContext } from '@/app/coach/context';
import StructuredCaptureForm from '@/components/coach/structured-capture';
import type { SessionModality } from '@/lib/intelligence/types';

interface SessionDetails {
  childId: string;
  childName: string;
  childAge: number;
  sessionNumber: number | null;
}

export default function CapturePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { coach } = useCoachContext();

  const sessionId = params.sessionId as string;
  const childIdParam = searchParams.get('childId');
  const modality = (searchParams.get('modality') || 'online_1on1') as SessionModality;
  const groupSessionId = searchParams.get('groupSessionId');

  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(sessionId !== 'new');
  const [error, setError] = useState<string | null>(null);

  // Fetch session details if real UUID
  useEffect(() => {
    if (sessionId === 'new') {
      // Ad-hoc capture — use query params
      if (!childIdParam) {
        setError('childId query parameter is required for ad-hoc captures');
        return;
      }
      setSessionDetails({
        childId: childIdParam,
        childName: 'Student',
        childAge: 7,
        sessionNumber: null,
      });
      return;
    }

    async function fetchSession() {
      try {
        const res = await fetch('/api/coach/sessions');
        if (!res.ok) throw new Error('Failed to fetch sessions');
        const data = await res.json();
        const session = data.sessions?.find((s: { id: string }) => s.id === sessionId);
        if (!session) throw new Error('Session not found');
        setSessionDetails({
          childId: session.child_id,
          childName: session.child_name,
          childAge: session.child_age || 7,
          sessionNumber: session.session_number,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [sessionId, childIdParam]);

  const handleComplete = () => {
    router.push('/coach/sessions');
  };

  const handleClose = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF] mx-auto mb-3" />
          <p className="text-text-tertiary text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !sessionDetails || !coach) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="bg-surface-1 border border-border rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-400 text-sm mb-4">{error || 'Unable to load capture form'}</p>
          <button
            onClick={() => router.push('/coach/sessions')}
            className="px-4 py-2 bg-[#00ABFF] text-white rounded-lg text-sm hover:bg-[#00ABFF]/90"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <StructuredCaptureForm
      sessionId={sessionId}
      childId={sessionDetails.childId}
      childName={sessionDetails.childName}
      childAge={sessionDetails.childAge}
      coachId={coach.id}
      sessionNumber={sessionDetails.sessionNumber || undefined}
      modality={modality}
      groupSessionId={groupSessionId}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
}
