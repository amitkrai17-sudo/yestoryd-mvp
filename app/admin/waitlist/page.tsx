'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Users, Filter, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string;
  product_slug: string;
  child_name: string | null;
  child_age: number | null;
  source: string;
  status: 'pending' | 'notified' | 'converted';
  created_at: string;
  notified_at: string | null;
  converted_at: string | null;
  notes: string | null;
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProduct !== 'all') params.set('product', filterProduct);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const response = await fetch(`/api/waitlist?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Failed to fetch waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, [filterProduct, filterStatus]);

  const exportToCSV = () => {
    if (entries.length === 0) return;

    const headers = ['Name', 'Email', 'Phone', 'Product', 'Child Name', 'Child Age', 'Status', 'Source', 'Signed Up'];
    const rows = entries.map(e => [
      e.name,
      e.email,
      e.phone,
      e.product_slug,
      e.child_name || '',
      e.child_age?.toString() || '',
      e.status,
      e.source,
      new Date(e.created_at).toLocaleDateString('en-IN'),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `waitlist_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium">Pending</span>;
      case 'notified':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">Notified</span>;
      case 'converted':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">Converted</span>;
      default:
        return null;
    }
  };

  const formatProductName = (slug: string) => {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const totalSignups = Object.values(stats).reduce((a, b) => a + b, 0);
  const products = Object.keys(stats);

  return (
    <div className="bg-surface-0 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Launch Waitlist</h1>
            <p className="text-text-secondary">Users interested in paid programs (March 2026 launch)</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWaitlist}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-border rounded-lg text-text-secondary hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              disabled={entries.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/[0.08] rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalSignups}</p>
                <p className="text-text-tertiary text-sm">Total Signups</p>
              </div>
            </div>
          </div>

          {products.slice(0, 3).map(product => (
            <div key={product} className="bg-surface-2 border border-border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats[product]}</p>
                  <p className="text-text-tertiary text-sm capitalize">{formatProductName(product)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-tertiary" />
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:border-white/[0.30] outline-none"
            >
              <option value="all">All Products</option>
              {products.map(p => (
                <option key={p} value={p}>{formatProductName(p)}</option>
              ))}
            </select>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-white text-sm focus:border-white/[0.30] outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="notified">Notified</option>
            <option value="converted">Converted</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-text-tertiary animate-spin mx-auto mb-3" />
              <p className="text-text-secondary">Loading waitlist...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No waitlist entries yet</p>
              <p className="text-text-tertiary text-sm mt-1">Users who sign up will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-1">
                  <tr>
                    <th className="text-left p-4 text-text-secondary font-medium text-sm">Name</th>
                    <th className="text-left p-4 text-text-secondary font-medium text-sm">Contact</th>
                    <th className="text-left p-4 text-text-secondary font-medium text-sm">Product</th>
                    <th className="text-left p-4 text-text-secondary font-medium text-sm">Child</th>
                    <th className="text-left p-4 text-text-secondary font-medium text-sm">Status</th>
                    <th className="text-left p-4 text-text-secondary font-medium text-sm">Signed Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-1/50 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-white">{entry.name}</p>
                        <p className="text-text-tertiary text-xs">{entry.source}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-text-secondary text-sm">{entry.email}</p>
                        <p className="text-text-tertiary text-xs">{entry.phone}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-white/[0.08] text-gray-400 rounded text-xs font-medium capitalize">
                          {formatProductName(entry.product_slug)}
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary text-sm">
                        {entry.child_name ? (
                          <span>{entry.child_name}{entry.child_age ? `, ${entry.child_age}y` : ''}</span>
                        ) : (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="p-4 text-text-secondary text-sm">
                        {new Date(entry.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <p className="text-center text-text-tertiary text-sm mt-4">
            Showing {entries.length} entries
          </p>
        )}
      </div>
    </div>
  );
}
