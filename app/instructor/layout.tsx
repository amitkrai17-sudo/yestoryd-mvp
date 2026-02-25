// ============================================================
// FILE: app/instructor/layout.tsx
// ============================================================
// Instructor Layout — Auth + Fetch Interceptor
// Mirrors coach layout auth pattern but for /instructor routes
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [coachName, setCoachName] = useState('');

  // Authenticated fetch interceptor for /api/instructor/* and /api/group-classes/*
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/instructor') || url.includes('/api/group-classes')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', 'Bearer ' + session.access_token);
          return originalFetch(input, { ...init, headers });
        }
      }
      return originalFetch(input, init);
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        validateCoach(session.user);
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/coach/login');
        setLoading(false);
        return;
      }
      validateCoach(session.user);
    } catch {
      setLoading(false);
      router.push('/coach/login');
    }
  };

  const validateCoach = async (authUser: { id?: string; email?: string }) => {
    const email = authUser.email?.toLowerCase();
    const authId = authUser.id;

    if (!email && !authId) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // Try ID-based lookup first, then email
    let coachData: { id: string; name: string; is_active: boolean | null } | null = null;

    if (authId) {
      const { data } = await supabase
        .from('coaches')
        .select('id, name, is_active')
        .eq('user_id', authId)
        .single();
      if (data) coachData = data;
    }

    if (!coachData && email) {
      const { data } = await supabase
        .from('coaches')
        .select('id, name, is_active')
        .eq('email', email)
        .single();
      if (data) coachData = data;
    }

    if (!coachData || !coachData.is_active) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setCoachName(coachData.name);
    setIsAuthorized(true);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-text-tertiary">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="bg-surface-1 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-text-tertiary mb-6">
            You must be an active instructor to access this console.
          </p>
          <button
            onClick={() => router.push('/coach/login')}
            className="w-full py-3 bg-surface-2 text-white rounded-xl font-medium hover:bg-surface-2/80 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Minimal header — instructor sees this alongside Meet */}
      <header className="bg-surface-1 border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">Yestoryd</span>
          <span className="text-xs text-text-tertiary bg-surface-2 px-2 py-0.5 rounded-full">Instructor Console</span>
        </div>
        <span className="text-sm text-text-secondary">{coachName}</span>
      </header>
      {children}
    </div>
  );
}
