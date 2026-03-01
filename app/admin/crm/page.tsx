// file: app/admin/crm/page.tsx
// Admin CRM with Lead Source Visibility + Support Tickets Tab
// UPDATED: Auto-assignment badges + filtered coach dropdown + POST-CALL NOTES
// FIXED: Filter state bug for discovery calls

'use client';

import { Database } from '@/lib/supabase/database.types';
import { useState, useEffect } from 'react';
import {
  Search, Filter, Phone, Mail, MessageCircle, Calendar,
  ChevronDown, X, Users, TrendingUp, Clock, CheckCircle,
  UserPlus, Eye, ExternalLink, RefreshCw, HelpCircle,
  Zap, User, AlertCircle, FileText
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
  age_band: 'foundation' | 'building' | 'mastery' | null;
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

import { AgeBandBadge } from '@/components/AgeBandBadge';

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
  coach_id: string | null;
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
  // Post-call notes fields
  call_completed?: boolean;
  call_outcome?: string | null;
  likelihood?: string | null;
  objections?: string | null;
  concerns?: string | null;
  follow_up_notes?: string | null;
  follow_up_date?: string | null;
  completed_at?: string | null;
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  assessed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  call_scheduled: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  call_done: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  enrolled: 'bg-green-500/20 text-green-400 border border-green-500/30',
  active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  completed: 'bg-surface-2 text-text-secondary border border-border',
  lost: 'bg-red-500/20 text-red-400 border border-red-500/30',
  churned: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

// Assignment Type Badge Component
function AssignmentBadge({ type }: { type: string | null | undefined }) {
  if (type === 'auto') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
        <Zap className="w-3 h-3" />
        Auto
      </span>
    );
  }
  if (type === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-surface-2 text-text-secondary border border-border">
        <User className="w-3 h-3" />
        Manual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
          <UserPlus className="w-3 h-3" />
          Coach
        </span>
        <span className="text-xs text-text-secondary truncate max-w-[100px]" title={lead.referrer_name}>
          {lead.referrer_name}
        </span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
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
      const res = await fetch(`/api/admin/crm/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,           // ← ADD THIS LINE
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
      <div className="bg-surface-1 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-1 border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{lead.name}</h2>
            <p className="text-sm text-text-tertiary">Age {lead.age} - {lead.parent_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-xl">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-surface-0 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Lead Source</h3>
            <div className="flex items-center gap-3">
              <LeadSourceBadge lead={lead} />
              {lead.referrer_code && (
                <span className="text-xs text-text-tertiary">Code: {lead.referrer_code}</span>
              )}
            </div>
            {lead.lead_source === 'coach' && lead.referrer_name && (
              <p className="text-sm text-text-secondary mt-2">
                Lead bonus (20%) goes to <strong>{lead.referrer_name}</strong> on enrollment
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-wide">Email</label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-text-tertiary" />
                <a href={`mailto:${lead.parent_email}`} className="text-sm text-gray-300 hover:underline">
                  {lead.parent_email}
                </a>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-wide">Phone</label>
              <div className="flex items-center gap-2 mt-1">
                <Phone className="w-4 h-4 text-text-tertiary" />
                <a href={`tel:${lead.parent_phone}`} className="text-sm text-gray-300 hover:underline">
                  {lead.parent_phone}
                </a>
              </div>
            </div>
          </div>

          {lead.latest_assessment_score !== null && (
            <div>
              <label className="text-xs text-text-tertiary uppercase tracking-wide">Assessment Score</label>
              <div className="mt-1">
                <span className={`text-2xl font-bold ${lead.latest_assessment_score >= 7 ? 'text-green-400' :
                  lead.latest_assessment_score >= 5 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                  {lead.latest_assessment_score}/10
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10]"
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
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Assigned Coach</label>
            <select
              value={assignedCoach}
              onChange={(e) => setAssignedCoach(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10]"
            >
              <option value="">Unassigned</option>
              {availableCoaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.name} ({coach.email})
                </option>
              ))}
            </select>
            {availableCoaches.length < coaches.length && (
              <p className="text-xs text-text-tertiary mt-1">
                {coaches.length - availableCoaches.length} coach(es) hidden (unavailable/exiting)
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-white bg-surface-2 placeholder:text-text-muted focus:ring-2 focus:ring-white/[0.10]"
              placeholder="Add notes about this lead..."
            />
          </div>

          <div className="flex gap-2">
            <a
              href={`tel:${lead.parent_phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200"
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface-3 text-white rounded-lg hover:bg-surface-2"
            >
              <Mail className="w-4 h-4" /> Email
            </a>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-white text-[#0a0a0f] rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DISCOVERY CALL MODAL - WITH POST-CALL NOTES
// ============================================================
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
  const [assignedCoach, setAssignedCoach] = useState(call.coach_id || '');
  const [saving, setSaving] = useState(false);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);

  // Post-call form state
  const [showPostCallForm, setShowPostCallForm] = useState(call.call_completed || false);
  const [postCallData, setPostCallData] = useState({
    call_outcome: call.call_outcome || '',
    likelihood: call.likelihood || '',
    objections: call.objections || '',
    concerns: call.concerns || '',
    follow_up_notes: call.follow_up_notes || '',
    follow_up_date: call.follow_up_date || '',
  });
  const [savingPostCall, setSavingPostCall] = useState(false);

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
      if (res.ok) { onUpdate(); onClose(); }
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
      if (res.ok) { onUpdate(); onClose(); }
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
      if (res.ok) { onUpdate(); onClose(); }
    } catch (error) {
      console.error('Error sending followup:', error);
    }
    setSendingFollowup(false);
  };

  // Save post-call notes
  const handleSavePostCall = async () => {
    setSavingPostCall(true);
    try {
      const res = await fetch(`/api/discovery-call/${call.id}/post-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...postCallData,
          call_completed: true,
        }),
      });
      if (res.ok) { onUpdate(); onClose(); }
    } catch (error) {
      console.error('Error saving post-call notes:', error);
    }
    setSavingPostCall(false);
  };

  // Outcome options
  const outcomeOptions = [
    { value: 'enrolled', label: 'Enrolled' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'not_interested', label: 'Not Interested' },
    { value: 'no_show', label: 'No Show' },
  ];

  const likelihoodOptions = [
    { value: 'hot', label: 'Hot', desc: 'Likely to enroll', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { value: 'warm', label: 'Warm', desc: 'Needs nurturing', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { value: 'cold', label: 'Cold', desc: 'Unlikely', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-1 border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{call.child_name}</h2>
            <p className="text-sm text-text-tertiary">Age {call.child_age} - {call.parent_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-xl">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Scheduled Time */}
          <div className="flex items-center gap-2 text-text-secondary">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">
              {new Date(call.scheduled_time).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
            {call.call_completed && (
              <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-medium">
                Completed
              </span>
            )}
          </div>

          {/* Assignment Info */}
          <div className="bg-surface-0 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-text-tertiary">Assignment:</span>
              <div className="flex items-center gap-2 mt-1">
                <AssignmentBadge type={call.assignment_type} />
                {call.assigned_at && (
                  <span className="text-xs text-text-tertiary">
                    {new Date(call.assigned_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
            </div>
            {call.assigned_by && (
              <span className="text-xs text-text-tertiary">by {call.assigned_by}</span>
            )}
          </div>

          {/* Assessment Score */}
          {call.assessment_score !== null && (
            <div className="bg-surface-0 rounded-lg p-3">
              <span className="text-sm text-text-tertiary">Assessment Score:</span>
              <span className={`ml-2 text-lg font-bold ${call.assessment_score >= 7 ? 'text-green-400' :
                call.assessment_score >= 5 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                {call.assessment_score}/10
              </span>
            </div>
          )}

          {/* Coach Assignment */}
          <div>
            <label className="text-xs text-text-tertiary uppercase tracking-wide">
              {call.coach_id ? 'Reassign Coach' : 'Assign Coach'}
            </label>
            <div className="flex gap-2 mt-1">
              <select
                value={assignedCoach}
                onChange={(e) => setAssignedCoach(e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-white bg-surface-2"
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
                className="px-4 py-2 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {saving ? '...' : call.coach_id ? 'Reassign' : 'Assign'}
              </button>
            </div>
            {availableCoaches.length < coaches.length && (
              <p className="text-xs text-text-tertiary mt-1">
                {coaches.length - availableCoaches.length} coach(es) hidden (unavailable/exiting)
              </p>
            )}
          </div>

          {/* ============================================================ */}
          {/* POST-CALL NOTES SECTION */}
          {/* ============================================================ */}
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setShowPostCallForm(!showPostCallForm)}
              className="w-full flex items-center justify-between p-3 bg-surface-0 hover:bg-surface-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-text-secondary" />
                <span className="font-medium text-text-secondary">Post-Call Notes</span>
                {call.call_completed && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs">Filled</span>
                )}
              </div>
              <ChevronDown className={`w-5 h-5 text-text-tertiary transition-transform ${showPostCallForm ? 'rotate-180' : ''}`} />
            </button>

            {showPostCallForm && (
              <div className="mt-3 space-y-4 p-4 bg-surface-0 rounded-lg">
                {/* Call Outcome */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Call Outcome *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {outcomeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPostCallData({ ...postCallData, call_outcome: option.value })}
                        className={`p-2 rounded-lg border text-sm font-medium transition-all ${postCallData.call_outcome === option.value
                          ? 'border-white/[0.16] bg-white/[0.08] text-white'
                          : 'border-border bg-surface-1 text-text-secondary hover:border-border'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Likelihood (only if follow_up or not_interested) */}
                {postCallData.call_outcome && postCallData.call_outcome !== 'enrolled' && postCallData.call_outcome !== 'no_show' && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Likelihood to Enroll
                    </label>
                    <div className="flex gap-2">
                      {likelihoodOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPostCallData({ ...postCallData, likelihood: option.value })}
                          className={`flex-1 p-2 rounded-lg border text-sm font-medium transition-all ${postCallData.likelihood === option.value
                            ? option.color
                            : 'border-border bg-surface-1 text-text-secondary hover:border-border'
                            }`}
                        >
                          <div>{option.label}</div>
                          <div className="text-xs font-normal opacity-75">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objections */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Objections Raised
                  </label>
                  <textarea
                    value={postCallData.objections}
                    onChange={(e) => setPostCallData({ ...postCallData, objections: e.target.value })}
                    placeholder="Price concerns, time constraints, spouse decision..."
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-white bg-surface-2 placeholder:text-text-muted resize-none focus:ring-2 focus:ring-white/[0.10]"
                  />
                </div>

                {/* Concerns */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Parent Concerns / Questions
                  </label>
                  <textarea
                    value={postCallData.concerns}
                    onChange={(e) => setPostCallData({ ...postCallData, concerns: e.target.value })}
                    placeholder="What questions did they ask? What worried them?"
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-white bg-surface-2 placeholder:text-text-muted resize-none focus:ring-2 focus:ring-white/[0.10]"
                  />
                </div>

                {/* Follow-up Notes */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Follow-up Notes
                  </label>
                  <textarea
                    value={postCallData.follow_up_notes}
                    onChange={(e) => setPostCallData({ ...postCallData, follow_up_notes: e.target.value })}
                    placeholder="What should we do next? Any specific follow-up needed?"
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-white bg-surface-2 placeholder:text-text-muted resize-none focus:ring-2 focus:ring-white/[0.10]"
                  />
                </div>

                {/* Follow-up Date (if needs follow-up) */}
                {postCallData.call_outcome === 'follow_up' && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={postCallData.follow_up_date}
                      onChange={(e) => setPostCallData({ ...postCallData, follow_up_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10]"
                    />
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSavePostCall}
                  disabled={!postCallData.call_outcome || savingPostCall}
                  className="w-full py-2.5 bg-surface-3 text-white rounded-lg font-medium hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingPostCall ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : call.call_completed ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Update Notes
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save Post-Call Notes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          {/* END POST-CALL NOTES SECTION */}

          {/* Action Buttons */}
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
                className="w-full py-3 bg-white/[0.08] text-white rounded-lg font-medium hover:bg-white/[0.12] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                {sendingFollowup ? 'Sending...' : 'Send 24hr Follow-up'}
              </button>
            )}
          </div>

          {/* Contact Buttons */}
          <div className="flex gap-2 pt-2">
            <a href={`tel:${call.parent_phone}`} className="flex-1 bg-white text-[#0a0a0f] py-2.5 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-1">
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

  const pendingAssignments = discoveryCalls.filter(c => !c.coach_id || c.assignment_type === 'pending').length;

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

  // FIXED: Accept optional filter parameter to avoid state timing issues
  const fetchDiscoveryCalls = async (filterOverride?: string) => {
    setDiscoveryLoading(true);
    try {
      const statusToUse = filterOverride ?? discoveryFilter;
      const res = await fetch(`/api/discovery-call/pending?status=${statusToUse === 'all' ? '' : statusToUse}`);
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
    <div className="bg-surface-0">
      <div className="bg-surface-1 border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-2xl font-bold text-white">Lead Management</h1>
            <button
              onClick={() => { fetchData(); fetchDiscoveryCalls(); fetchSupportTicketCount(); }}
              className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:bg-surface-2 rounded-lg flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition whitespace-nowrap ${activeTab === 'leads' ? 'bg-white/[0.08] text-white' : 'text-text-secondary hover:bg-surface-2'
                }`}
            >
              Leads ({stats.total})
            </button>
            <button
              onClick={() => setActiveTab('discovery')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'discovery' ? 'bg-white/[0.08] text-white' : 'text-text-secondary hover:bg-surface-2'
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
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'support' ? 'bg-white/[0.08] text-white' : 'text-text-secondary hover:bg-surface-2'
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
              {[
                { icon: Users, label: 'Total Leads', value: stats.total, color: 'text-text-tertiary', valueColor: 'text-white' },
                { icon: TrendingUp, label: 'Yestoryd', value: stats.yestoryd_leads, color: 'text-green-400', valueColor: 'text-green-400' },
                { icon: UserPlus, label: 'Coach Refs', value: stats.coach_leads, color: 'text-orange-400', valueColor: 'text-orange-400' },
                { icon: CheckCircle, label: 'Enrolled', value: stats.enrolled, color: 'text-gray-300', valueColor: 'text-gray-300' },
                { icon: Clock, label: 'Pending', value: stats.pending, color: 'text-yellow-400', valueColor: 'text-yellow-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-surface-1 rounded-xl p-3 sm:p-4 border border-border">
                  <div className={`flex items-center gap-1.5 ${stat.color} text-xs sm:text-sm`}>
                    <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="truncate">{stat.label}</span>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${stat.valueColor} mt-1`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-surface-1 rounded-xl border border-border p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search by name, email, phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm text-white bg-surface-2 placeholder:text-text-muted focus:ring-2 focus:ring-white/[0.10]"
                  />
                </div>

                {/* Filters row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="flex-shrink-0 px-2.5 py-1.5 text-sm border border-border rounded-lg text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10]"
                  >
                    <option value="all">All Sources</option>
                    <option value="yestoryd">Yestoryd</option>
                    <option value="coach">Coach Referrals</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex-shrink-0 px-2.5 py-1.5 text-sm border border-border rounded-lg text-white bg-surface-2 focus:ring-2 focus:ring-white/[0.10]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="assessed">Assessed</option>
                    <option value="contacted">Contacted</option>
                    <option value="call_scheduled">Call Scheduled</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="active">Active</option>
                    <option value="lost">Lost</option>
                  </select>

                  {(sourceFilter !== 'all' || statusFilter !== 'all' || search) && (
                    <button
                      onClick={() => {
                        setSourceFilter('all');
                        setStatusFilter('all');
                        setSearch('');
                      }}
                      className="flex-shrink-0 text-sm text-gray-300 hover:underline whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-surface-1 rounded-xl border border-border p-8 text-center text-text-tertiary">Loading leads...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="bg-surface-1 rounded-xl border border-border p-8 text-center text-text-tertiary">No leads found</div>
            ) : (
              <>
                {/* Mobile: Card Layout */}
                <div className="sm:hidden space-y-2">
                  {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="bg-surface-1 border border-border rounded-xl p-3 active:bg-surface-2 cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">{lead.name}, {lead.age}y</div>
                          <div className="text-xs text-text-tertiary truncate">{lead.parent_name}</div>
                        </div>
                        <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[lead.lead_status] || 'bg-surface-2 text-text-secondary border border-border'}`}>
                          {lead.lead_status?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <LeadSourceBadge lead={lead} />
                        </div>
                        <div className="flex items-center gap-3 text-text-tertiary">
                          {lead.latest_assessment_score !== null && (
                            <span className={`font-semibold ${lead.latest_assessment_score >= 7 ? 'text-green-400' :
                              lead.latest_assessment_score >= 5 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                              {lead.latest_assessment_score}/10
                            </span>
                          )}
                          <span>{new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table Layout */}
                <div className="hidden sm:block bg-surface-1 rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface-0 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Child</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Band</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Parent</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Source</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Status</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Score</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Coach</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-surface-2">
                            <td className="px-4 py-3">
                              <div className="font-medium text-white">{lead.name}</div>
                              <div className="text-sm text-text-tertiary">Age {lead.age}</div>
                            </td>
                            <td className="px-4 py-3">
                              <AgeBandBadge ageBand={lead.age_band} age={lead.age} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-white">{lead.parent_name}</div>
                              <div className="text-xs text-text-tertiary">{lead.parent_email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <LeadSourceBadge lead={lead} />
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.lead_status] || 'bg-surface-2 text-text-secondary border border-border'}`}>
                                {lead.lead_status?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {lead.latest_assessment_score !== null ? (
                                <span className={`font-semibold ${lead.latest_assessment_score >= 7 ? 'text-green-400' :
                                  lead.latest_assessment_score >= 5 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                  {lead.latest_assessment_score}/10
                                </span>
                              ) : (
                                <span className="text-text-tertiary">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {lead.assigned_coach?.name || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-tertiary">
                              {new Date(lead.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelected(lead)}
                                className="flex items-center gap-1 text-gray-300 hover:text-white text-sm font-medium"
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
                </div>
              </>
            )}
          </>
        ) : activeTab === 'discovery' ? (
          <>
            {pendingAssignments > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-orange-400">
                    {pendingAssignments} call{pendingAssignments > 1 ? 's' : ''} need{pendingAssignments === 1 ? 's' : ''} manual assignment
                  </p>
                  <p className="text-sm text-orange-400/80">
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
                    // FIXED: Pass filter directly to avoid state timing issue
                    fetchDiscoveryCalls(filter);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${discoveryFilter === filter
                    ? 'bg-white/[0.08] text-white'
                    : 'bg-surface-1 text-text-secondary border border-border hover:bg-surface-2'
                    }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
              {discoveryLoading ? (
                <div className="p-8 text-center text-text-tertiary">Loading discovery calls...</div>
              ) : discoveryCalls.length === 0 ? (
                <div className="p-8 text-center text-text-tertiary">No discovery calls found</div>
              ) : (
                <div className="divide-y divide-border">
                  {discoveryCalls.map((call) => {
                    const isPending = !call.coach_id || call.assignment_type === 'pending';
                    return (
                      <div
                        key={call.id}
                        onClick={() => setSelectedCall(call)}
                        className={`p-3 sm:p-4 hover:bg-surface-2 cursor-pointer ${isPending ? 'bg-orange-500/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {isPending && (
                              <div className="w-2 h-2 mt-2 bg-orange-500 rounded-full animate-pulse flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-white">{call.child_name}</span>
                                {call.call_completed && (
                                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px]">
                                    Done
                                  </span>
                                )}
                                {call.call_outcome && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${call.call_outcome === 'enrolled' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                    call.call_outcome === 'follow_up' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                      call.call_outcome === 'not_interested' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        'bg-surface-2 text-text-secondary border border-border'
                                    }`}>
                                    {call.call_outcome === 'enrolled' ? 'Enrolled' :
                                      call.call_outcome === 'follow_up' ? 'Follow-up' :
                                        call.call_outcome === 'not_interested' ? 'Not Interested' :
                                          call.call_outcome === 'no_show' ? 'No Show' : call.call_outcome}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-text-tertiary mt-0.5">
                                {call.parent_name} · {new Date(call.scheduled_time).toLocaleString('en-IN', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                            <AssignmentBadge type={call.assignment_type} />
                            <span className="hidden sm:inline text-sm text-text-secondary">
                              {call.assigned_coach?.name || <span className="text-orange-400 font-medium">Unassigned</span>}
                            </span>
                            <ChevronDown className="w-4 h-4 text-text-tertiary rotate-[-90deg]" />
                          </div>
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
          onUpdate={() => fetchDiscoveryCalls()}
        />
      )}
    </div>
  );
}
