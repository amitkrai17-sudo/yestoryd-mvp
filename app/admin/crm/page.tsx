'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Phone, Mail, MessageCircle, Clock, Search, Download, 
  RefreshCw, UserCheck, XCircle, Sparkles, Plus, Calendar,
  Filter, ChevronDown, AlertCircle, User, X
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
  coach_id: string | null;
  lead_notes: string | null;
  assigned_to: string | null;
  lost_reason: string | null;
  latest_assessment: any;
  interaction_count: number;
  recent_interactions: any[];
}

interface Coach {
  id: string;
  name: string;
  email: string;
}

// ==================== CONSTANTS ====================
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  assessed: { label: 'Assessed', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  contacted: { label: 'Contacted', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  call_scheduled: { label: 'Call Scheduled', color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  call_done: { label: 'Call Done', color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  negotiating: { label: 'Negotiating', color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  enrolled: { label: 'Enrolled', color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500' },
  active: { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', color: 'text-gray-700', bg: 'bg-gray-100', dot: 'bg-gray-500' },
  lost: { label: 'Lost', color: 'text-red-700', bg: 'bg-red-50', dot: 'bg-red-500' },
};

const SOURCE_OPTIONS = [
  { value: 'website', label: '🌐 Website Assessment' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'phone', label: '📞 Phone Call' },
  { value: 'referral', label: '👥 Referral' },
  { value: 'social_media', label: '📱 Social Media' },
  { value: 'walk_in', label: '🚶 Walk-in/Event' },
  { value: 'other', label: '📝 Other' },
];

const LOST_REASONS = [
  'Too expensive',
  'Not the right time',
  'Chose competitor',
  'Child too young/old',
  'No response',
  'Other',
];

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0-12

// ==================== ADD LEAD MODAL ====================
function AddLeadModal({ onClose, onSave, existingPhones }: {
  onClose: () => void;
  onSave: (data: any) => Promise<{ success: boolean; error?: string; duplicate?: boolean }>;
  existingPhones: string[];
}) {
  const [form, setForm] = useState({
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    child_name: '',
    child_age: '',
    lead_source: 'whatsapp',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Check for duplicate phone
  const checkDuplicate = (phone: string) => {
    const normalized = phone.replace(/\D/g, '').slice(-10);
    const isDuplicate = existingPhones.some(p => p.replace(/\D/g, '').slice(-10) === normalized);
    setDuplicateWarning(isDuplicate);
  };

  const handleSubmit = async () => {
    if (!form.parent_name || !form.parent_phone || !form.child_name || !form.child_age) {
      setError('Please fill all required fields');
      return;
    }

    setSaving(true);
    setError('');

    const result = await onSave({
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      parent_email: form.parent_email,
      child_name: form.child_name,
      child_age: parseInt(form.child_age),
      lead_source: form.lead_source,
      lead_notes: form.notes,
      lead_status: 'assessed',
    });

    setSaving(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to create lead');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-bold text-gray-900 text-lg">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Parent Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Name *</label>
            <input
              type="text"
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              placeholder="Enter parent's name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={form.parent_phone}
                onChange={(e) => {
                  setForm({ ...form, parent_phone: e.target.value });
                  checkDuplicate(e.target.value);
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white ${duplicateWarning ? 'border-amber-500' : ''}`}
                placeholder="+91 9876543210"
              />
              {duplicateWarning && (
                <p className="text-xs text-amber-600 mt-1">⚠️ Phone may already exist</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.parent_email}
                onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Child Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Child Name *</label>
              <input
                type="text"
                value={form.child_name}
                onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                placeholder="Child's name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
              <select
                value={form.child_age}
                onChange={(e) => setForm({ ...form, child_age: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="">Select age</option>
                {AGE_OPTIONS.map(age => (
                  <option key={age} value={age}>{age} years</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lead Source *</label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, lead_source: opt.value })}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                    form.lead_source === opt.value
                      ? 'bg-blue-50 border-blue-500 border-2 text-blue-700'
                      : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white h-20 resize-none"
              placeholder="Any additional notes about this lead..."
            />
          </div>
        </div>

        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== LEAD DETAIL MODAL ====================
function LeadModal({ lead, coaches, onClose, onUpdate, onAddInteraction }: {
  lead: Lead;
  coaches: Coach[];
  onClose: () => void;
  onUpdate: (data: Partial<Lead>) => void;
  onAddInteraction: (data: any) => void;
}) {
  const [tab, setTab] = useState<'info' | 'history' | 'log'>('info');
  const [form, setForm] = useState({ type: 'call', summary: '', outcome: '' });
  const [saving, setSaving] = useState(false);
  const [followupDate, setFollowupDate] = useState(lead.next_followup_at?.slice(0, 16) || '');
  const [lostReason, setLostReason] = useState('');
  const [showLostModal, setShowLostModal] = useState(false);

  const handleSaveInteraction = async () => {
    if (!form.summary) return;
    setSaving(true);
    await onAddInteraction({ child_id: lead.id, ...form, direction: 'outbound', status: 'completed' });
    setForm({ type: 'call', summary: '', outcome: '' });
    setSaving(false);
    setTab('history');
  };

  const handleSetFollowup = () => {
    if (followupDate) {
      onUpdate({ next_followup_at: new Date(followupDate).toISOString() });
    }
  };

  const handleMarkLost = () => {
    onUpdate({ lead_status: 'lost', lost_reason: lostReason });
    setShowLostModal(false);
  };

  const isOverdue = lead.next_followup_at && new Date(lead.next_followup_at) < new Date();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">{lead.child_name || 'Unknown'}</h2>
              <p className="text-sm text-gray-500">{lead.parent_name} • {lead.parent_phone}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(STATUS_CONFIG).slice(0, 7).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => onUpdate({ lead_status: key })}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${
                  lead.lead_status === key
                    ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Assign Coach */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <select
              value={lead.assigned_to || ''}
              onChange={(e) => onUpdate({ assigned_to: e.target.value || null })}
              className="flex-1 text-sm border rounded-lg px-2 py-1.5 text-gray-900 bg-white"
            >
              <option value="">Unassigned</option>
              {coaches.map(c => (
                <option key={c.id} value={c.email}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Follow-up Warning */}
        {isOverdue && (
          <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-sm text-orange-700 font-medium">Follow-up overdue!</span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-3 border-b flex gap-2">
          <a href={`tel:${lead.parent_phone}`} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-1">
            <Phone className="w-4 h-4" />Call
          </a>
          <a href={`https://wa.me/${(lead.parent_phone || '').replace(/\D/g, '')}`} target="_blank" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-1">
            <MessageCircle className="w-4 h-4" />WhatsApp
          </a>
          <a href={`mailto:${lead.parent_email}`} className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-1">
            <Mail className="w-4 h-4" />Email
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'info', label: 'Details' },
            { id: 'history', label: 'History' },
            { id: 'log', label: '+ Log' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'info' && (
            <div className="space-y-4">
              {/* Info Grid */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Age</span><span className="font-medium">{lead.age || '?'} years</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="font-medium capitalize">{lead.lead_source || 'Website'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Assessed</span><span className="font-medium">{lead.assessed_at ? new Date(lead.assessed_at).toLocaleDateString() : '-'}</span></div>
                {lead.coach_name && <div className="flex justify-between"><span className="text-gray-500">Coach</span><span className="font-medium">{lead.coach_name}</span></div>}
                {lead.lead_notes && <div className="pt-2 border-t"><span className="text-gray-500 block mb-1">Notes</span><span className="text-gray-700">{lead.lead_notes}</span></div>}
              </div>

              {/* Follow-up Reminder */}
              <div className="bg-blue-50 rounded-lg p-3">
                <label className="text-sm font-medium text-blue-800 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  Set Follow-up Reminder
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                  />
                  <button
                    onClick={handleSetFollowup}
                    disabled={!followupDate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Set
                  </button>
                </div>
                {lead.next_followup_at && (
                  <p className="text-xs text-blue-600 mt-2">
                    Current: {new Date(lead.next_followup_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Mark as Lost */}
              {lead.lead_status !== 'lost' && lead.lead_status !== 'active' && lead.lead_status !== 'completed' && (
                <button
                  onClick={() => setShowLostModal(true)}
                  className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  Mark as Lost
                </button>
              )}

              {lead.lost_reason && (
                <div className="bg-red-50 rounded-lg p-3 text-sm">
                  <span className="text-red-700 font-medium">Lost Reason:</span>
                  <span className="text-red-600 ml-2">{lead.lost_reason}</span>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {lead.recent_interactions && lead.recent_interactions.length > 0 ? (
                lead.recent_interactions.map((i: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-blue-200 pl-3 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{i.type}</span>
                      {i.outcome && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{i.outcome}</span>}
                      <span className="text-xs text-gray-400 ml-auto">{new Date(i.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{i.summary}</p>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No interactions yet</p>
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
                <option value="meeting">🤝 Meeting</option>
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
                <option value="">Outcome (optional)</option>
                <option value="interested">✅ Interested</option>
                <option value="callback">📅 Callback requested</option>
                <option value="enrolled">🎉 Enrolled</option>
                <option value="not_interested">❌ Not interested</option>
                <option value="no_response">📵 No response</option>
              </select>

              <button
                onClick={handleSaveInteraction}
                disabled={!form.summary || saving}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Interaction'}
              </button>
            </div>
          )}
        </div>

        {/* Lost Reason Modal */}
        {showLostModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-4 w-full max-w-sm">
              <h3 className="font-bold text-gray-900 mb-3">Why was this lead lost?</h3>
              <div className="space-y-2 mb-4">
                {LOST_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setLostReason(reason)}
                    className={`w-full px-3 py-2 rounded-lg text-sm text-left ${
                      lostReason === reason ? 'bg-red-100 text-red-700 border-2 border-red-500' : 'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowLostModal(false)} className="flex-1 py-2 border rounded-lg text-gray-700">Cancel</button>
                <button onClick={handleMarkLost} disabled={!lostReason} className="flex-1 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">Mark Lost</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function AdminCRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, coachesRes] = await Promise.all([
        fetch('/api/admin/crm/leads'),
        fetch('/api/admin/crm/coaches'),
      ]);
      
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
      }
      if (coachesRes.ok) {
        const data = await coachesRes.json();
        setCoaches(data.coaches || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const createLead = async (data: any) => {
    try {
      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok) {
        fetchData();
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  };

  const updateLead = async (id: string, data: Partial<Lead>) => {
    try {
      await fetch('/api/admin/crm/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      setLeads(leads.map(l => l.id === id ? { ...l, ...data } : l));
      if (selected?.id === id) setSelected({ ...selected, ...data });
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
      fetchData();
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

  // Filter & Sort
  const filtered = leads
    .filter(l => {
      const matchSearch = (l.child_name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (l.parent_name || '').toLowerCase().includes(search.toLowerCase()) ||
                         (l.parent_phone || '').includes(search);
      const matchStatus = statusFilter === 'all' || l.lead_status === statusFilter;
      const matchSource = sourceFilter === 'all' || l.lead_source === sourceFilter;
      return matchSearch && matchStatus && matchSource;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime();
      if (sortBy === 'oldest') return new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime();
      if (sortBy === 'followup') {
        if (!a.next_followup_at) return 1;
        if (!b.next_followup_at) return -1;
        return new Date(a.next_followup_at).getTime() - new Date(b.next_followup_at).getTime();
      }
      return 0;
    });

  // Stats
  const stats = {
    total: leads.length,
    today: leads.filter(l => l.assessed_at?.startsWith(new Date().toISOString().split('T')[0])).length,
    active: leads.filter(l => l.lead_status === 'active').length,
    conversion: leads.length > 0 ? Math.round((leads.filter(l => ['enrolled', 'active', 'completed'].includes(l.lead_status)).length / leads.length) * 100) : 0,
    followups: leads.filter(l => l.next_followup_at && new Date(l.next_followup_at) <= new Date()).length,
  };

  const existingPhones = leads.map(l => l.parent_phone).filter(Boolean);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-sm text-gray-500">Track and convert inquiries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" />Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'bg-blue-500' },
          { label: 'Today', value: stats.today, icon: Sparkles, color: 'bg-purple-500' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'bg-green-500' },
          { label: 'Convert', value: `${stats.conversion}%`, icon: Filter, color: 'bg-indigo-500' },
          { label: 'Follow-up', value: stats.followups, icon: Clock, color: 'bg-orange-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm text-gray-900 bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${showFilters ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white text-gray-700'}`}
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
          >
            <option value="all">All Sources</option>
            {SOURCE_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="followup">Follow-up Due</option>
          </select>
          <button
            onClick={() => { setStatusFilter('all'); setSourceFilter('all'); setSortBy('newest'); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        </div>
      )}

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
                const isOverdue = lead.next_followup_at && new Date(lead.next_followup_at) < new Date();
                const sourceLabel = SOURCE_OPTIONS.find(s => s.value === lead.lead_source)?.label || lead.lead_source;
                
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cfg.dot}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{lead.child_name || 'Unknown'}</p>
                            <span className="text-xs text-gray-400">({lead.age || '?'}y)</span>
                            {isOverdue && (
                              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                <AlertCircle className="w-3 h-3" />
                                Follow-up due
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{lead.parent_name}</p>
                          <p className="text-xs text-gray-400">{lead.parent_phone}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {lead.assessed_at ? new Date(lead.assessed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{sourceLabel?.replace(/[^\w\s]/g, '')}</p>
                      </div>
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

      {/* Modals */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSave={createLead}
          existingPhones={existingPhones}
        />
      )}

      {selected && (
        <LeadModal
          lead={selected}
          coaches={coaches}
          onClose={() => setSelected(null)}
          onUpdate={(data) => updateLead(selected.id, data)}
          onAddInteraction={addInteraction}
        />
      )}
    </div>
  );
}
