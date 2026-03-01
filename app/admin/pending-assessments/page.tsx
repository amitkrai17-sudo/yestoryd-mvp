// file: app/admin/pending-assessments/page.tsx
// Admin page for monitoring pending and failed assessments
// Shows assessments queued for AI retry + failed assessments needing manual intervention

'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  Trash2,
  RotateCcw,
  Mail,
  Baby,
  Calendar,
  FileText,
} from 'lucide-react';

interface PendingAssessment {
  id: string;
  child_name: string;
  child_age: number;
  parent_email: string;
  parent_name: string | null;
  parent_phone: string | null;
  passage: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  retry_count: number;
  error_message: string | null;
  ai_provider_used: string | null;
  created_at: string;
  processed_at: string | null;
  lead_source: string | null;
  lead_source_coach_id: string | null;
}

interface Stats {
  pending: number;
  processing: number;
  failed: number;
  total: number;
}

export default function PendingAssessmentsPage() {
  const [assessments, setAssessments] = useState<PendingAssessment[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, processing: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'failed'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pending-assessments');
      const data = await res.json();

      if (data.success) {
        setAssessments(data.assessments);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch pending assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handleAction = async (assessmentId: string, action: 'retry' | 'delete') => {
    if (action === 'delete' && !confirm('Are you sure you want to delete this assessment?')) {
      return;
    }

    setActionLoading(assessmentId);
    try {
      const res = await fetch('/api/admin/pending-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingAssessmentId: assessmentId, action }),
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        fetchAssessments();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAssessments =
    filter === 'all'
      ? assessments
      : assessments.filter((a) => a.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Assessments</h1>
          <p className="text-gray-600 text-sm mt-1">
            Monitor AI processing failures and retry queue
          </p>
        </div>
        <button
          onClick={fetchAssessments}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Awaiting Retry</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Processing Now</p>
              <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Failed (Max Retries)</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'processing', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-white text-[#0a0a0f]'
                : 'bg-surface-2 text-text-secondary border border-border hover:bg-surface-3'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                {stats[f as keyof Omit<Stats, 'total'>]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Assessment List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 mb-3 text-green-500" />
            <p className="text-lg font-medium">All assessments processed!</p>
            <p className="text-sm">No pending or failed assessments at the moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Child
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Parent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Retries
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Error
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAssessments.map((assessment) => (
                  <tr key={assessment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{assessment.child_name}</p>
                          <p className="text-xs text-gray-500">{assessment.child_age} years</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">{assessment.parent_name || 'N/A'}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {assessment.parent_email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(assessment.status)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-semibold ${
                          assessment.retry_count >= 3 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {assessment.retry_count} / 3
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {formatDate(assessment.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {assessment.error_message ? (
                        <div className="text-xs text-red-600 max-w-xs truncate" title={assessment.error_message}>
                          {assessment.error_message}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No error</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAction(assessment.id, 'retry')}
                          disabled={actionLoading === assessment.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-[#0a0a0f] text-xs font-medium rounded hover:bg-gray-200 disabled:opacity-50"
                        >
                          {actionLoading === assessment.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Retry
                        </button>
                        <button
                          onClick={() => handleAction(assessment.id, 'delete')}
                          disabled={actionLoading === assessment.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-6 bg-white/[0.06] border border-white/[0.08] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>When Gemini API fails, assessments are automatically queued for retry (5-min delay)</li>
              <li>System retries up to 3 times with exponential backoff</li>
              <li>After 3 failed retries, assessments are marked as "failed" and appear here</li>
              <li>Use "Retry" to manually trigger another attempt for failed assessments</li>
              <li>Results are emailed to parents automatically when processing succeeds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
