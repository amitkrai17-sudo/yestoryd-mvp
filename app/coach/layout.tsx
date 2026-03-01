// ============================================================
// FILE: app/coach/layout.tsx
// ============================================================
// Coach Layout - Auth + Role Verification
// Layout chrome handled by CoachLayout → PortalLayout
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import { CoachContext, CoachData, CoachContextType } from './context';
import CoachLayout from '@/components/layouts/CoachLayout';
import ChatWidget from '@/components/chat/ChatWidget';
import { supabase } from '@/lib/supabase/client';

// ==================== ROUTE CONFIGURATION ====================
const PUBLIC_ROUTES = ['/coach/login', '/coach/confirm'];

function isPublicLandingPage(pathname: string): boolean {
  const protectedPaths = [
    '/coach/dashboard',
    '/coach/sessions',
    '/coach/students',
    '/coach/earnings',
    '/coach/discovery-calls',
    '/coach/templates',
    '/coach/ai-assistant',
    '/coach/onboarding',
    '/coach/profile',
    '/coach/capture',
  ];

  if (protectedPaths.some(p => pathname.startsWith(p))) {
    return false;
  }

  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 2 && segments[0] === 'coach';
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route)) ||
         isPublicLandingPage(pathname);
}

export default function CoachAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Setup authenticated fetch for coach API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/coach') || url.includes('/api/discovery-call')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', 'Bearer ' + session.access_token);
          return originalFetch(input, { ...init, headers });
        }
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (isPublicRoute(pathname)) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (isPublicRoute(pathname)) return;

      if (session?.user) {
        validateCoach(session.user);
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
        setUser(null);
        setCoach(null);
        setIsAuthorized(false);
        setLoading(false);
        router.push('/coach/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  const validateCoach = async (authUser: any) => {
    const email = authUser.email?.toLowerCase();
    const authId = authUser.id;

    if (!email && !authId) {
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    let coachData = null;
    let error = null;

    if (authId) {
      const result = await supabase
        .from('coaches')
        .select('id, name, email, phone, is_active, photo_url')
        .eq('user_id', authId)
        .single();

      if (!result.error && result.data) {
        coachData = result.data;
      }
    }

    if (!coachData && email) {
      const result = await supabase
        .from('coaches')
        .select('id, name, email, phone, is_active, photo_url')
        .eq('email', email)
        .single();

      coachData = result.data;
      error = result.error;
    }

    if (error || !coachData) {
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    if (!coachData.is_active) {
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setUser(authUser);
    setCoach(coachData);
    setIsAuthorized(true);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/coach/login');
  };

  const refetch = async () => {
    if (user) {
      await validateCoach(user);
    }
  };

  const contextValue: CoachContextType = {
    user,
    coach,
    isLoading: loading,
    refetch,
  };

  // ==================== PUBLIC ROUTES ====================
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#00ABFF] to-[#0066CC] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  // ==================== UNAUTHORIZED ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="bg-[#121217] border border-white/[0.08] rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">
            {user?.email || 'Your account'} is not authorized as a coach.
            {coach && !coach.is_active && ' Your account has been deactivated.'}
          </p>
          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-[#00ABFF] text-white rounded-xl font-medium hover:bg-[#0099E6] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ==================== AUTHORIZED ====================
  return (
    <CoachContext.Provider value={contextValue}>
      <CoachLayout
        onSignOut={handleSignOut}
        userName={coach?.name || 'Coach'}
        userEmail={user?.email}
        userAvatar={
          coach?.photo_url ? (
            <img
              src={coach.photo_url}
              alt={coach.name}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : undefined
        }
        chatWidget={
          <ChatWidget
            userRole="coach"
            userEmail={user?.email || ''}
          />
        }
      >
        {children}
      </CoachLayout>
    </CoachContext.Provider>
  );
}
