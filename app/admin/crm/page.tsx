'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Phone, Mail, MessageCircle, Clock, Search, Download, 
  RefreshCw, UserCheck, XCircle, Sparkles
} from 'lucide-react';

// ==================== TYPES ====================
interface Lead {
  id: string;
  child_name: string;
  age: number;
  lead_status: string;
  lead_source: string;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  assessed_at: string;
  enrolled_at: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  coach_name: string | null;
  lead_notes: string | null;
  lead_source: string;
  assigned_to: string | null;
  latest_assessment: any;
  interaction_count: number;
  recent_interactions: any[];
}

// ==================== CONSTANTS ====================
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  assessed: { label: 'Assessed', color: 'text-blue-700', bg: 'bg-blue-100' },
  contacted: { label: 'Contacted', color: 'text-amber-700', bg: 'bg-amber-100' },
  call_scheduled: { label: 'Call Scheduled', color: 'text-purple-700', bg: 'bg-purple-100' },
  call_done: { label: 'Call Done', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  enrolled: { label: 'Enrolled', color: 'text-green-700', bg: 'bg-green-100' },
  active: { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  completed: { label: 'Completed', color: 'text-gray-700', bg: 'bg-gray-100' },
  churned: { label: 'Churned', color: 'text-red-700', bg: 'bg-red-100' },
};

// ==================== LEAD DETAIL MODAL ====================
function LeadModal({ lead, onClose, onStatusChange, onAddInteraction }: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onAddInteraction: (data: any) => void;
}) {
  const [tab, setTab] = useState<'info' | 'log'>('info');
  const [form, setForm] = useState({ type: 'call', summary: '', outcome: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.summary) return;
    setSaving(true);
    await onAddInteraction({ child_id: lead.id, ...form, direction: 'outbound', status: 'completed' });
    setForm({ type: 'call', summary: '', outcome: '' });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-start">
          <div>
            <h2 className="font-bold text-gray-900">{lead.child_name || 'Unknown'}</h2>
            <p className="text-sm text-gray-500">{lead.parent_name || 'No parent'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Status buttons */}
        <div className="p-3 border-b flex flex-wrap gap-1">
          {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => onStatusChange(key)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                lead.lead_status === key ? `${cfg.bg} ${cfg.color}` : 'bg-gray-100 text-gray-500'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab('info')}
            className={`flex-1 py-2 text-sm font-medium ${tab === 'info' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Details
          </button>
          <button
            onClick={() => setTab('log')}
            className={`flex-1 py-2 text-sm font-medium ${tab === 'log' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            + Log
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'info' && (
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="flex gap-2">
                <a href={`tel:${lead.parent_phone}`} className="flex-1 bg-blue-600 text-white py-2 rounded text-center text-sm font-medium">
                  <Phone className="w-4 h-4 inline mr-1" />Call
                </a>
                <a href={`https://wa.me/${(lead.parent_phone || '').replace(/\D/g, '')}`} target="_blank" className="flex-1 bg-green-600 text-white py-2 rounded text-center text-sm font-medium">
                  <MessageCircle className="w-4 h-4 inline mr-1" />WhatsApp
                </a>
              </div>

              {/* Info grid */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{lead.parent_phone || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="truncate ml-2">{lead.parent_email || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Age</span><span>{lead.age || '?'} years</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Assessed</span><span>{lead.assessed_at ? new Date(lead.assessed_at).toLocaleDateString() : '-'}</span></div>
              </div>

              {/* Interactions */}
              {lead.recent_interactions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
                  <div className="space-y-2">
                    {lead.recent_interactions.slice(0, 3).map((i: any, idx: number) => (
                      <div key={idx} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">{i.type}</span>
                        <p className="text-gray-600 mt-1">{i.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'log' && (
            <div className="space-y-3">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="call">📞 Call</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="email">📧 Email</option>
                <option value="note">📝 Note</option>
              </select>
              
              <textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="What happened?"
                className="w-full border rounded-lg px-3 py-2 text-sm h-24 text-gray-900 bg-white"
              />
              
              <select
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="">Outcome...</option>
                <option value="interested">✅ Interested</option>
                <option value="callback">📅 Callback</option>
                <option value="enrolled">🎉 Enrolled</option>
                <option value="not_interested">❌ Not interested</option>
              </select>
              
              <button
                onClick={handleSave}
                disabled={!form.summary || saving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function AdminCRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/admin/crm/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lead_status: status }),
      });
      setLeads(leads.map(l => l.id === id ? { ...l, lead_status: status } : l));
      if (selected?.id === id) setSelected({ ...selected, lead_status: status });
    } catch (e) {
      console.error(e);
    }
  };

  const addInteraction = async (data: any) => {
    try {
      await fetch('/api/admin/crm/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      fetchLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const exportCSV = async () => {
    const res = await fetch('/api/admin/crm/export');
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  const filtered = leads.filter(l => {
    const matchSearch = (l.child_name || '').toLowerCase().includes(search.toLowerCase()) ||
                       (l.parent_name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || l.lead_status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: leads.length,
    today: leads.filter(l => l.assessed_at?.startsWith(new Date().toISOString().split('T')[0])).length,
    active: leads.filter(l => l.lead_status === 'active').length,
    followups: leads.filter(l => l.next_followup_at && new Date(l.next_followup_at) <= new Date()).length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-sm text-gray-500">Track and convert inquiries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLeads} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Download className="w-4 h-4" />Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Leads', value: stats.total, icon: Users, color: 'bg-blue-500' },
          { label: 'Today', value: stats.today, icon: Sparkles, color: 'bg-purple-500' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'bg-green-500' },
          { label: 'Follow-ups', value: stats.followups, icon: Clock, color: 'bg-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm text-gray-900 bg-white"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm text-gray-900 bg-white min-w-[140px]"
        >
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      )}

      {/* Lead List */}
      {!loading && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {filtered.length > 0 ? (
            <div className="divide-y">
              {filtered.map((lead) => {
                const cfg = STATUS_CONFIG[lead.lead_status] || STATUS_CONFIG.assessed;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{lead.child_name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500 truncate">{lead.parent_name || 'No parent'}</p>
                      <p className="text-xs text-gray-400">{lead.parent_phone || 'No phone'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {lead.assessed_at ? new Date(lead.assessed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No leads found</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <LeadModal
          lead={selected}
          onClose={() => setSelected(null)}
          onStatusChange={(s) => updateStatus(selected.id, s)}
          onAddInteraction={addInteraction}
        />
      )}
    </div>
  );
}