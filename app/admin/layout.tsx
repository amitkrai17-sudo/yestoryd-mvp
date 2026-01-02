// file: app/admin/layout.tsx
// Admin layout with sidebar navigation, rAI ChatWidget, and activity tracking

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
  FileSignature,
  UsersRound,
  Users2,
  BookOpen,
  Ticket,
} from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';
import { useActivityTracker } from '@/hooks/useActivityTracker';

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
  // ===== CORE =====
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Overview & metrics',
    ready: true,
    section: 'core',
  },
  {
    label: 'Site Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Manage dynamic content',
    ready: true,
    section: 'core',
  },
  {
    label: 'E-Learning',
    href: '/admin/elearning',
    icon: BookOpen,
    description: 'Manage video content',
    ready: true,
    section: 'core',
  },
  // ===== LEADS & COACHES =====
  {
    label: 'Lead Management',
    href: '/admin/crm',
    icon: UserSearch,
    description: 'Track & convert leads',
    ready: true,
    section: 'leads',
  },
  {
    label: 'Coach Applications',
    href: '/admin/coach-applications',
    icon: UserPlus,
    description: 'Review applications',
    ready: true,
    section: 'leads',
  },
  {
    label: 'Agreement Management',
    href: '/admin/agreements',
    icon: FileSignature,
    description: 'Coach agreements',
    ready: true,
    section: 'leads',
  },
  // ===== REVENUE & PAYOUTS =====
  {
    label: 'Coupons',
    href: '/admin/coupons',
    icon: Ticket,
    description: 'Manage discounts & referrals',
    ready: true,
    section: 'revenue',
  },
  {
    label: 'Pricing Settings',
    href: '/admin/settings/pricing',
    icon: IndianRupee,
    description: 'Discounts & referral config',
    ready: true,
    section: 'revenue',
  },
  {
    label: 'Coach Groups',
    href: '/admin/coach-groups',
    icon: UsersRound,
    description: 'Manage tiers & splits',
    ready: true,
    section: 'revenue',
  },
  {
    label: 'Revenue Settings',
    href: '/admin/settings/revenue',
    icon: PieChart,
    description: 'Configure splits',
    ready: true,
    section: 'revenue',
  },
  {
    label: 'Coach Payouts',
    href: '/admin/payouts',
    icon: Wallet,
    description: 'Process payments',
    ready: true,
    section: 'revenue',
  },
  {
    label: 'TDS Compliance',
    href: '/admin/tds',
    icon: FileText,
    description: 'Track deductions',
    ready: true,
    section: 'revenue',
  },
  // ===== OPERATIONS =====
  {
    label: 'Enrollments',
    href: '/admin/enrollments',
    icon: GraduationCap,
    description: 'View enrollments',
    ready: false,
    section: 'ops',
  },
  {
    label: 'Coaches',
    href: '/admin/coaches',
    icon: Users,
    description: 'Manage coaches',
    ready: false,
    section: 'ops',
  },
  {
    label: 'Group Classes',
    href: '/admin/group-classes',
    icon: Users2,
    description: 'Manage sessions',
    ready: true,
    section: 'ops',
  },
  {
    label: 'Payments',
    href: '/admin/payments',
    icon: IndianRupee,
    description: 'Payment history',
    ready: false,
    section: 'ops',
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    description: 'Platform insights',
    ready: false,
    section: 'ops',
  },
];

// Section labels for visual grouping
const SECTION_LABELS: Record<string, string> = {
  core: '',
  leads: 'Leads & Coaches',
  revenue: 'Revenue',
  ops: 'Operations',
};

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

  // Activity tracking - tracks login and page views automatically
  useActivityTracker({
    userType: 'admin',
    userEmail: user?.email || null,
    enabled: !!user && isAuthorized,
  });

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

  // Group nav items by section
  const groupedNavItems = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof NAV_ITEMS>);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-500">Verifying access...</p>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
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
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-slate-900">Admin Portal</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {Object.entries(groupedNavItems).map(([section, items]) => (
            <div key={section} className="mb-4">
              {/* Section Label */}
              {SECTION_LABELS[section] && (
                <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {SECTION_LABELS[section]}
                </p>
              )}
              
              {/* Nav Items */}
              <div className="space-y-1">
                {items.map((item) => {
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
                      className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : item.ready
                          ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 flex-shrink-0 ${
                        isActive ? 'text-blue-600' : item.ready ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${isActive ? 'text-blue-700' : ''}`}>
                            {item.label}
                          </p>
                          {!item.ready && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium flex-shrink-0">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{item.description}</p>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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

      {/* ==================== rAI CHAT WIDGET ==================== */}
      {user && isAuthorized && (
        <ChatWidget
          userRole="admin"
          userEmail={user.email}
        />
      )}
    </div>
  );
}
