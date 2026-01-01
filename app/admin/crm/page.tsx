// file: app/admin/crm/page.tsx
// Admin CRM with Lead Source Visibility + Support Tickets Tab
// UPDATED: Auto-assignment badges + filtered coach dropdown
// Shows source column: Yestoryd or Coach (Name)

'use client';

import { useState, useEffect } from 'react';
import {
  Search, Filter, Phone, Mail, MessageCircle, Calendar,
  ChevronDown, X, Users, TrendingUp, Clock, CheckCircle,
  UserPlus, Eye, ExternalLink, RefreshCw, HelpCircle,
  Zap, User, AlertCircle
} from 'lucide-react';
import SupportTicketsTab from '@/components/admin/SupportTicketsTab';

// Types
interface Coach {
  id: string;
  name: string;
  email: string;
  referral_code?: string;
  is_available?: boolean;
  is_active?: boolean;
  exit_status?: string | null;
}

interface Lead {
  id: string;
  name: string;
  age: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  lead_status: string;
  lead_source: string;
  lead_source_coach_id: string | null;
  lead_source_coach?: Coach | null;
  assigned_coach?: Coach | null;
  coach_id: string | null;
  source_display: string;
  source_type: string;
  referrer_name: string | null;
  referrer_code: string | null;
  created_at: string;
  latest_assessment_score: number | null;
  lead_notes: string;
}

interface Stats {
  total: number;
  yestoryd_leads: number;
  coach_leads: number;
  enrolled: number;
  pending: number;
}

interface DiscoveryCall {
  id: string;
  child_name: string;
  child_age: number;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  scheduled_time: string;
  status: string;
  assigned_coach_id: string | null;
  assigned_coach?: Coach | null;
  assessment_score: number | null;
  call_status: string;
  questionnaire_data: Record<string, unknown> | null;
  payment_link_sent_at: string | null;
  followup_sent_at: string | null;
  converted_to_enrollment: boolean;
  created_at: string;
  assignment_type?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  assessed: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  call_scheduled: 'bg-purple-100 text-purple-700',
  call_done: 'bg-indigo-100 text-indigo-700',
  enrolled: 'bg-green-100 text-green-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-700',
  lost: 'bg-red-100 text-red-700',
  churned: 'bg-red-100 text-red-700',
};

// Assignment Type Badge Component
function AssignmentBadge({ type }: { type: string | null | undefined }) {
  if (type === 'auto') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        <Zap className="w-3 h-3" />
        Auto
      </span>
    );
  }
  if (type === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
        <User className="w-3 h-3" />
        Manual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
      <AlertCircle className="w-3 h-3" />
      Pending
    </span>
  );
}

// Lead Source Badge Component
function LeadSourceBadge({ lead }: { lead: Lead }) {
  if (lead.lead_source === 'coach' && lead.referrer_name) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
          <UserPlus className="w-3 h-3" />
          Coach
        </span>
        <span className="text-xs text-gray-600 truncate max-w-[100px]" title={lead.referrer_name}>
          {lead.referrer_name}
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <TrendingUp className="w-3 h-3" />
      Yestoryd
    </span>
  );
}

// Lead Detail Modal
function LeadModal({
  lead,
  coaches,
  onClose,
  onUpdate
}: {
  lead: Lead;
  coaches: Coach[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [status, setStatus] = useState(lead.lead_status);
  const [assignedCoach, setAssignedCoach] = useState(lead.coach_id || '');
  const [notes, setNotes] = useState(lead.lead_notes || '');
  const [saving, setSaving] = useState(false);

  const availableCoaches = coaches.filter((c) => {
    return c.is_active !== false && c.is_available !== false && c.exit_status !== 'pending';
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_status: status,
          coach_id: assignedCoach || null,
          lead_notes: notes,
        }),
      });

      if (res.ok) {
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error updating lead:', error);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{lead.name}</h2>
            <p className="text-sm text-gray-500">Age {lead.age} - {lead.parent_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Lead Source</h3>
            <div className="flex items-center gap-3">
              <LeadSourceBadge lead={lead} />
              {lead.referrer_code && (
                <span className="text-xs text-gray-500">Code: {lead.referrer_code}</span>
              )}
            </div>
            {lead.lead_source === 'coach' && lead.referrer_name && (
              <p className="text-sm text-gray-600 mt-2">
                Lead bonus (20%) goes to <strong>{lead.referrer_name}</strong> on enrollment
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Email</label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${lead.parent_email}`} className="text-sm text-blue-600 hover:underline">
                  {lead.parent_email}
                </a>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Phone</label>
              <div className="flex items-center gap-2 mt-1">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${lead.parent_phone}`} className="text-sm text-blue-600 hover:underline">
                  {lead.parent_phone}
                </a>
              </div>
            </div>
          </div>

          {lead.latest_assessment_score !== null && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Assessment Score</label>
              <div className="mt-1">
                <span className={`text-2xl font-bold ${
                  lead.latest_assessment_score >= 7 ? 'text-green-600' :
                  lead.latest_assessment_score >= 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {lead.latest_assessment_score}/10
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500"
            >
              <option value="assessed">Assessed</option>
              <option value="contacted">Contacted</option>
              <option value="call_scheduled">Call Scheduled</option>
              <option value="call_done">Call Done</option>
              <option value="enrolled">Enrolled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Assigned Coach</label>
            <select
              value={assignedCoach}
              onChange={(e) => setAssignedCoach(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Unassigned</option>
              {availableCoaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.name} ({coach.email})
                </option>
              ))}
            </select>
            {availableCoaches.length < coaches.length && (
              <p className="text-xs text-gray-500 mt-1">
                {coaches.length - availableCoaches.length} coach(es) hidden (unavailable/exiting)
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500"
              placeholder="Add notes about this lead..."
            />
          </div>

          <div className="flex gap-2">
            <a
              href={`tel:${lead.parent_phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Phone className="w-4 h-4" /> Call
            </a>
            <a
              href={`https://wa.me/91${(lead.parent_phone || '').replace(/\D/g, '')}`}
              target="_blank"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a
              href={`mailto:${lead.parent_email}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Mail className="w-4 h-4" /> Email
            </a>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Discovery Call Modal
function DiscoveryCallModal({
  call,
  coaches,
  onClose,
  onUpdate,
}: {
  call: DiscoveryCall;
  coaches: Coach[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [assignedCoach, setAssignedCoach] = useState(call.assigned_coach_id || '');
  const [saving, setSaving] = useState(false);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);

  const availableCoaches = coaches.filter((c) => {
    return c.is_active !== false && c.is_available !== false && c.exit_status !== 'pending';
  });

  const handleAssignCoach = async () => {
    if (!assignedCoach) return;
    setSaving(true);
    try {
      const res = await fetch('/api/discovery-call/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discovery_call_id: call.id,
          coach_id: assignedCoach,
        }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error assigning coach:', error);
    }
    setSaving(false);
  };

  const handleSendPaymentLink = async () => {
    setSendingPaymentLink(true);
    try {
      const res = await fetch(`/api/discovery-call/${call.id}/send-payment-link`, {
        method: 'POST',
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error sending payment link:', error);
    }
    setSendingPaymentLink(false);
  };

  const handleSendFollowup = async () => {
    setSendingFollowup(true);
    try {
      const res = await fetch(`/api/discovery-call/${call.id}/send-followup`, {
        method: 'POST',
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error sending followup:', error);
    }
    setSendingFollowup(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{call.child_name}</h2>
            <p className="text-sm text-gray-500">Age {call.child_age} - {call.parent_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">
              {new Date(call.scheduled_time).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500">Assignment:</span>
              <div className="flex items-center gap-2 mt-1">
                <AssignmentBadge type={call.assignment_type} />
                {call.assigned_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(call.assigned_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            </div>
            {call.assigned_by && (
              <span className="text-xs text-gray-500">by {call.assigned_by}</span>
            )}
          </div>

          {call.assessment_score !== null && (
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-sm text-gray-500">Assessment Score:</span>
              <span className={`ml-2 text-lg font-bold ${
                call.assessment_score >= 7 ? 'text-green-600' :
                call.assessment_score >= 5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {call.assessment_score}/10
              </span>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              {call.assigned_coach_id ? 'Reassign Coach' : 'Assign Coach'}
            </label>
            <div className="flex gap-2 mt-1">
              <select
                value={assignedCoach}
                onChange={(e) => setAssignedCoach(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-gray-900 bg-white"
              >
                <option value="">Select Coach</option>
                {availableCoaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignCoach}
                disabled={!assignedCoach || saving}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
              >
                {saving ? '...' : call.assigned_coach_id ? 'Reassign' : 'Assign'}
              </button>
            </div>
            {availableCoaches.length < coaches.length && (
              <p className="text-xs text-gray-500 mt-1">
                {coaches.length - availableCoaches.length} coach(es) hidden (unavailable/exiting)
              </p>
            )}
          </div>

          <div className="space-y-2 pt-4">
            {call.call_status === 'completed' && !call.payment_link_sent_at && (
              <button
                onClick={handleSendPaymentLink}
                disabled={sendingPaymentLink}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                {sendingPaymentLink ? 'Sending...' : 'Send Payment Link via WhatsApp'}
              </button>
            )}

            {call.payment_link_sent_at && !call.followup_sent_at && !call.converted_to_enrollment && (
              <button
                onClick={handleSendFollowup}
                disabled={sendingFollowup}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                {sendingFollowup ? 'Sending...' : 'Send 24hr Follow-up'}
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <a href={`tel:${call.parent_phone}`} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-1">
              <Phone className="w-4 h-4" />Call
            </a>
            <a href={`https://wa.me/91${(call.parent_phone || '').replace(/\D/g, '')}`} target="_blank" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-1">
              <MessageCircle className="w-4 h-4" />WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminCRMPage() {
  const [activeTab, setActiveTab] = useState<'leads' | 'discovery' | 'support'>('leads');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, yestoryd_leads: 0, coach_leads: 0, enrolled: 0, pending: 0 });
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);

  const [discoveryCalls, setDiscoveryCalls] = useState<DiscoveryCall[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<DiscoveryCall | null>(null);
  const [discoveryFilter, setDiscoveryFilter] = useState('all');

  const [supportTicketCount, setSupportTicketCount] = useState(0);
  const [adminEmail, setAdminEmail] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const pendingAssignments = discoveryCalls.filter(c => !c.assigned_coach_id || c.assignment_type === 'pending').length;

  useEffect(() => {
    fetchData();
    fetchDiscoveryCalls();
    fetchSupportTicketCount();
    fetchAdminEmail();
  }, [sourceFilter, statusFilter]);

  const fetchAdminEmail = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setAdminEmail(user.email);
      }
    } catch (e) {
      console.error('Error getting admin email:', e);
    }
  };

  const fetchSupportTicketCount = async () => {
    try {
      const res = await fetch('/api/support/tickets?email=admin&admin=true&status=open');
      if (res.ok) {
        const data = await res.json();
        setSupportTicketCount(data.count || 0);
      }
    } catch (e) {
      console.error('Error fetching support tickets count:', e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const [leadsRes, coachesRes] = await Promise.all([
        fetch(`/api/admin/crm/leads?${params.toString()}`),
        fetch('/api/admin/crm/coaches?include_availability=true'),
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
        setStats(data.stats || { total: 0, yestoryd_leads: 0, coach_leads: 0, enrolled: 0, pending: 0 });
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

  const fetchDiscoveryCalls = async () => {
    setDiscoveryLoading(true);
    try {
      const res = await fetch(`/api/discovery-call/pending?status=${discoveryFilter === 'all' ? '' : discoveryFilter}`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveryCalls(data.calls || []);
      }
    } catch (e) {
      console.error(e);
    }
    setDiscoveryLoading(false);
  };

  const filteredLeads = leads.filter(lead => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(searchLower) ||
      lead.parent_email?.toLowerCase().includes(searchLower) ||
      lead.parent_phone?.includes(search) ||
      lead.parent_name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
            <button
              onClick={() => { fetchData(); fetchDiscoveryCalls(); fetchSupportTicketCount(); }}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                activeTab === 'leads' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Leads ({stats.total})
            </button>
            <button
              onClick={() => setActiveTab('discovery')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
                activeTab === 'discovery' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Discovery Calls ({discoveryCalls.length})
              {pendingAssignments > 0 && (
                <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingAssignments}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('support')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
                activeTab === 'support' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Support
              {supportTicketCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {supportTicketCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'leads' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Users className="w-4 h-4" />
                  Total Leads
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Yestoryd Leads
                </div>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.yestoryd_leads}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-center gap-2 text-orange-600 text-sm">
                  <UserPlus className="w-4 h-4" />
                  Coach Referrals
                </div>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.coach_leads}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-center gap-2 text-blue-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Enrolled
                </div>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats.enrolled}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border">
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Clock className="w-4 h-4" />
                  Pending
                </div>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 mb-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Source:</span>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="all">All Sources</option>
                    <option value="yestoryd">Yestoryd</option>
                    <option value="coach">Coach Referrals</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="assessed">Assessed</option>
                    <option value="contacted">Contacted</option>
                    <option value="call_scheduled">Call Scheduled</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="active">Active</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                {(sourceFilter !== 'all' || statusFilter !== 'all' || search) && (
                  <button
                    onClick={() => {
                      setSourceFilter('all');
                      setStatusFilter('all');
                      setSearch('');
                    }}
                    className="text-sm text-pink-600 hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading leads...</div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No leads found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Child</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Coach</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{lead.name}</div>
                            <div className="text-sm text-gray-500">Age {lead.age}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{lead.parent_name}</div>
                            <div className="text-xs text-gray-500">{lead.parent_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <LeadSourceBadge lead={lead} />
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.lead_status] || 'bg-gray-100 text-gray-700'}`}>
                              {lead.lead_status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {lead.latest_assessment_score !== null ? (
                              <span className={`font-semibold ${
                                lead.latest_assessment_score >= 7 ? 'text-green-600' :
                                lead.latest_assessment_score >= 5 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {lead.latest_assessment_score}/10
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {lead.assigned_coach?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(lead.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelected(lead)}
                              className="flex items-center gap-1 text-pink-600 hover:text-pink-700 text-sm font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'discovery' ? (
          <>
            {pendingAssignments > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-orange-800">
                    {pendingAssignments} call{pendingAssignments > 1 ? 's' : ''} need{pendingAssignments === 1 ? 's' : ''} manual assignment
                  </p>
                  <p className="text-sm text-orange-700">
                    No eligible coaches were available for auto-assignment. Please assign manually.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {['all', 'pending', 'scheduled', 'completed'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setDiscoveryFilter(filter);
                    fetchDiscoveryCalls();
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    discoveryFilter === filter
                      ? 'bg-pink-100 text-pink-700'
                      : 'bg-white text-gray-600 border hover:bg-gray-50'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border overflow-hidden">
              {discoveryLoading ? (
                <div className="p-8 text-center text-gray-500">Loading discovery calls...</div>
              ) : discoveryCalls.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No discovery calls found</div>
              ) : (
                <div className="divide-y">
                  {discoveryCalls.map((call) => {
                    const isPending = !call.assigned_coach_id || call.assignment_type === 'pending';
                    return (
                      <div
                        key={call.id}
                        onClick={() => setSelectedCall(call)}
                        className={`p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                          isPending ? 'bg-orange-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isPending && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{call.child_name}</div>
                            <div className="text-sm text-gray-500">
                              {call.parent_name} - {new Date(call.scheduled_time).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <AssignmentBadge type={call.assignment_type} />
                          {call.assigned_coach ? (
                            <span className="text-sm text-gray-600">{call.assigned_coach.name}</span>
                          ) : (
                            <span className="text-sm text-orange-600 font-medium">Unassigned</span>
                          )}
                          <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <SupportTicketsTab adminEmail={adminEmail} />
        )}
      </div>

      {selected && (
        <LeadModal
          lead={selected}
          coaches={coaches}
          onClose={() => setSelected(null)}
          onUpdate={fetchData}
        />
      )}

      {selectedCall && (
        <DiscoveryCallModal
          call={selectedCall}
          coaches={coaches}
          onClose={() => setSelectedCall(null)}
          onUpdate={fetchDiscoveryCalls}
        />
      )}
    </div>
  );
}
