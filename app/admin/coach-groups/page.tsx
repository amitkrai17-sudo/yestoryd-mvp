// ============================================================
// FILE: app/admin/coach-groups/page.tsx
// ============================================================
// Admin UI for managing coach groups and revenue splits
// Design: Mobile-first, Yestoryd branding, intuitive UX

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Users,
  Percent,
  IndianRupee,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Crown,
  Star,
  Sprout,
  Building2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface CoachGroup {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
  is_internal: boolean | null;
  is_active: boolean | null;
  badge_color: string | null;
  sort_order: number | null;
  coach_count: number;
  created_at: string | null;
  updated_at: string | null;
}

interface Coach {
  id: string;
  name: string;
  email: string;
  group_id: string | null;
  is_active: boolean | null;
  referral_code: string | null;
  group_name?: string;
}

// Group icons mapping
const GROUP_ICONS: Record<string, any> = {
  rising: Sprout,
  expert: Star,
  master: Crown,
  founding: Sparkles,
  internal: Building2,
};

// Supabase client
export default function AdminCoachGroupsPage() {
  const [groups, setGroups] = useState<CoachGroup[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<CoachGroup>>({});
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assigningCoach, setAssigningCoach] = useState<string | null>(null);

  // V1 fallback – getPricingConfig().tiers[x].discountedPrice is authoritative
  const ENROLLMENT_AMOUNT = 5999;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  async function fetchData() {
    setLoading(true);

    // Fetch groups
    const { data: groupsData } = await supabase
      .from('coach_groups')
      .select('*')
      .order('sort_order');

    // Fetch coaches
    const { data: coachesData } = await supabase
      .from('coaches')
      .select('id, name, email, group_id, is_active, referral_code')
      .eq('is_active', true)
      .order('name');

    if (groupsData) {
      const groupsWithCount = groupsData.map((group) => ({
        ...group,
        coach_count: coachesData?.filter((c) => c.group_id === group.id).length || 0,
      }));
      setGroups(groupsWithCount);
    }

    if (coachesData) {
      const coachesWithGroup = coachesData.map((coach) => ({
        ...coach,
        group_name: groupsData?.find((g) => g.id === coach.group_id)?.display_name || 'Unassigned',
      }));
      setCoaches(coachesWithGroup);
    }

    setLoading(false);
  }

  function startEdit(group: CoachGroup) {
    setEditingGroup(group.id);
    setEditValues({
      lead_cost_percent: group.lead_cost_percent,
      coach_cost_percent: group.coach_cost_percent,
      description: group.description,
    });
  }

  function cancelEdit() {
    setEditingGroup(null);
    setEditValues({});
  }

  async function saveGroup(groupId: string) {
    setSaving(true);
    setMessage(null);

    const leadCost = editValues.lead_cost_percent || 0;
    const coachCost = editValues.coach_cost_percent || 0;
    const platformFee = 100 - leadCost - coachCost;

    if (platformFee < 0) {
      setMessage({ type: 'error', text: 'Lead + Coach percentages cannot exceed 100%' });
      setSaving(false);
      return;
    }

    const { error } = await (supabase as any)
      .from('coach_groups')
      .update({
        lead_cost_percent: leadCost,
        coach_cost_percent: coachCost,
        platform_fee_percent: platformFee,
        description: editValues.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Group updated successfully!' });
      setEditingGroup(null);
      fetchData();
    }

    setSaving(false);
  }

  async function assignCoachToGroup(coachId: string, groupId: string | null) {
    setSaving(true);
    setMessage(null);

    // Get current coach data for comparison
    const coach = coaches.find((c) => c.id === coachId);
    const oldGroup = groups.find((g) => g.id === coach?.group_id);
    const newGroup = groups.find((g) => g.id === groupId);

    const { error } = await (supabase as any)
      .from('coaches')
      .update({
        group_id: groupId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setSaving(false);
      return;
    }

    // Send notification if tier actually changed
    if (oldGroup?.id !== groupId && newGroup && !newGroup.is_internal) {
      try {
        const isPromotion = (newGroup.coach_cost_percent || 0) > (oldGroup?.coach_cost_percent || 0);
        
        await fetch('/api/coach/tier-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coachId,
            oldTierName: oldGroup?.name || 'none',
            newTierName: newGroup.name,
            newTierDisplayName: newGroup.display_name,
            newCoachPercent: newGroup.coach_cost_percent,
            newLeadPercent: newGroup.lead_cost_percent,
            isPromotion,
          }),
        });
        
        setMessage({
          type: 'success',
          text: `Coach ${isPromotion ? 'promoted' : 'moved'} to ${newGroup.display_name}. Notification sent!`,
        });
      } catch (notifyError) {
        console.error('Notification error:', notifyError);
        setMessage({ type: 'success', text: 'Coach group updated! (Notification failed)' });
      }
    } else {
      setMessage({ type: 'success', text: 'Coach group updated!' });
    }

    setAssigningCoach(null);
    fetchData();
    setSaving(false);
  }

  function calculateSplit(group: CoachGroup, isCoachLead: boolean = false) {
    if (group.is_internal) {
      return { coachGets: 0, platformGets: ENROLLMENT_AMOUNT, totalCoach: 0 };
    }

    const leadCost = Math.round(ENROLLMENT_AMOUNT * group.lead_cost_percent / 100);
    const coachCost = Math.round(ENROLLMENT_AMOUNT * group.coach_cost_percent / 100);
    const platformFee = ENROLLMENT_AMOUNT - leadCost - coachCost;

    if (isCoachLead) {
      return {
        coachGets: coachCost + leadCost,
        platformGets: platformFee,
        totalCoach: coachCost + leadCost,
      };
    }

    return {
      coachGets: coachCost,
      platformGets: platformFee + leadCost,
      totalCoach: coachCost,
    };
  }

  const GroupIcon = ({ name }: { name: string }) => {
    const Icon = GROUP_ICONS[name] || Users;
    return <Icon className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 bg-surface-0">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-text-tertiary">Loading coach groups...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto bg-surface-0">
      {/* ==================== HEADER ==================== */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Coach Groups</h1>
            <p className="text-text-tertiary mt-1">Manage revenue splits and coach tiers</p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-1 border border-border rounded-xl text-text-secondary hover:bg-surface-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* ==================== ALERT MESSAGE ==================== */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      {/* ==================== STATS CARDS ==================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-1 rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/[0.08] rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-300" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{coaches.length}</p>
          <p className="text-sm text-text-tertiary">Active Coaches</p>
        </div>

        <div className="bg-surface-1 rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/[0.08] rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-300" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{groups.length}</p>
          <p className="text-sm text-text-tertiary">Coach Tiers</p>
        </div>

        <div className="bg-surface-1 rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">₹{ENROLLMENT_AMOUNT.toLocaleString()}</p>
          <p className="text-sm text-text-tertiary">Per Enrollment</p>
        </div>

        <div className="bg-surface-1 rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/[0.08] rounded-xl flex items-center justify-center">
              <Percent className="w-5 h-5 text-gray-300" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {groups.find(g => g.name === 'rising')?.coach_cost_percent || 50}%
          </p>
          <p className="text-sm text-text-tertiary">Base Coach Split</p>
        </div>
      </div>

      {/* ==================== GROUPS SECTION ==================== */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Revenue Split Tiers</h2>
        <div className="space-y-4">
          {groups.map((group) => {
            const isEditing = editingGroup === group.id;
            const isExpanded = expandedGroup === group.id;
            const split = calculateSplit(group);
            const splitWithLead = calculateSplit(group, true);

            return (
              <div
                key={group.id}
                className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                {/* Group Header */}
                <div
                  className="p-4 lg:p-5 cursor-pointer hover:bg-surface-2 transition-colors"
                  onClick={() => !isEditing && setExpandedGroup(isExpanded ? null : group.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: group.badge_color || '#6366f1' }}
                    >
                      <GroupIcon name={group.name} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{group.display_name}</h3>
                        {group.is_internal && (
                          <span className="text-xs px-2 py-0.5 bg-surface-2 text-text-secondary rounded-full">
                            Internal
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 bg-white/[0.08] text-gray-400 border border-white/[0.08] rounded-full">
                          {group.coach_count} coach{group.coach_count !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-text-tertiary mt-0.5 line-clamp-1">{group.description}</p>
                    </div>

                    {/* Split Preview */}
                    <div className="hidden sm:flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-400">
                          {group.is_internal ? '0%' : `${group.coach_cost_percent}%`}
                        </p>
                        <p className="text-xs text-text-tertiary">Coach</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-300">
                          {group.is_internal ? '100%' : `${group.platform_fee_percent}%`}
                        </p>
                        <p className="text-xs text-text-tertiary">Platform</p>
                      </div>
                    </div>

                    {/* Expand/Edit Buttons */}
                    <div className="flex items-center gap-2">
                      {!group.is_internal && !isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(group);
                          }}
                          className="p-2 text-text-tertiary hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-2 text-text-tertiary">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Mobile Split Preview */}
                  <div className="sm:hidden flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                    <div className="flex-1 text-center">
                      <p className="text-lg font-bold text-emerald-400">
                        {group.is_internal ? '0%' : `${group.coach_cost_percent}%`}
                      </p>
                      <p className="text-xs text-text-tertiary">Coach Gets</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-lg font-bold text-gray-300">
                        {group.is_internal ? '100%' : `${group.platform_fee_percent}%`}
                      </p>
                      <p className="text-xs text-text-tertiary">Platform Gets</p>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {(isExpanded || isEditing) && (
                  <div className="border-t border-border bg-surface-2/50">
                    {isEditing ? (
                      /* Edit Form */
                      <div className="p-4 lg:p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                              Lead Cost %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editValues.lead_cost_percent || 0}
                              onChange={(e) =>
                                setEditValues({ ...editValues, lead_cost_percent: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white bg-surface-2 placeholder:text-text-muted"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                              Coach Cost %
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editValues.coach_cost_percent || 0}
                              onChange={(e) =>
                                setEditValues({ ...editValues, coach_cost_percent: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white bg-surface-2 placeholder:text-text-muted"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                              Platform Fee % (auto)
                            </label>
                            <div className="px-3 py-2 bg-surface-3 border border-border rounded-lg text-text-secondary">
                              {100 - (editValues.lead_cost_percent || 0) - (editValues.coach_cost_percent || 0)}%
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={editValues.description || ''}
                            onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-white/[0.10] focus:border-white/[0.30] text-white bg-surface-2 placeholder:text-text-muted"
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => saveGroup(group.id)}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[#0a0a0f] rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-1 border border-border text-text-secondary rounded-lg hover:bg-surface-2 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Preview Content */
                      <div className="p-4 lg:p-5">
                        {/* Revenue Preview */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                          {/* Yestoryd Lead */}
                          <div className="bg-surface-1 rounded-xl p-4 border border-border">
                            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-3">
                              Yestoryd-Sourced Lead
                            </p>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-2xl font-bold text-emerald-400">
                                  ₹{split.coachGets.toLocaleString()}
                                </p>
                                <p className="text-sm text-text-tertiary">Coach Earnings</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-300">
                                  ₹{split.platformGets.toLocaleString()}
                                </p>
                                <p className="text-sm text-text-tertiary">Platform Revenue</p>
                              </div>
                            </div>
                          </div>

                          {/* Coach Lead */}
                          {!group.is_internal && (
                            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/30">
                              <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-3">
                                Coach-Sourced Lead (+Lead Bonus)
                              </p>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-2xl font-bold text-emerald-400">
                                    ₹{splitWithLead.coachGets.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-emerald-400">Coach Earnings</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-gray-300">
                                    ₹{splitWithLead.platformGets.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-text-tertiary">Platform Revenue</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Coaches in this group */}
                        {group.coach_count! > 0 && (
                          <div>
                            <p className="text-sm font-medium text-text-secondary mb-2">
                              Coaches in this tier:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {coaches
                                .filter((c) => c.group_id === group.id)
                                .map((coach) => (
                                  <span
                                    key={coach.id}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-surface-1 border border-border rounded-full text-sm text-white"
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: group.badge_color || '#6366f1' }}
                                    />
                                    {coach.name}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== COACHES SECTION ==================== */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Assign Coaches to Tiers</h2>
        <div className="bg-surface-1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Coach</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Current Tier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Referral Code</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coaches.map((coach) => {
                  const currentGroup = groups.find((g) => g.id === coach.group_id);
                  const isAssigning = assigningCoach === coach.id;

                  return (
                    <tr key={coach.id} className="hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                            style={{ backgroundColor: currentGroup?.badge_color || '#6b7280' }}
                          >
                            {coach.name.charAt(0)}
                          </div>
                          <span className="font-medium text-white">{coach.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{coach.email}</td>
                      <td className="px-4 py-3">
                        {isAssigning ? (
                          <select
                            value={coach.group_id || ''}
                            onChange={(e) => assignCoachToGroup(coach.id, e.target.value || null)}
                            className="px-3 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-white/[0.10] text-white bg-surface-2"
                          >
                            <option value="">Unassigned</option>
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.display_name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${currentGroup?.badge_color}20`,
                              color: currentGroup?.badge_color || '#6b7280',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: currentGroup?.badge_color || '#6b7280' }}
                            />
                            {currentGroup?.display_name || 'Unassigned'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {coach.referral_code ? (
                          <code className="text-xs bg-surface-2 text-text-secondary px-2 py-1 rounded font-mono">{coach.referral_code}</code>
                        ) : (
                          <span className="text-xs text-text-tertiary">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAssigning ? (
                          <button
                            onClick={() => setAssigningCoach(null)}
                            className="text-sm text-text-tertiary hover:text-text-secondary"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => setAssigningCoach(coach.id)}
                            className="text-sm text-gray-300 hover:text-white font-medium"
                          >
                            Change Tier
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {coaches.length === 0 && (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No active coaches found</p>
            </div>
          )}
        </div>
      </div>

      {/* ==================== INFO BOX ==================== */}
      <div className="mt-8 p-4 bg-white/[0.06] border border-white/[0.08] rounded-xl">
        <h3 className="font-medium text-gray-300 mb-2">How Revenue Split Works</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• <strong>Lead Cost:</strong> Paid to whoever sourced the lead (Yestoryd or coach)</li>
          <li>• <strong>Coach Cost:</strong> Paid to the coaching coach over 3 monthly installments</li>
          <li>• <strong>Platform Fee:</strong> Retained by Yestoryd for operations</li>
          <li>• <strong>Internal coaches</strong> (like Rucha) have 100% go to platform</li>
          <li>• Changes apply to <strong>future enrollments only</strong></li>
        </ul>
      </div>
    </div>
  );
}
