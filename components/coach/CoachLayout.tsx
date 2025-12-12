'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Calendar,
  IndianRupee,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Bot,
  ChevronRight,
} from 'lucide-react';

interface CoachLayoutProps {
  children: React.ReactNode;
  coach: {
    id: string;
    name: string;
    email: string;
    photo_url?: string;
  };
}

const navItems = [
  { href: '/coach/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/coach/students', label: 'My Students', icon: Users },
  { href: '/coach/sessions', label: 'Sessions', icon: Calendar },
  { href: '/coach/earnings', label: 'Earnings', icon: IndianRupee },
  { href: '/coach/templates', label: 'WhatsApp', icon: MessageSquare },
  { href: '/coach/ai-assistant', label: 'AI Assistant', icon: Bot },
  { href: '/coach/settings', label: 'Settings', icon: Settings },
];

export function CoachLayout({ children, coach }: CoachLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <Link href="/coach/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold">
            <span className="text-pink-500">Yest</span>
            <span className="text-white">or</span>
            <span className="text-yellow-400">yd</span>
          </span>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Coach</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-gray-400 hover:text-white"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <Link href="/coach/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              <span className="text-pink-500">Yest</span>
              <span className="text-white">or</span>
              <span className="text-yellow-400">yd</span>
            </span>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Coach</span>
          </Link>
        </div>

        {/* Coach Profile */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {coach.photo_url ? (
              <img
                src={coach.photo_url}
                alt={coach.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                {getInitials(coach.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{coach.name}</p>
              <p className="text-gray-400 text-sm truncate">{coach.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-700">
          <button
            onClick={() => {
              // Handle logout
              window.location.href = '/coach/login';
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
