'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Home,
  Calendar,
  TrendingUp,
  MessageCircle,
  LogOut,
  Menu,
  X,
  User,
  BookOpen,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ParentLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/parent/dashboard', icon: Home },
  { name: 'Sessions', href: '/parent/sessions', icon: Calendar },
  { name: 'Progress', href: '/parent/progress', icon: TrendingUp },
  { name: 'Support', href: '/parent/support', icon: MessageCircle },
];

export default function ParentLayout({ children }: ParentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetchParentInfo();
  }, []);

  async function fetchParentInfo() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/parent/login');
      return;
    }

    const { data: child } = await supabase
      .from('children')
      .select('*')
      .eq('parent_email', user.email)
      .eq('enrollment_status', 'active')
      .single();

    if (child) {
      setParentName(child.parent_name || user.email?.split('@')[0] || 'Parent');
      setChildName(child.child_name || child.name);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/parent/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    Yestoryd
                  </h1>
                  <p className="text-xs text-amber-600/70">Parent Portal</p>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {childName && (
            <div className="mx-4 mt-4 p-4 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-xl">👧</span>
                </div>
                <div>
                  <p className="font-semibold text-amber-900">{childName}</p>
                  <p className="text-sm text-amber-700/70">Active Program</p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                      : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-amber-100">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{parentName}</p>
                <p className="text-xs text-gray-500">Parent</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors mt-2"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-amber-100">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-amber-700">Yestoryd</span>
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
