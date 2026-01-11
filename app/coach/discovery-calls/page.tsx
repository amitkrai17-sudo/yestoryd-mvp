'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone, MessageCircle, Calendar, Clock, Users, ChevronRight, RefreshCw } from 'lucide-react';

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
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  scheduled: { label: 'Scheduled', color: 'text-blue-700', bg: 'bg-blue-50' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-50' },
  no_show: { label: 'No Show', color: 'text-red-700', bg: 'bg-red-50' },
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
    if (call.converted_to_enrollment) return { text: 'Enrolled ✓', color: 'text-green-600' };
    if (call.followup_sent_at) return { text: 'Followed Up', color: 'text-purple-600' };
    if (call.payment_link_sent_at) return { text: 'Payment Sent', color: 'text-blue-600' };
    if (call.status === 'completed') return { text: 'Fill Form', color: 'text-pink-600' };
    if (call.status === 'scheduled') return { text: 'View', color: 'text-blue-600' };
    return { text: 'View', color: 'text-gray-400' };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">My Discovery Calls</h1>
          <p className="text-sm text-gray-500">Manage your assigned calls</p>
        </div>
        <button 
          onClick={fetchCalls} 
          disabled={loading}
          className="p-2 hover:bg-gray-700 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats - Mobile optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: calls.length, icon: Users, color: 'bg-blue-500' },
          { label: 'Scheduled', value: calls.filter(c => c.status === 'scheduled').length, icon: Calendar, color: 'bg-purple-500' },
          { label: 'Completed', value: calls.filter(c => c.status === 'completed').length, icon: Clock, color: 'bg-green-500' },
          { label: 'Converted', value: calls.filter(c => c.converted_to_enrollment).length, icon: Users, color: 'bg-pink-500' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-800 rounded-xl border p-3 sm:p-4 flex items-center gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 ${s.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <s.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs - Scrollable on mobile */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { key: 'all', label: 'All' },
          { key: 'scheduled', label: 'Scheduled' },
          { key: 'completed', label: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap text-sm transition-colors ${
              filter === tab.key
                ? 'bg-pink-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-pink-600" />
        </div>
      )}

      {/* Calls List */}
      {!loading && (
        <div className="space-y-3">
          {calls.length > 0 ? (
            calls.map((call) => {
              const statusCfg = STATUS_CONFIG[call.status] || STATUS_CONFIG.pending;
              const action = getActionLabel(call);
              
              return (
                <Link
                  key={call.id}
                  href={`/coach/discovery-calls/${call.id}`}
                  className="block bg-gray-800 rounded-xl border p-4 hover:shadow-md transition-shadow active:bg-[#0f1419]"
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Score + Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        call.converted_to_enrollment ? 'bg-green-100' : 'bg-pink-100'
                      }`}>
                        <span className={`text-lg font-bold ${
                          call.converted_to_enrollment ? 'text-green-600' : 'text-pink-600'
                        }`}>
                          {call.assessment_score || '-'}
                        </span>
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white truncate">{call.child_name}</p>
                          <span className="text-xs text-gray-400">({call.child_age}y)</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{call.parent_name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          {call.converted_to_enrollment && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                              ✓ Enrolled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right: Action */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-sm font-medium ${action.color} hidden sm:block`}>{action.text}</span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="bg-gray-800 rounded-xl border p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No discovery calls found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
