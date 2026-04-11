// app/coach/discovery-calls/page.tsx
// Coach Discovery Calls — Redesigned: compact cards, sticky stats, filters+sort
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Phone,
  Calendar,
  Users,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle,
  Target,
  X,
  ChevronDown,
  ArrowUpDown,
  AlertTriangle,
  MapPin,
  Video,
  FileText,
  CreditCard,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';
import { getAvatarColor } from '@/lib/utils/avatar-colors';

// ============================================================
// CONSTANTS
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
  assigned: { label: 'Assigned', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
  scheduled: { label: 'Scheduled', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
  no_show: { label: 'No Show', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
  converted: { label: 'Converted', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'no_show', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

const SORT_OPTIONS = [
  { value: 'soonest', label: 'Soonest' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'name', label: 'Name A-Z' },
] as const;

type StatusFilterValue = typeof STATUS_FILTER_OPTIONS[number]['value'];
type DateFilterValue = typeof DATE_FILTER_OPTIONS[number]['value'];
type SortValue = typeof SORT_OPTIONS[number]['value'];

// ============================================================
// TYPES
// ============================================================

interface DiscoveryCall {
  id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  child_name: string;
  child_age: number;
  assessment_score: number;
  status: string;
  scheduled_at: string | null;
  slot_date: string | null;
  slot_time: string | null;
  google_meet_link: string | null;
  questionnaire: any;
  payment_link_sent_at: string | null;
  followup_sent_at: string | null;
  converted_to_enrollment: boolean;
  created_at: string;
  likelihood: string | null;
  call_outcome: string | null;
  follow_up_notes: string | null;
  follow_up_date: string | null;
  booking_source: string | null;
}

// ============================================================
// HELPERS
// ============================================================

function isTodayDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function isWithinDays(dateStr: string, days: number): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  return d >= today && d <= end;
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function isWithinMinutes(dateStr: string, minutes: number): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff <= minutes * 60 * 1000 && diff >= -60 * 60 * 1000;
}

function getScheduledDate(call: DiscoveryCall): string | null {
  return call.slot_date || (call.scheduled_at ? call.scheduled_at.split('T')[0] : null);
}

function getScheduledTime(call: DiscoveryCall): string | null {
  return call.slot_time || (call.scheduled_at ? call.scheduled_at.split('T')[1]?.substring(0, 5) : null);
}

function getLikelihoodDisplay(likelihood: string | null): { text: string; className: string } | null {
  if (!likelihood) return null;
  const map: Record<string, { text: string; className: string }> = {
    hot: { text: 'High', className: 'text-green-400' },
    high: { text: 'High', className: 'text-green-400' },
    warm: { text: 'Medium', className: 'text-amber-400' },
    medium: { text: 'Medium', className: 'text-amber-400' },
    cold: { text: 'Low', className: 'text-red-400' },
    low: { text: 'Low', className: 'text-red-400' },
  };
  return map[likelihood.toLowerCase()] || null;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CoachDiscoveryCallsPage() {
  const [calls, setCalls] = useState<DiscoveryCall[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all');
  const [sortBy, setSortBy] = useState<SortValue>('soonest');

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/discovery-call/pending?status=all');
      const data = await res.json();
      if (data.success) setCalls(data.calls || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // Stats — always from unfiltered data
  const stats = useMemo(() => ({
    total: calls.length,
    scheduled: calls.filter(c => c.status === 'scheduled').length,
    completed: calls.filter(c => c.status === 'completed').length,
    converted: calls.filter(c => c.converted_to_enrollment).length,
  }), [calls]);

  const hasActiveFilter = statusFilter !== 'all' || dateFilter !== 'all' || !!searchTerm;

  const clearFilters = () => {
    setStatusFilter('all');
    setDateFilter('all');
    setSearchTerm('');
  };

  const filteredCalls = useMemo(() => {
    let result = calls.filter(c => {
      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!c.child_name.toLowerCase().includes(q) && !c.parent_name.toLowerCase().includes(q)) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      // Date filter
      const dateStr = getScheduledDate(c);
      if (dateFilter === 'today' && (!dateStr || !isTodayDate(dateStr))) return false;
      if (dateFilter === 'week' && (!dateStr || !isWithinDays(dateStr, 7))) return false;
      if (dateFilter === 'month' && (!dateStr || !isThisMonth(dateStr))) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'soonest': {
          const aDate = getScheduledDate(a);
          const bDate = getScheduledDate(b);
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          const aTime = getScheduledTime(a) || '00:00';
          const bTime = getScheduledTime(b) || '00:00';
          return new Date(`${aDate}T${aTime}`).getTime() - new Date(`${bDate}T${bTime}`).getTime();
        }
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name':
          return a.child_name.localeCompare(b.child_name);
        default:
          return 0;
      }
    });

    return result;
  }, [calls, searchTerm, statusFilter, dateFilter, sortBy]);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  return (
    <div className="pb-24 lg:pb-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 px-4 lg:px-0 pt-4 lg:pt-0 mb-4">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-xl flex items-center justify-center">
              <Phone className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
            </div>
            Discovery Calls
          </h1>
          <p className="text-xs lg:text-sm text-text-tertiary mt-0.5">Manage your assigned calls</p>
        </div>
        <button
          onClick={fetchCalls}
          disabled={loading}
          className="p-2 hover:bg-gray-700 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Sticky: Stats + Filters */}
      <div className="sticky top-0 z-30 bg-surface-0/95 backdrop-blur-sm border-b border-gray-800 -mx-4 lg:mx-0 px-4 lg:px-0">
        {/* Stats Ribbon */}
        <div className="grid grid-cols-4 gap-2 py-3">
          {([
            { icon: Users, label: 'Total', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { icon: Calendar, label: 'Scheduled', value: stats.scheduled, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { icon: CheckCircle, label: 'Completed', value: stats.completed, color: 'text-green-400', bg: 'bg-green-500/10' },
            { icon: Target, label: 'Converted', value: stats.converted, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          ] as const).map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-white leading-tight">{value}</p>
                <p className="text-text-tertiary text-[10px]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
          {/* Search */}
          <div className="relative flex-shrink-0 w-40 lg:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 pl-8 pr-3 bg-surface-1 border border-border rounded-xl text-xs text-white placeholder-text-tertiary focus:outline-none focus:border-[#00ABFF]/50"
            />
          </div>

          <div className="w-px h-6 bg-gray-700 flex-shrink-0" />

          {/* Date filter chips */}
          <div className="flex gap-1.5 flex-shrink-0">
            {DATE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  dateFilter === opt.value
                    ? 'bg-[#00ABFF] text-white'
                    : 'bg-surface-1 text-text-tertiary hover:text-white border border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700 flex-shrink-0" />

          {/* Status filter */}
          <div className="relative flex-shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilterValue)}
              className={`appearance-none px-3 py-1.5 pr-7 rounded-xl text-xs font-medium cursor-pointer transition-colors outline-none ${
                statusFilter !== 'all'
                  ? 'bg-[#00ABFF] text-white'
                  : 'bg-surface-1 text-text-tertiary border border-border'
              }`}
            >
              {STATUS_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-current absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortValue)}
              className="appearance-none px-3 py-1.5 pr-7 rounded-xl text-xs font-medium cursor-pointer transition-colors outline-none bg-surface-1 text-text-tertiary border border-border"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ArrowUpDown className="w-3 h-3 text-text-tertiary absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Clear */}
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-tertiary hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Calls List */}
      <div className="space-y-2 mt-4 px-4 lg:px-0">
        {filteredCalls.length === 0 ? (
          <div className="bg-surface-1 border border-border rounded-2xl p-8 lg:p-12 max-w-3xl mx-auto">
            <EmptyState
              icon={Phone}
              title="No discovery calls found"
              description={hasActiveFilter ? 'Try adjusting your filters' : 'Check back later for new assignments'}
            />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {filteredCalls.map((call) => {
              const statusCfg = STATUS_CONFIG[call.converted_to_enrollment ? 'converted' : call.status] || STATUS_CONFIG.pending;
              const scheduledDate = getScheduledDate(call);
              const scheduledTime = getScheduledTime(call);
              const isJoinable = call.status === 'scheduled' && call.scheduled_at && isWithinMinutes(call.scheduled_at, 15);
              const likelihoodInfo = getLikelihoodDisplay(call.likelihood);

              // Primary CTA
              let cta: React.ReactNode = null;
              if (isJoinable && call.google_meet_link) {
                cta = (
                  <a
                    href={call.google_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="h-9 px-4 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Join</span>
                  </a>
                );
              } else if (call.status === 'scheduled') {
                cta = (
                  <span className="h-9 px-4 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 flex items-center gap-1.5 flex-shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prep</span>
                  </span>
                );
              } else if (call.status === 'completed' && !call.questionnaire) {
                cta = (
                  <span className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white flex items-center gap-1.5 flex-shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add Notes</span>
                  </span>
                );
              } else if (call.status === 'completed' && !call.payment_link_sent_at && !call.converted_to_enrollment) {
                cta = (
                  <span className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white flex items-center gap-1.5 flex-shrink-0">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send Link</span>
                  </span>
                );
              } else if (call.converted_to_enrollment) {
                cta = (
                  <span className="h-9 px-4 rounded-xl text-sm font-medium border border-gray-600 text-gray-300 flex items-center gap-1.5 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    <span className="hidden sm:inline">Enrolled</span>
                  </span>
                );
              } else if (call.status === 'no_show') {
                cta = (
                  <span className="h-9 px-4 rounded-xl text-sm font-medium bg-amber-500 text-white flex items-center gap-1.5 flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reschedule</span>
                  </span>
                );
              } else if (call.status === 'pending') {
                cta = (
                  <span className="h-9 px-4 rounded-xl text-sm font-medium bg-[#FF0099] text-white flex items-center gap-1.5 flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Schedule</span>
                  </span>
                );
              }

              return (
                <Link
                  key={call.id}
                  href={`/coach/discovery-calls/${call.id}`}
                  className="group flex items-start gap-3 p-3 lg:p-4 rounded-2xl border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 hover:border-gray-600/50 transition-all duration-150"
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 bg-gradient-to-br ${getAvatarColor(call.child_name)}`}>
                    {call.child_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + age + scheduled date/time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-[15px] text-white truncate">{call.child_name}</span>
                        <span className="text-sm text-gray-500 flex-shrink-0">{call.child_age}y</span>
                      </div>
                      <span className="text-sm text-gray-400 flex-shrink-0">
                        {scheduledDate ? (
                          <>
                            {formatDateShort(scheduledDate)}
                            {scheduledTime && (
                              <span className="hidden sm:inline"> {formatTime12(scheduledTime)}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-500 text-xs">Not scheduled</span>
                        )}
                      </span>
                    </div>

                    {/* Row 2: Parent + status + CTA */}
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <div className="flex items-center gap-1.5 text-sm text-gray-400 min-w-0">
                        <span className="truncate">{call.parent_name}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full border font-medium flex-shrink-0 ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {cta}
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </div>

                    {/* Row 3 (optional): Post-call context */}
                    {call.status === 'completed' && (likelihoodInfo || call.call_outcome) && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                        {likelihoodInfo && (
                          <span className={`flex items-center gap-0.5 ${likelihoodInfo.className}`}>
                            <Target className="w-3 h-3" />
                            {likelihoodInfo.text}
                          </span>
                        )}
                        {call.call_outcome && (
                          <>
                            <span className="text-gray-600">&middot;</span>
                            <span className="capitalize">{call.call_outcome.replace(/_/g, ' ')}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
