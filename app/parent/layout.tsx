// ============================================================
// FILE: app/parent/layout.tsx
// VERSION: 3.1 - Fixed: All pages now get sidebar/hamburger menu
// ============================================================
// Parent Layout - Auth + Role Verification + Child Selector
// Yestoryd - AI-Powered Reading Intelligence Platform
// ============================================================

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  TrendingUp,
  Calendar,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  BookOpen,
  HelpCircle,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import BottomNav from '@/components/navigation/BottomNav';
import { parentNavItems } from '@/lib/config/navigation';

// ==================== SUPABASE CLIENT ====================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== ROUTE CONFIGURATION ====================
const PUBLIC_ROUTES = ['/parent/login', '/parent/book-skill-booster'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

// ==================== TYPES ====================
interface ParentData {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface ChildData {
  id: string;
  name: string;
  child_name?: string;
  age?: number;
  lead_status?: string;
}

interface ParentContextType {
  user: any;
  parent: ParentData | null;
  children: ChildData[];
  selectedChildId: string | null;
  selectedChild: ChildData | null;
  setSelectedChildId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ==================== CONTEXT ====================
const ParentContext = createContext<ParentContextType | null>(null);

export function useParentContext() {
  const context = useContext(ParentContext);
  if (!context) {
    throw new Error('useParentContext must be used within ParentLayout');
  }
  return context;
}

// ==================== NAVIGATION ITEMS ====================
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/parent/dashboard',
    icon: LayoutDashboard,
    description: 'Overview & updates',
  },
  {
    label: 'Progress',
    href: '/parent/progress',
    icon: TrendingUp,
    description: "Your child's journey",
  },
  {
    label: 'Sessions',
    href: '/parent/sessions',
    icon: Calendar,
    description: 'Upcoming & past sessions',
  },
  {
    label: 'E-Learning',
    href: '/parent/elearning',
    icon: BookOpen,
    description: 'Learning modules',
  },
  {
    label: 'Support',
    href: '/parent/support',
    icon: HelpCircle,
    description: 'Get help',
  },
];

// ==================== SAFE LOCALSTORAGE ====================
function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn('localStorage not available:', e);
  }
}

// ==================== MAIN COMPONENT ====================
export default function ParentLayout({
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Get selected child object
  const selectedChild = children_.find(c => c.id === selectedChildId) || null;

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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

      // Try ID-based lookup first
      if (authId) {
        const result = await supabase
          .from('parents')
          .select('id, name, email, phone')
          .eq('user_id', authId)
          .maybeSingle();

        if (!result.error && result.data) {
          parentData = result.data;
        }
      }

      // Fallback to email-based lookup
      if (!parentData && email) {
        const result = await supabase
          .from('parents')
          .select('id, name, email, phone')
          .eq('email', email)
          .maybeSingle();

        if (!result.error && result.data) {
          parentData = result.data;
        }
      }

      if (!parentData) {
        console.log('Parent not found:', email);
        setUser(authUser);
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Get children
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('id, name, child_name, age, lead_status')
        .eq('parent_id', parentData.id)
        .order('created_at', { ascending: false });

      if (childrenError) {
        console.error('Error fetching children:', childrenError);
      }

      const allChildren = childrenData || [];

      setUser(authUser);
      setParent(parentData);
      setChildren(allChildren);
      setError(null);

      // Restore selected child from localStorage or select first enrolled child
      const storedChildId = safeGetItem(`yestoryd_selected_child_${parentData.id}`);
      if (storedChildId && allChildren.some(c => c.id === storedChildId)) {
        setSelectedChildIdState(storedChildId);
      } else {
        // Auto-select first enrolled child, or first child if none enrolled
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
        console.error('Session error:', sessionError);
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
      console.error('Auth error:', err);
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

  // Handle child selection
  const setSelectedChildId = useCallback((childId: string) => {
    setSelectedChildIdState(childId);
    if (parent?.id) {
      safeSetItem(`yestoryd_selected_child_${parent.id}`, childId);
    }
    // Trigger page refresh by dispatching custom event
    window.dispatchEvent(new CustomEvent('childChanged', { detail: { childId } }));
  }, [parent?.id]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/parent/login');
    } catch (err) {
      console.error('Sign out error:', err);
      // Force redirect anyway
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  // ==================== ERROR STATE ====================
  if (error && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-500 mb-6 text-sm">{error}</p>
          <div className="space-y-3">
            <button
              onClick={refetch}
              className="w-full py-3 bg-[#7b008b] text-white rounded-xl font-medium hover:bg-[#6a0078] transition-colors flex items-center justify-center gap-2 min-h-[48px]"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors min-h-[48px]"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-6 text-sm">
            {user?.email || 'Your account'} is not registered as a parent.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors min-h-[48px]"
            >
              Sign Out
            </button>
            <Link
              href="/assessment"
              className="block w-full py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-medium hover:opacity-90 transition-opacity min-h-[48px] flex items-center justify-center"
            >
              Reading Test - Free
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==================== AUTHORIZED - FULL LAYOUT WITH SIDEBAR ====================
  return (
    <ParentContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex overflow-x-hidden">
        {/* Mobile Menu Button - Hidden on mobile (use bottom nav), visible on tablet for sidebar */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="hidden md:flex lg:hidden fixed top-4 left-4 z-40 p-3 bg-white rounded-xl shadow-lg border border-slate-200 min-w-[48px] min-h-[48px] items-center justify-center"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-slate-700" />
        </button>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-slate-200
            transform transition-transform duration-300 ease-in-out
            lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
            <Link href="/parent/dashboard" className="flex items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="Yestoryd"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-bold text-slate-900">Parent Portal</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Children Selector */}
          {children_.length > 0 && (
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all min-h-[52px] ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 border-2 border-[#ff0099]/40 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent active:scale-[0.98]'
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`Select ${displayName}${isEnrolled ? ' (enrolled)' : ''}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#ff0099] to-[#7b008b] text-white shadow-md'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className={`font-medium text-sm truncate ${isSelected ? 'text-[#7b008b]' : 'text-slate-700'}`}>
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
                        <div className="w-5 h-5 bg-[#ff0099] rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[52px] ${
                    isActive
                      ? 'bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 text-[#7b008b]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${
                    isActive ? 'text-[#ff0099]' : 'text-slate-400 group-hover:text-slate-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isActive ? 'text-[#7b008b]' : ''}`}>
                      {item.label}
                    </p>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-[#ff0099] flex-shrink-0" />}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {parent?.name?.charAt(0).toUpperCase() || 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate text-sm">
                  {parent?.name || 'Parent'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-[280px] min-h-screen w-full">
          <div className="pt-4 lg:pt-0 pb-24 lg:pb-0 w-full">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav
          items={parentNavItems}
          baseRoute="/parent"
          theme="light"
        />
      </div>
    </ParentContext.Provider>
  );
}
