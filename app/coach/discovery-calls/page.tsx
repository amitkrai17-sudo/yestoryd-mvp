'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone, MessageCircle, Calendar, Clock, Users, ChevronRight, RefreshCw } from 'lucide-react';
import CoachLayout from '@/components/layouts/CoachLayout';

interface DiscoveryCall {
  id: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  child_name: string;
  child_age: number;
  assessment_score: number;
  assessment_wpm: number;
  status: string;
  scheduled_at: string | null;
  meeting_url: string | null;
  questionnaire: any;
  payment_link_sent_at: string | null;
  followup_sent_at: string | null;
  converted_to_enrollment: boolean;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  scheduled: { label: 'Scheduled', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20' },
  no_show: { label: 'No Show', color: 'text-red-400', bg: 'bg-red-500/20' },
};

export default function CoachDiscoveryCallsPage() {
  const [calls, setCalls] = useState<DiscoveryCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchCalls();
  }, [filter]);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discovery-call/pending?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setCalls(data.calls || []);
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (call: DiscoveryCall) => {
    if (call.converted_to_enrollment) return { text: 'Enrolled ?', color: 'text-green-600' };
    if (call.followup_sent_at) return { text: 'Followed Up', color: 'text-purple-600' };
    if (call.payment_link_sent_at) return { text: 'Payment Sent', color: 'text-blue-600' };
    if (call.status === 'completed') return { text: 'Fill Form', color: 'text-[#00ABFF]' };
    if (call.status === 'scheduled') return { text: 'View', color: 'text-blue-600' };
    return { text: 'View', color: 'text-gray-400' };
  };

  return (
    <CoachLayout>
      <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-lg lg:rounded-xl flex items-center justify-center">
              <Phone className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
            </div>
            Discovery Calls
          </h1>
          <p className="text-xs lg:text-sm text-text-tertiary mt-0.5">Manage your assigned calls</p>
        </div>
        <button
          onClick={fetchCalls}
          disabled={loading}
          className="p-1.5 lg:p-2 hover:bg-gray-700 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 lg:w-5 lg:h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats - Mobile optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-4">
        {[
          { label: 'Total', value: calls.length, icon: Users, color: 'bg-blue-500' },
          { label: 'Scheduled', value: calls.filter(c => c.status === 'scheduled').length, icon: Calendar, color: 'bg-purple-500' },
          { label: 'Completed', value: calls.filter(c => c.status === 'completed').length, icon: Clock, color: 'bg-green-500' },
          { label: 'Converted', value: calls.filter(c => c.converted_to_enrollment).length, icon: Users, color: 'bg-[#00ABFF]' },
        ].map((s, i) => (
          <div key={i} className="bg-surface-1 rounded-xl border border-border p-2.5 lg:p-4 flex items-center gap-2 lg:gap-3">
            <div className={`w-8 h-8 lg:w-10 lg:h-10 ${s.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <s.icon className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-lg lg:text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] lg:text-xs text-text-tertiary">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs - Scrollable on mobile */}
      <div className="flex gap-1.5 lg:gap-2 mb-4 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
        {[
          { key: 'all', label: 'All' },
          { key: 'scheduled', label: 'Scheduled' },
          { key: 'completed', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg font-medium whitespace-nowrap text-xs lg:text-sm transition-colors flex-shrink-0 ${
              filter === tab.key
                ? 'bg-[#00ABFF] text-white'
                : 'bg-surface-1 text-text-tertiary hover:bg-surface-2 border border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8 lg:py-12">
          <RefreshCw className="w-5 h-5 lg:w-6 lg:h-6 animate-spin text-[#00ABFF]" />
        </div>
      )}

      {/* Calls List */}
      {!loading && (
        <div className="space-y-2 lg:space-y-3">
          {calls.length > 0 ? (
            calls.map((call) => {
              const statusCfg = STATUS_CONFIG[call.status] || STATUS_CONFIG.pending;
              const action = getActionLabel(call);

              return (
                <Link
                  key={call.id}
                  href={`/coach/discovery-calls/${call.id}`}
                  className="block bg-surface-1 rounded-xl border border-border p-3 lg:p-4 hover:bg-surface-2/50 transition-colors active:bg-surface-0"
                >
                  <div className="flex items-center gap-2.5 lg:gap-3">
                    {/* Left: Score */}
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      call.converted_to_enrollment ? 'bg-green-500/20' : 'bg-[#00ABFF]/20'
                    }`}>
                      <span className={`text-sm lg:text-lg font-bold ${
                        call.converted_to_enrollment ? 'text-green-400' : 'text-[#00ABFF]'
                      }`}>
                        {call.assessment_score || '-'}
                      </span>
                    </div>

                    {/* Middle: Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 lg:gap-2">
                        <p className="font-semibold text-sm lg:text-base text-white truncate">{call.child_name}</p>
                        <span className="text-[10px] lg:text-xs text-text-tertiary">({call.child_age}y)</span>
                      </div>
                      <p className="text-xs lg:text-sm text-text-tertiary truncate">{call.parent_name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-1.5 lg:px-2 py-0.5 rounded text-[10px] lg:text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {call.converted_to_enrollment && (
                          <span className="px-1.5 lg:px-2 py-0.5 rounded text-[10px] lg:text-xs font-medium bg-green-500/20 text-green-400">
                            Enrolled
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Action */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-xs lg:text-sm font-medium ${action.color} hidden sm:block`}>{action.text}</span>
                      <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-text-tertiary" />
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="bg-surface-1 rounded-xl border border-border p-8 lg:p-12 text-center">
              <Phone className="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-3 text-text-tertiary" />
              <p className="text-sm lg:text-base text-text-tertiary">No discovery calls found</p>
              <p className="text-xs text-text-tertiary mt-1">Check back later for new assignments</p>
            </div>
          )}
        </div>
      )}
      </div>
    </CoachLayout>
  );
}

