// ============================================================
// FILE: app/parent/layout.tsx
// ============================================================
// Parent Layout - Auth + Role Verification
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Works with existing structure - no folder changes needed!
// Public routes: /parent/login
// Protected routes: everything else
//
// Features:
// - Auth verification with ID-based lookup
// - React Context for state sharing (avoids redundant API calls)
// - Automatic public/protected route detection
// ============================================================

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  TrendingUp,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  FileText,
  MessageCircle,
  BookOpen,
  HelpCircle,
} from 'lucide-react';

// ==================== SUPABASE CLIENT ====================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== ROUTE CONFIGURATION ====================
const PUBLIC_ROUTES = [
  '/parent/login',
];

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
}

interface ParentContextType {
  user: any;
  parent: ParentData | null;
  children: ChildData[];
  isLoading: boolean;
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
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Setup authenticated fetch for parent API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/parent') || url.includes('/api/children')) {
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
    // Skip auth check for public routes
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
  }, [pathname]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/parent/login');
        setLoading(false);
        return;
      }

      validateParent(session.user);
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
      router.push('/parent/login');
    }
  };

  const validateParent = async (authUser: any) => {
    const email = authUser.email?.toLowerCase();
    const authId = authUser.id;

    if (!email && !authId) {
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    let parentData = null;
    let error = null;

    // Try ID-based lookup first
    if (authId) {
      const result = await supabase
        .from('parents')
        .select('id, name, email, phone')
        .eq('user_id', authId)
        .single();
      
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
        .single();
      
      parentData = result.data;
      error = result.error;
    }

    if (error || !parentData) {
      console.log('Parent not found:', email);
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // Get children
    const { data: childrenData } = await supabase
      .from('children')
      .select('id, name, child_name, age')
      .eq('parent_id', parentData.id);

    setUser(authUser);
    setParent(parentData);
    setChildren(childrenData || []);
    setIsAuthorized(true);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/parent/login');
  };

  const refetch = async () => {
    if (user) {
      await validateParent(user);
    }
  };

  const contextValue: ParentContextType = {
    user,
    parent,
    children: children_,
    isLoading: loading,
    refetch,
  };

  // ==================== PUBLIC ROUTES ====================
  // Render without sidebar/auth for login page
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  // ==================== UNAUTHORIZED ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-6">
            {user?.email || 'Your account'} is not registered as a parent.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              Sign Out
            </button>
            <Link
              href="/assessment"
              className="block w-full py-3 bg-pink-50 text-pink-600 rounded-xl font-medium hover:bg-pink-100 transition-colors"
            >
              Take Free Assessment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==================== AUTHORIZED - FULL LAYOUT ====================
  return (
    <ParentContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
        >
          <Menu className="w-6 h-6 text-slate-700" />
        </button>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
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
              className="lg:hidden p-1 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Children Selector (if multiple) */}
          {children_.length > 1 && (
            <div className="p-4 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Your Children
              </p>
              <div className="space-y-1">
                {children_.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg"
                  >
                    <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 text-sm font-medium">
                      {(child.child_name || child.name)?.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {child.child_name || child.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-pink-50 text-pink-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${
                    isActive ? 'text-pink-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${isActive ? 'text-pink-700' : ''}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-400">{item.description}</p>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-pink-400" />}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
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
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 min-h-screen">
          <div className="pt-16 lg:pt-0">
            {children}
          </div>
        </main>
      </div>
    </ParentContext.Provider>
  );
}

