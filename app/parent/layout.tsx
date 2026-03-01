// ============================================================
// FILE: app/parent/layout.tsx
// ============================================================
// Parent Layout - Auth + Role Verification + Child Selector
// Layout chrome handled by ParentLayout → PortalLayout
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import ParentLayout from '@/components/layouts/ParentLayout';
import ChatWidget from '@/components/chat/ChatWidget';
import { supabase } from '@/lib/supabase/client';
import { ParentContext, ParentContextType, ParentData, ChildData } from './context';

// Re-export for backwards compatibility
export { useParentContext } from './context';

// ==================== ROUTE CONFIGURATION ====================
const PUBLIC_ROUTES = ['/parent/login', '/parent/book-skill-booster'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

// ==================== SAFE LOCALSTORAGE ====================
function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined') return localStorage.getItem(key);
  } catch { /* noop */ }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch { /* noop */ }
}

// ==================== CHILD SELECTOR (sidebar extra) ====================
function ChildSelector({
  children_,
  selectedChildId,
  setSelectedChildId,
}: {
  children_: ChildData[];
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
}) {
  if (children_.length === 0) return null;

  return (
    <div className="p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Your Children
      </p>
      <div className="space-y-2 max-h-[180px] overflow-y-auto">
        {children_.map((child) => {
          const isSelected = selectedChildId === child.id;
          const isEnrolled = child.lead_status === 'enrolled';
          const displayName = child.child_name || child.name || 'Child';

          return (
            <button
              key={child.id}
              onClick={() => setSelectedChildId(child.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all min-h-[48px] ${
                isSelected
                  ? 'bg-[#FF0099]/10 border-2 border-[#FF0099]/40'
                  : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
              }`}
              aria-pressed={isSelected}
              aria-label={`Select ${displayName}${isEnrolled ? ' (enrolled)' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                isSelected
                  ? 'bg-gradient-to-br from-[#FF0099] to-[#7B008B] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className={`font-medium text-sm truncate ${isSelected ? 'text-[#FF0099]' : 'text-gray-700'}`}>
                  {displayName}
                </p>
                {isEnrolled && (
                  <p className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                    <Check className="w-3 h-3" />
                    Enrolled
                  </p>
                )}
              </div>
              {isSelected && (
                <div className="w-5 h-5 bg-[#FF0099] rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function ParentAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [parent, setParent] = useState<ParentData | null>(null);
  const [children_, setChildren] = useState<ChildData[]>([]);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const selectedChild = children_.find(c => c.id === selectedChildId) || null;

  // Setup authenticated fetch for parent API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/parent') || url.includes('/api/children') || url.includes('/api/skill-booster')) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const headers = new Headers(init?.headers);
            headers.set('Authorization', 'Bearer ' + session.access_token);
            return originalFetch(input, { ...init, headers });
          }
        }
        return originalFetch(input, init);
      } catch (e) {
        return originalFetch(input, init);
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const validateParent = useCallback(async (authUser: any) => {
    try {
      const email = authUser.email?.toLowerCase();
      const authId = authUser.id;

      if (!email && !authId) {
        setUser(authUser);
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      let parentData = null;

      if (authId) {
        const result = await supabase
          .from('parents')
          .select('id, name, email, phone')
          .eq('user_id', authId)
          .maybeSingle();
        if (!result.error && result.data) parentData = result.data;
      }

      if (!parentData && email) {
        const result = await supabase
          .from('parents')
          .select('id, name, email, phone')
          .eq('email', email)
          .maybeSingle();
        if (!result.error && result.data) parentData = result.data;
      }

      if (!parentData) {
        setUser(authUser);
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('id, name, child_name, age, lead_status')
        .eq('parent_id', parentData.id)
        .order('created_at', { ascending: false });

      if (childrenError) console.error('Error fetching children:', childrenError);

      const allChildren = childrenData || [];

      setUser(authUser);
      setParent(parentData as any);
      setChildren(allChildren as any);
      setError(null);

      const storedChildId = safeGetItem(`yestoryd_selected_child_${parentData.id}`);
      if (storedChildId && allChildren.some(c => c.id === storedChildId)) {
        setSelectedChildIdState(storedChildId);
      } else {
        const enrolledChild = allChildren.find(c => c.lead_status === 'enrolled');
        const firstChild = enrolledChild || allChildren[0];
        if (firstChild) {
          setSelectedChildIdState(firstChild.id);
          safeSetItem(`yestoryd_selected_child_${parentData.id}`, firstChild.id);
        }
      }

      setIsAuthorized(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Validation error:', err);
      setError('Failed to load your profile. Please try again.');
      setLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError('Authentication failed. Please login again.');
        setLoading(false);
        router.push('/parent/login');
        return;
      }

      if (!session) {
        router.push('/parent/login');
        setLoading(false);
        return;
      }

      await validateParent(session.user);
    } catch (err: any) {
      setError('Authentication failed. Please try again.');
      setLoading(false);
      router.push('/parent/login');
    }
  }, [router, validateParent]);

  useEffect(() => {
    if (isPublicRoute(pathname)) {
      setLoading(false);
      return;
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isPublicRoute(pathname)) return;
      if (session?.user) {
        validateParent(session.user);
      } else {
        setUser(null);
        setParent(null);
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, checkAuth, validateParent]);

  const setSelectedChildId = useCallback((childId: string) => {
    setSelectedChildIdState(childId);
    if (parent?.id) {
      safeSetItem(`yestoryd_selected_child_${parent.id}`, childId);
    }
    window.dispatchEvent(new CustomEvent('childChanged', { detail: { childId } }));
  }, [parent?.id]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/parent/login');
    } catch {
      router.push('/parent/login');
    }
  };

  const refetch = useCallback(async () => {
    if (user) {
      setLoading(true);
      await validateParent(user);
    }
  }, [user, validateParent]);

  const contextValue: ParentContextType = {
    user,
    parent,
    children: children_,
    selectedChildId,
    selectedChild,
    setSelectedChildId,
    isLoading: loading,
    error,
    refetch,
  };

  // ==================== PUBLIC ROUTES ====================
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // ==================== ERROR STATE ====================
  if (error && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 mb-6 text-sm">{error}</p>
          <div className="space-y-3">
            <button
              onClick={refetch}
              className="w-full py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#E6008A] transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors min-h-[48px]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== UNAUTHORIZED ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6 text-sm">
            {user?.email || 'Your account'} is not registered as a parent.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors min-h-[48px]"
            >
              Sign Out
            </button>
            <Link
              href="/assessment"
              className="block w-full py-3 bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white rounded-xl font-medium hover:opacity-90 transition-opacity min-h-[48px] flex items-center justify-center"
            >
              Reading Test - Free
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==================== AUTHORIZED ====================
  return (
    <ParentContext.Provider value={contextValue}>
      <ParentLayout
        onSignOut={handleSignOut}
        userName={parent?.name || 'Parent'}
        userEmail={user?.email}
        sidebarExtra={
          <ChildSelector
            children_={children_}
            selectedChildId={selectedChildId}
            setSelectedChildId={setSelectedChildId}
          />
        }
        chatWidget={
          <ChatWidget
            userRole="parent"
            userEmail={user?.email || ''}
            childId={selectedChildId || undefined}
            childName={selectedChild?.child_name || selectedChild?.name || undefined}
          />
        }
      >
        {children}
      </ParentLayout>
    </ParentContext.Provider>
  );
}
