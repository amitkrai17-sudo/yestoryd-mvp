// ============================================================
// FILE: app/coach/layout.tsx
// ============================================================
// Coach Layout - Auth + Role Verification
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Works with existing structure - no folder changes needed!
// Public routes: /coach/login, /coach/[subdomain] (landing pages)
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
  Users,
  Calendar,
  Wallet,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  BookOpen,
  PhoneCall,
  FileText,
  Bot,
  ClipboardList,
} from 'lucide-react';

// ==================== SUPABASE CLIENT ====================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== ROUTE CONFIGURATION ====================
// Routes that don't require auth (login, public landing pages)
const PUBLIC_ROUTES = [
  '/coach/login',
  '/coach/confirm',
];

// Check if route is a public coach landing page (/coach/[subdomain])
function isPublicLandingPage(pathname: string): boolean {
  // /coach/rucha, /coach/john etc. are public landing pages
  // But /coach/dashboard, /coach/sessions etc. are protected
  const protectedPaths = [
    '/coach/dashboard',
    '/coach/sessions',
    '/coach/students',
    '/coach/earnings',
    '/coach/discovery-calls',
    '/coach/templates',
    '/coach/ai-assistant',
    '/coach/onboarding',
  ];
  
  // If it matches a protected path, it's not a landing page
  if (protectedPaths.some(p => pathname.startsWith(p))) {
    return false;
  }
  
  // If it's just /coach/something (single segment after /coach/), it's a landing page
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 2 && segments[0] === 'coach';
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route)) || 
         isPublicLandingPage(pathname);
}

// ==================== TYPES ====================
interface CoachData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  photo_url?: string;
}

interface CoachContextType {
  user: any;
  coach: CoachData | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// ==================== CONTEXT ====================
const CoachContext = createContext<CoachContextType | null>(null);

function useCoachContext() {
  const context = useContext(CoachContext);
  if (!context) {
    throw new Error('useCoachContext must be used within CoachLayout');
  }
  return context;
}

// ==================== NAVIGATION ITEMS ====================
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/coach/dashboard',
    icon: LayoutDashboard,
    description: 'Overview & metrics',
  },
  {
    label: 'My Students',
    href: '/coach/students',
    icon: Users,
    description: 'Manage students',
  },
  {
    label: 'Sessions',
    href: '/coach/sessions',
    icon: Calendar,
    description: 'Upcoming & past sessions',
  },
  {
    label: 'Discovery Calls',
    href: '/coach/discovery-calls',
    icon: PhoneCall,
    description: 'Manage discovery calls',
  },
  {
    label: 'Earnings',
    href: '/coach/earnings',
    icon: Wallet,
    description: 'Payouts & revenue',
  },
  {
    label: 'Templates',
    href: '/coach/templates',
    icon: FileText,
    description: 'Message templates',
  },
  {
    label: 'AI Assistant',
    href: '/coach/ai-assistant',
    icon: Bot,
    description: 'rAI coaching helper',
  },
];

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Setup authenticated fetch for coach API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      // Intercept coach and discovery-call API calls
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
    // Skip auth check for public routes
    if (isPublicRoute(pathname)) {
      setLoading(false);
      return;
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isPublicRoute(pathname)) return;
      
      if (session?.user) {
        validateCoach(session.user);
      } else {
        setUser(null);
        setCoach(null);
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
        router.push('/coach/login');
        setLoading(false);
        return;
      }

      validateCoach(session.user);
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
      router.push('/coach/login');
    }
  };

  const validateCoach = async (authUser: any) => {
    // DEBUG - REMOVE AFTER TESTING
    console.log('=== COACH AUTH DEBUG ===');
    console.log('Auth User ID:', authUser?.id);
    console.log('Auth User Email:', authUser?.email);
    console.log('========================');
    // DEBUG - REMOVE AFTER TESTING
    console.log('=== COACH AUTH DEBUG ===');
    console.log('Auth User ID:', authUser.id);
    console.log('Auth User Email:', authUser.email);
    console.log('========================');
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

    // Try ID-based lookup first
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

    // Fallback to email-based lookup
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
      console.log('Coach not found:', email);
      setUser(authUser);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    if (!coachData.is_active) {
      console.log('Coach is inactive:', email);
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
  // Render without sidebar/auth for login and landing pages
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">
            {user?.email || 'Your account'} is not authorized as a coach.
            {coach && !coach.is_active && ' Your account has been deactivated.'}
          </p>
          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ==================== AUTHORIZED - FULL LAYOUT ====================
  return (
    <CoachContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-gray-800 rounded-xl shadow-lg border border-gray-700"
        >
          <Menu className="w-6 h-6 text-gray-300" />
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
          fixed inset-y-0 left-0 z-50 w-72 bg-[#0f1419] border-r border-gray-800
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
            <Link href="/coach/dashboard" className="flex items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="Yestoryd"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-bold text-white">Coach Portal</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

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
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${
                    isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-gray-400'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${isActive ? 'text-emerald-700' : ''}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-400">{item.description}</p>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-emerald-400" />}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {coach?.name?.charAt(0).toUpperCase() || 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate text-sm">
                  {coach?.name || 'Coach'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
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
    </CoachContext.Provider>
  );
}




