// file: app/admin/layout.tsx
// Admin layout with sidebar navigation and rAI integration

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
  UserPlus,
  Wallet,
  FileText,
  PieChart,
} from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';

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

// ==================== THEME COLORS (Admin = Dark/Professional) ====================
const THEME = {
  primary: '#1a1a2e',
  accent: '#ff0099',
  gradientFrom: '#1a1a2e',
  gradientTo: '#4a4a6a',
};

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
    label: 'Coach Applications',
    href: '/admin/coach-applications',
    icon: UserPlus,
    description: 'Review coach applications',
    ready: true,
  },
  {
    label: 'Revenue Settings',
    href: '/admin/settings/revenue',
    icon: PieChart,
    description: 'Configure revenue splits',
    ready: true,
  },
  {
    label: 'Coach Payouts',
    href: '/admin/payouts',
    icon: Wallet,
    description: 'Process coach payments',
    ready: true,
  },
  {
    label: 'TDS Compliance',
    href: '/admin/tds',
    icon: FileText,
    description: 'Track TDS deductions',
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

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Login page - no layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-6">
            {user?.email || 'Your account'} is not authorized to access the admin portal.
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
      {/* ==================== MOBILE MENU BUTTON ==================== */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-xl shadow-lg border border-slate-200"
      >
        <Menu className="w-6 h-6 text-slate-700" />
      </button>

      {/* ==================== MOBILE OVERLAY ==================== */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== SIDEBAR ==================== */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#1a1a2e] 
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={32}
              className="h-8 w-auto brightness-0 invert"
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Portal Label */}
        <div className="px-6 py-3 border-b border-white/10">
          <p className="text-xs text-[#ff0099] font-semibold uppercase tracking-wider">Admin Portal</p>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.ready ? item.href : '#'}
                onClick={(e) => {
                  if (!item.ready) e.preventDefault();
                  if (item.ready) setSidebarOpen(false);
                }}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff0099]/20 to-[#7b008b]/20 text-white'
                    : item.ready
                    ? 'text-white/70 hover:bg-white/5 hover:text-white'
                    : 'text-white/30 cursor-not-allowed'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-[#ff0099]' : item.ready ? 'text-white/50 group-hover:text-white/70' : 'text-white/20'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm ${isActive ? 'text-white' : ''}`}>{item.label}</p>
                    {!item.ready && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{item.description}</p>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-[#ff0099]" />}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-[#1a1a2e]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate text-sm">
                {user?.user_metadata?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
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

      {/* ==================== rAI CHAT WIDGET ==================== */}
      {user && (
        <ChatWidget
          userRole="admin"
          userEmail={user.email}
        />
      )}
    </div>
  );
}