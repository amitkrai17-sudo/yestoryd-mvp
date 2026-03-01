// ============================================================
// FILE: app/admin/layout.tsx
// ============================================================
// Admin Layout - Auth + Email Whitelist Verification
// Layout chrome handled by AdminLayout → PortalLayout
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Shield } from 'lucide-react';
import AdminLayout from '@/components/layouts/AdminLayout';
import ChatWidget from '@/components/chat/ChatWidget';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { supabase } from '@/lib/supabase/client';

// ==================== ADMIN EMAILS (loaded from DB) ====================
async function fetchAdminEmails(): Promise<string[]> {
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('category', 'auth')
    .eq('key', 'admin_emails')
    .single();
  if (!data?.value) return [];
  const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  return (parsed as string[]).map((e: string) => e.toLowerCase());
}

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Activity tracking
  useActivityTracker({
    userType: 'admin',
    userEmail: user?.email || null,
    enabled: !!user && isAuthorized,
  });

  // Setup authenticated fetch for admin API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/admin') || url.includes('/api/discovery-call')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${session.access_token}`);
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
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        validateAdmin(session.user);
      } else {
        setUser(null);
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (pathname !== '/admin/login') router.push('/admin/login');
        setLoading(false);
        return;
      }
      validateAdmin(session.user);
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
      if (pathname !== '/admin/login') router.push('/admin/login');
    }
  };

  const validateAdmin = async (authUser: any) => {
    const email = authUser.email?.toLowerCase();
    const adminEmails = await fetchAdminEmails();

    if (!email || !adminEmails.includes(email)) {
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setUser(authUser);
    setIsAuthorized(true);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Login page — no layout chrome
  if (pathname === '/admin/login') {
    // Authenticated admin on login page → redirect to dashboard
    if (isAuthorized) {
      router.replace('/admin');
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-500">Redirecting to dashboard...</p>
          </div>
        </div>
      );
    }
    // Not authenticated or not admin → show login page
    return <>{children}</>;
  }

  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="bg-[#121217] rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-white/[0.08]">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">
            {user?.email || 'Your account'} is not authorized to access the admin portal.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-white/[0.08] text-white rounded-xl font-medium hover:bg-white/[0.12] transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Authorized
  return (
    <AdminLayout
      onSignOut={handleSignOut}
      userName={user?.user_metadata?.full_name || 'Admin'}
      userEmail={user?.email}
      chatWidget={
        <ChatWidget
          userRole="admin"
          userEmail={user?.email || ''}
        />
      }
    >
      {children}
    </AdminLayout>
  );
}
