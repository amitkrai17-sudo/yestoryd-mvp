'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  IndianRupee,
  TrendingUp,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Activity,
  Target,
  Zap,
} from 'lucide-react';

interface DashboardStats {
  totalEnrollments: number;
  activeChildren: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  upcomingSessions: number;
  completedSessions: number;
  conversionRate: number;
  assessmentsTaken: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEnrollments: 0,
    activeChildren: 0,
    totalRevenue: 0,
    thisMonthRevenue: 0,
    upcomingSessions: 0,
    completedSessions: 0,
    conversionRate: 0,
    assessmentsTaken: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats from API
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || stats);
        setRecentEnrollments(data.recentEnrollments || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Enrollments',
      value: stats.totalEnrollments,
      icon: GraduationCap,
      color: 'blue',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Active Children',
      value: stats.activeChildren,
      icon: Users,
      color: 'emerald',
      trend: '+8%',
      trendUp: true,
    },
    {
      label: 'Total Revenue',
      value: `₹${(stats.totalRevenue / 1000).toFixed(1)}K`,
      icon: IndianRupee,
      color: 'violet',
      trend: '+23%',
      trendUp: true,
    },
    {
      label: 'This Month',
      value: `₹${(stats.thisMonthRevenue / 1000).toFixed(1)}K`,
      icon: TrendingUp,
      color: 'amber',
      trend: '+15%',
      trendUp: true,
    },
  ];

  const quickActions = [
    { label: 'Site Settings', href: '/admin/settings', icon: Zap, color: 'blue' },
    { label: 'View Enrollments', href: '/admin/enrollments', icon: GraduationCap, color: 'emerald' },
    { label: 'Manage Coaches', href: '/admin/coaches', icon: Users, color: 'violet' },
    { label: 'View Analytics', href: '/admin/analytics', icon: Activity, color: 'amber' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 mt-1">Welcome back! Here's what's happening.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const colorClasses: Record<string, string> = {
              blue: 'bg-blue-100 text-blue-600',
              emerald: 'bg-emerald-100 text-emerald-600',
              violet: 'bg-violet-100 text-violet-600',
              amber: 'bg-amber-100 text-amber-600',
            };

            return (
              <div
                key={index}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[stat.color]}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    stat.trendUp ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {stat.trendUp ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {stat.trend}
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-1">
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                <p className="text-sm text-slate-500 mt-1">Common tasks</p>
              </div>
              <div className="p-4 space-y-2">
                {quickActions.map((action, index) => {
                  const colorClasses: Record<string, string> = {
                    blue: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
                    emerald: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
                    violet: 'bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
                    amber: 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
                  };

                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${colorClasses[action.color]}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="flex-1 font-medium text-slate-700 group-hover:text-slate-900">
                        {action.label}
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Session Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 mt-6 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
                <p className="text-sm text-slate-500 mt-1">Coaching overview</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Upcoming</p>
                      <p className="text-xs text-slate-500">Next 7 days</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : stats.upcomingSessions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Target className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Completed</p>
                      <p className="text-xs text-slate-500">This month</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : stats.completedSessions}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Enrollments */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Enrollments</h2>
                  <p className="text-sm text-slate-500 mt-1">Latest program enrollments</p>
                </div>
                <Link
                  href="/admin/enrollments"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  Loading...
                </div>
              ) : recentEnrollments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <GraduationCap className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">No enrollments yet</p>
                  <p className="text-sm text-slate-400 mt-1">New enrollments will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentEnrollments.map((enrollment, index) => (
                    <div key={index} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {enrollment.childName?.charAt(0) || 'C'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{enrollment.childName}</p>
                          <p className="text-sm text-slate-500 truncate">
                            Parent: {enrollment.parentName} • {enrollment.parentEmail}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">₹{enrollment.amount}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(enrollment.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
