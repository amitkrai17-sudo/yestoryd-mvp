'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  Filter,
  Calendar,
  User,
  XCircle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface QueueItem {
  id: string;
  session_id: string | null;
  enrollment_id: string | null;
  child_id: string | null;
  coach_id: string | null;
  child_name: string | null;
  coach_name: string | null;
  session_type: string | null;
  week_number: number | null;
  reason: string;
  attempts_made: number;
  status: 'pending' | 'in_progress' | 'resolved';
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Stats {
  pending: number;
  in_progress: number;
  resolved: number;
  total: number;
}

// ============================================================================
// RESOLVE MODAL
// ============================================================================

function ResolveModal({
  item,
  onClose,
  onResolved,
}: {
  item: QueueItem;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleResolve = async () => {
    if (!notes.trim()) {
      setError('Resolution notes are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const body: Record<string, string> = {
        queueId: item.id,
        notes: notes.trim(),
      };
      if (newDate) body.newDate = newDate;
      if (newTime) body.newTime = newTime;

      const res = await fetch('/api/admin/scheduling/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        onResolved();
        onClose();
      } else {
        setError(data.error || 'Failed to resolve');
      }
    } catch (e) {
      setError('Network error');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Resolve Queue Item</h3>
            <button onClick={onClose} className="text-text-muted hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Item Info */}
          <div className="bg-surface-0 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Child</span>
              <span className="text-white">{item.child_name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Session Type</span>
              <span className="text-white">{item.session_type || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Week</span>
              <span className="text-white">{item.week_number ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Attempts</span>
              <span className="text-white">{item.attempts_made}</span>
            </div>
            <div>
              <span className="text-text-secondary">Reason:</span>
              <p className="text-text-primary mt-1">{item.reason}</p>
            </div>
          </div>

          {/* Schedule (optional) */}
          <div>
            <label className="text-sm text-text-secondary block mb-2">New Date & Time (optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="flex-1 bg-surface-0 border border-border rounded-lg px-3 py-2 text-white text-sm"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 bg-surface-0 border border-border rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          {/* Resolution Notes */}
          <div>
            <label className="text-sm text-text-secondary block mb-2">Resolution Notes *</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe how this was resolved..."
              className="w-full bg-surface-0 border border-border rounded-lg px-3 py-2 text-white text-sm resize-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface-2 border border-border rounded-lg text-text-secondary hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SchedulingQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, in_progress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/admin/scheduling/queue?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.items || []);
        setStats(data.stats || { pending: 0, in_progress: 0, resolved: 0, total: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full text-xs font-medium">
            Pending
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-medium">
            In Progress
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-medium">
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  const formatSessionType = (type: string | null) => {
    if (!type) return 'N/A';
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="bg-surface-0 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Scheduling Queue</h1>
            <p className="text-text-secondary">Sessions that need manual scheduling</p>
          </div>
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-text-secondary hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Pending</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.in_progress}</p>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Resolved</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.resolved}</p>
          </div>
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface-1 rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-surface-0 border border-border rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-text-secondary">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p>No items in queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-0 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Child</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Week</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Attempts</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Created</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-text-muted" />
                          <div>
                            <p className="text-sm text-white font-medium">{item.child_name || 'Unknown'}</p>
                            <p className="text-xs text-text-muted">{item.coach_name || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {formatSessionType(item.session_type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {item.week_number ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-text-primary max-w-xs truncate" title={item.reason}>
                          {item.reason}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {item.attempts_made}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {new Date(item.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {item.status !== 'resolved' && (
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors"
                          >
                            Resolve
                          </button>
                        )}
                        {item.status === 'resolved' && item.resolution_notes && (
                          <span className="text-xs text-text-muted" title={item.resolution_notes}>
                            {item.resolution_notes.slice(0, 30)}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {selectedItem && (
        <ResolveModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onResolved={fetchQueue}
        />
      )}
    </div>
  );
}
