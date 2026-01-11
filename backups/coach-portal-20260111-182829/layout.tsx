// ============================================================
// FILE: app/coach/layout.tsx
// ============================================================
// Coach Layout - Auth + Role Verification
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// DARK THEME with Brand Colors:
// - Primary CTA: #FF0099 (pink)
// - Secondary: #00ABFF (blue)
// - Dark BG: #0f1419
// - Card BG: bg-gray-800
// - Borders: border-gray-700
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
  PhoneCall,
  FileText,
  Bot,
} from 'lucide-react';

// ==================== SUPABASE CLIENT ====================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export function useCoachContext() {
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
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FF0099] to-[#00ABFF] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // ==================== UNAUTHORIZED ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            {user?.email || 'Your account'} is not authorized as a coach.
            {coach && !coach.is_active && ' Your account has been deactivated.'}
          </p>
          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#FF0099]/90 transition-colors"
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
      <div className="min-h-screen bg-[#0f1419] flex">
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
            className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0d10] border-r border-gray-800
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
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
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-[#FF0099]/10 text-[#FF0099]'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${
                    isActive ? 'text-[#FF0099]' : 'text-gray-500 group-hover:text-gray-300'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${isActive ? 'text-[#FF0099]' : ''}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-[#FF0099]" />}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-800 bg-[#0a0d10]">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF0099] to-[#00ABFF] rounded-full flex items-center justify-center text-white font-semibold text-sm">
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
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 min-h-screen bg-[#0f1419]">
          <div className="p-4 lg:p-6 pt-16 lg:pt-6">
            {children}
          </div>
        </main>
      </div>
    </CoachContext.Provider>
  );
}
