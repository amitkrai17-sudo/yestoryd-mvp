// file: app/admin/layout.tsx
// Admin layout with sidebar navigation, rAI ChatWidget, and activity tracking

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
  CheckCircle,
  Database,
  Radio,
  ClipboardList,
  Upload,
} from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';
import { NotificationBell } from '@/components/ui/NotificationBell';
import BottomNav from '@/components/shared/navigation/BottomNav';
import { navigationConfig } from '@/components/config/navigation';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { supabase } from '@/lib/supabase/client';

// ==================== SUPABASE CLIENT ====================
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
    label: 'All Settings (DB)',
    href: '/admin/site-settings',
    icon: Database,
    description: 'Full site_settings manager',
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
  {
    label: 'Session Templates',
    href: '/admin/templates',
    icon: ClipboardList,
    description: 'Manage session templates',
    ready: true,
    section: 'core',
  },
  {
    label: 'Content',
    href: '/admin/content-upload',
    icon: Upload,
    description: 'Manage content warehouse',
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
    label: 'Completion Mgmt',
    href: '/admin/completion',
    icon: CheckCircle,
    description: 'Track & complete programs',
    ready: true,
    section: 'ops',
  },
  {
    label: 'Communication',
    href: '/admin/communication',
    icon: Radio,
    description: 'Notifications & channels',
    ready: true,
    section: 'ops',
  },
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
    ready: true,
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

  // Setup authenticated fetch for admin API calls
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      
      // Only intercept admin API calls
      if (url.includes("/api/admin") || url.includes("/api/discovery-call")) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const headers = new Headers(init?.headers);
          headers.set("Authorization", `Bearer ${session.access_token}`);
          return originalFetch(input, { ...init, headers });
        }
      }
      
      return originalFetch(input, init);
    };
    
    return () => {
      window.fetch = originalFetch;
    };
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

  // Group nav items by section
  const groupedNavItems = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof NAV_ITEMS>);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <p className="text-text-tertiary">Verifying access...</p>
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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="bg-surface-1 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-text-tertiary mb-6">
            {user?.email || 'Your account'} is not authorized to access the admin portal.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full py-3 bg-surface-1 text-white rounded-xl font-medium hover:bg-surface-2 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex">
      {/* ==================== MOBILE MENU BUTTON ==================== */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="hidden md:flex lg:hidden fixed top-4 left-4 z-40 p-2 bg-surface-1 rounded-xl shadow-lg border border-border"
      >
        <Menu className="w-6 h-6 text-text-secondary" />
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
        fixed inset-y-0 left-0 z-50 w-72 bg-surface-1 border-r border-border
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-white">Admin Portal</span>
          </Link>
          <div className="flex items-center gap-1">
            {user && isAuthorized && (
              <NotificationBell userId={user.id} userType="admin" />
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-surface-2 rounded-lg"
            >
              <X className="w-5 h-5 text-text-tertiary" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {Object.entries(groupedNavItems).map(([section, items]) => (
            <div key={section} className="mb-4">
              {/* Section Label */}
              {SECTION_LABELS[section] && (
                <p className="px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
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
                          ? 'bg-blue-500/20 text-blue-400'
                          : item.ready
                          ? 'text-text-secondary hover:bg-surface-2 hover:text-white'
                          : 'text-text-muted cursor-not-allowed'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 flex-shrink-0 ${
                        isActive ? 'text-blue-400' : item.ready ? 'text-text-muted group-hover:text-text-secondary' : 'text-text-tertiary'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${isActive ? 'text-blue-400' : ''}`}>
                            {item.label}
                          </p>
                          {!item.ready && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-medium flex-shrink-0">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted truncate">{item.description}</p>
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-surface-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate text-sm">
                {user?.user_metadata?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 lg:ml-72 min-h-screen pb-24 lg:pb-0">
        <div className="pt-0 md:pt-16 lg:pt-0">
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

      {/* ==================== BOTTOM NAV - MOBILE ONLY ==================== */}
      {user && isAuthorized && (
        <BottomNav
          items={navigationConfig.admin.bottomNav}
          basePath="/admin"
        />
      )}
    </div>
  );
}
