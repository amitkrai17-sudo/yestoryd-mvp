'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Settings,
  Users,
  GraduationCap,
  IndianRupee,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  UserSearch,
} from 'lucide-react';

// ==================== SUPABASE CLIENT ====================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== ALLOWED ADMIN EMAILS ====================
const ADMIN_EMAILS = [
  'rucha.rai@yestoryd.com',
  'rucha@yestoryd.com',
  'amitkrai17@gmail.com',
  'amitkrai17@yestoryd.com',
  'engage@yestoryd.com',
];

// ==================== NAVIGATION ITEMS ====================
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Overview & metrics',
    ready: true,
  },
  {
    label: 'Site Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Manage dynamic content',
    ready: true,
  },
  {
    label: 'Lead Management',
    href: '/admin/crm',
    icon: UserSearch,
    description: 'Track & convert leads',
    ready: true,
  },
  {
    label: 'Enrollments',
    href: '/admin/enrollments',
    icon: GraduationCap,
    description: 'View all enrollments',
    ready: false,
  },
  {
    label: 'Coaches',
    href: '/admin/coaches',
    icon: Users,
    description: 'Manage coaches',
    ready: false,
  },
  {
    label: 'Payments',
    href: '/admin/payments',
    icon: IndianRupee,
    description: 'Payment history',
    ready: false,
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    description: 'Platform insights',
    ready: false,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
        if (pathname !== '/admin/login') {
          router.push('/admin/login');
        }
        setLoading(false);
        return;
      }

      validateAdmin(session.user);
    } catch (error) {
      console.error('Auth error:', error);
      setLoading(false);
      router.push('/admin/login');
    }
  };

  const validateAdmin = (authUser: any) => {
    const email = authUser.email?.toLowerCase();
    
    if (!email || !ADMIN_EMAILS.includes(email)) {
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

  // Skip layout for login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">
            {user?.email ? `${user.email} is not authorized to access the admin portal.` : 'You need to sign in to access this area.'}
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ==================== MOBILE HEADER ==================== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-40">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/images/logo.png" alt="Yestoryd" width={100} height={28} className="h-7 w-auto" />
        </div>
        <div className="w-10" />
      </div>

      {/* ==================== SIDEBAR OVERLAY ==================== */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== SIDEBAR ==================== */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:transform-none`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="Yestoryd" width={120} height={32} className="h-8 w-auto" />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Portal Label */}
        <div className="px-6 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin Portal</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.ready ? item.href : '#'}
                onClick={(e) => {
                  if (!item.ready) e.preventDefault();
                  setSidebarOpen(false);
                }}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : item.ready
                    ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : item.ready ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-300'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${isActive ? 'text-blue-700' : ''}`}>{item.label}</p>
                    {!item.ready && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{item.description}</p>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-blue-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate text-sm">
                {user?.user_metadata?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 lg:ml-72 min-h-screen">
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}