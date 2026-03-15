// ============================================================
// FILE: app/admin/tuition/page.tsx
// PURPOSE: Admin tuition management — onboardings, active students,
//          balance tracking, manual adjustments.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Users, Clock, AlertTriangle, Plus,
  RefreshCw, Send, ChevronDown, ChevronUp, IndianRupee,
  BookOpen, UserCheck, Pause, ArrowUpDown,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from '@/components/shared/StatusBadge';

// ============================================================
// TYPES
// ============================================================

interface Stats {
  activeStudents: number;
  pausedStudents: number;
  lowBalance: number;
  sessionsThisMonth: number;
  pendingOnboardings: number;
}

interface Onboarding {
  id: string;
  child_name: string;
  parent_phone: string;
  parent_name_hint: string | null;
  session_rate: number;
  sessions_purchased: number;
  coach_name: string | null;
  status: string;
  created_at: string;
  enrollment_id: string | null;
  enrollment_status: string | null;
  enrollment_sessions_remaining: number | null;
}

interface LedgerEntry {
  id: string;
  change_amount: number;
  balance_after: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function AdminTuitionPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);

  // New student form
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    sessionRate: 250,
    sessionsPurchased: 0, sessionDurationMinutes: 0, sessionsPerWeek: 0,
    scheduleDays: [] as string[],
    scheduleTimeSlot: '',
    schedulePreferredTime: '',
    defaultSessionMode: 'offline' as const,
    parentPhone: '', coachId: '', adminNotes: '',
  });

  // Adjust modal
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Ledger
  const [ledgerOpen, setLedgerOpen] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Coach list for dropdown
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes, coachRes] = await Promise.all([
        fetch('/api/admin/tuition/stats'),
        fetch('/api/admin/tuition'),
        fetch('/api/admin/crm/coaches'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (listRes.ok) {
        const data = await listRes.json();
        setOnboardings(data.onboardings || []);
      }
      if (coachRes.ok) {
        const data = await coachRes.json();
        setCoaches((data.coaches || data.data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleResend(id: string) {
    setResending(id);
    try {
      await fetch(`/api/admin/tuition/${id}/resend`, { method: 'POST' });
      fetchData();
    } catch { /* */ }
    setResending(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/tuition/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionRate: newForm.sessionRate * 100, // rupees to paise
          sessionsPurchased: newForm.sessionsPurchased,
          sessionDurationMinutes: newForm.sessionDurationMinutes,
          sessionsPerWeek: newForm.sessionsPerWeek,
          schedulePreference: JSON.stringify({
            days: newForm.scheduleDays,
            timeSlot: newForm.scheduleTimeSlot,
            preferredTime: newForm.schedulePreferredTime,
          }),
          defaultSessionMode: newForm.defaultSessionMode,
          parentPhone: newForm.parentPhone,
          coachId: newForm.coachId,
          adminNotes: newForm.adminNotes,
        }),
      });
      if (res.ok) {
        setShowNewForm(false);
        setNewForm({
          sessionRate: 250,
          sessionsPurchased: 0, sessionDurationMinutes: 0, sessionsPerWeek: 0,
          scheduleDays: [], scheduleTimeSlot: '', schedulePreferredTime: '',
          defaultSessionMode: 'offline', parentPhone: '',
          coachId: '', adminNotes: '',
        });
        fetchData();
      }
    } catch { /* */ }
    setCreating(false);
  }

  async function handleAdjust(enrollmentId: string) {
    if (!adjustAmount || !adjustReason) return;
    setAdjustSubmitting(true);
    try {
      const res = await fetch(`/api/admin/tuition/${enrollmentId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: adjustAmount, reason: adjustReason }),
      });
      if (res.ok) {
        setAdjusting(null);
        setAdjustAmount(0);
        setAdjustReason('');
        fetchData();
      }
    } catch { /* */ }
    setAdjustSubmitting(false);
  }

  async function loadLedger(enrollmentId: string) {
    if (ledgerOpen === enrollmentId) {
      setLedgerOpen(null);
      return;
    }
    setLedgerOpen(enrollmentId);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/admin/tuition/${enrollmentId}/ledger`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.entries || []);
      }
    } catch { /* */ }
    setLedgerLoading(false);
  }

  function getBalanceColor(remaining: number | null): string {
    if (remaining === null) return 'text-text-tertiary';
    if (remaining <= 0) return 'text-red-400';
    if (remaining <= 2) return 'text-amber-400';
    return 'text-green-400';
  }

  function getStatusBadge(status: string) {
    // StatusBadge derives color from the status string
    const labelMap: Record<string, string> = {
      draft: 'pending',
      parent_pending: 'pending',
      parent_completed: 'scheduled',
      payment_pending: 'pending',
      active: 'active',
      tuition_paused: 'paused',
    };
    return <StatusBadge status={labelMap[status] || status} />;
  }

  // ---- Derived data ----
  const pendingOnboardings = onboardings.filter(o => o.status !== 'parent_completed' || !o.enrollment_id);
  const activeStudents = onboardings.filter(o => o.enrollment_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="xl" color="muted" />
      </div>
    );
  }

  return (
    <div className="bg-surface-0 min-h-screen">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-6 h-6" />
              Tuition Management
            </h1>
            <p className="text-xs sm:text-sm text-text-tertiary mt-0.5">
              Manage tuition students, balances, and onboarding
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 text-text-tertiary hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-1.5 bg-white text-[#0a0a0f] font-semibold px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors h-9 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Student
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Active', value: stats.activeStudents, icon: UserCheck, color: 'text-green-400' },
              { label: 'Paused', value: stats.pausedStudents, icon: Pause, color: 'text-red-400' },
              { label: 'Low Balance', value: stats.lowBalance, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Sessions/Month', value: stats.sessionsThisMonth, icon: BookOpen, color: 'text-blue-400' },
              { label: 'Pending', value: stats.pendingOnboardings, icon: Clock, color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-surface-1 rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-text-tertiary">{s.label}</span>
                </div>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* New Student Form */}
        {showNewForm && (
          <div className="bg-surface-1 rounded-2xl p-5 border border-border">
            <h2 className="text-sm font-semibold text-white mb-4">New Tuition Student</h2>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input value={newForm.parentPhone} onChange={e => setNewForm(p => ({ ...p, parentPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                placeholder="Parent phone *" required inputMode="numeric"
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-text-tertiary" />
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                <input type="number" value={newForm.sessionRate} onChange={e => setNewForm(p => ({ ...p, sessionRate: +e.target.value }))}
                  placeholder="Rate/session" min={50} max={1000}
                  className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white w-full" />
              </div>
              <input type="number" value={newForm.sessionsPurchased || ''} onChange={e => setNewForm(p => ({ ...p, sessionsPurchased: +e.target.value }))}
                placeholder="Sessions *" min={1} max={50} required
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-text-tertiary" />
              <input type="number" value={newForm.sessionsPerWeek || ''} onChange={e => setNewForm(p => ({ ...p, sessionsPerWeek: +e.target.value }))}
                placeholder="Per week *" min={1} max={7} required
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-text-tertiary" />
              <select value={newForm.sessionDurationMinutes || ''} onChange={e => setNewForm(p => ({ ...p, sessionDurationMinutes: +e.target.value }))} required
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white">
                <option value="">Duration *</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
              <select value={newForm.coachId} onChange={e => setNewForm(p => ({ ...p, coachId: e.target.value }))} required
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white">
                <option value="">Select coach *</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {/* Schedule: Days */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs text-text-tertiary block mb-1.5">Preferred Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                    const selected = newForm.scheduleDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setNewForm(p => ({
                          ...p,
                          scheduleDays: selected
                            ? p.scheduleDays.filter(d => d !== day)
                            : [...p.scheduleDays, day],
                        }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-white text-[#0a0a0f]'
                            : 'bg-surface-2 text-text-tertiary border border-border hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Schedule: Time slot + preferred time */}
              <select value={newForm.scheduleTimeSlot} onChange={e => setNewForm(p => ({ ...p, scheduleTimeSlot: e.target.value }))}
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white">
                <option value="">Time slot</option>
                <option value="Morning (9-12)">Morning (9-12)</option>
                <option value="Afternoon (12-3)">Afternoon (12-3)</option>
                <option value="Evening (3-6)">Evening (3-6)</option>
                <option value="Late Evening (6-9)">Late Evening (6-9)</option>
              </select>
              <input value={newForm.schedulePreferredTime} onChange={e => setNewForm(p => ({ ...p, schedulePreferredTime: e.target.value }))}
                placeholder="Preferred time (optional)"
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-text-tertiary" />
              <input value={newForm.adminNotes} onChange={e => setNewForm(p => ({ ...p, adminNotes: e.target.value }))}
                placeholder="Admin notes"
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-text-tertiary" />
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewForm(false)}
                  className="px-4 py-2 text-sm text-text-tertiary hover:text-white rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newForm.parentPhone || !newForm.coachId}
                  className="flex items-center gap-1.5 bg-white text-[#0a0a0f] font-semibold px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50 text-sm h-9">
                  {creating ? <Spinner size="sm" color="muted" /> : <Plus className="w-4 h-4" />}
                  Create & Send Link
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Pending Onboardings */}
        {pendingOnboardings.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Pending Onboardings ({pendingOnboardings.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingOnboardings.map(o => (
                <div key={o.id} className="bg-surface-1 rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white text-sm">{o.child_name}</span>
                    {getStatusBadge(o.status)}
                  </div>
                  <div className="text-xs text-text-tertiary space-y-1">
                    <p>{o.parent_name_hint || o.parent_phone}</p>
                    <p>{o.sessions_purchased} sessions at &#8377;{o.session_rate / 100}</p>
                    {o.coach_name && <p>Coach: {o.coach_name}</p>}
                    <p>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  {o.status === 'parent_pending' && (
                    <button
                      onClick={() => handleResend(o.id)}
                      disabled={resending === o.id}
                      className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    >
                      {resending === o.id ? <Spinner size="sm" color="muted" /> : <Send className="w-3 h-3" />}
                      Resend Link
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Students */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" />
            Tuition Students ({activeStudents.length})
          </h2>

          {activeStudents.length === 0 ? (
            <div className="bg-surface-1 rounded-2xl p-8 text-center border border-border">
              <GraduationCap className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-tertiary text-sm">No tuition students yet. Create one above.</p>
            </div>
          ) : (
            <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
              {/* Table header — desktop */}
              <div className="hidden sm:grid grid-cols-7 gap-2 px-4 py-2.5 text-xs font-medium text-text-tertiary border-b border-border">
                <span>Student</span>
                <span>Parent</span>
                <span>Rate</span>
                <span>Balance</span>
                <span>Status</span>
                <span>Coach</span>
                <span>Actions</span>
              </div>

              {activeStudents.map(o => {
                const remaining = o.enrollment_sessions_remaining;
                const status = o.enrollment_status || o.status;

                return (
                  <div key={o.id}>
                    {/* Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 px-4 py-3 border-b border-border hover:bg-surface-2/50 items-center">
                      <div>
                        <p className="text-sm font-medium text-white">{o.child_name}</p>
                      </div>
                      <div className="text-xs text-text-secondary">{o.parent_name_hint || o.parent_phone}</div>
                      <div className="text-xs text-text-secondary">&#8377;{o.session_rate / 100}/s</div>
                      <div className={`text-sm font-bold ${getBalanceColor(remaining)}`}>
                        {remaining !== null ? `${remaining} / ${o.sessions_purchased}` : '--'}
                      </div>
                      <div>{getStatusBadge(status)}</div>
                      <div className="text-xs text-text-secondary">{o.coach_name || '--'}</div>
                      <div className="flex items-center gap-1">
                        {o.enrollment_id && (
                          <>
                            <button
                              onClick={() => setAdjusting(adjusting === o.enrollment_id ? null : o.enrollment_id)}
                              className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-surface-2"
                              title="Adjust balance"
                            >
                              <ArrowUpDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => loadLedger(o.enrollment_id!)}
                              className="text-xs text-text-tertiary hover:text-white px-2 py-1 rounded-lg hover:bg-surface-2"
                              title="View ledger"
                            >
                              {ledgerOpen === o.enrollment_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Adjust modal inline */}
                    {adjusting === o.enrollment_id && o.enrollment_id && (
                      <div className="px-4 py-3 bg-surface-2 border-b border-border">
                        <div className="flex items-end gap-3 max-w-lg">
                          <div>
                            <label className="text-xs text-text-tertiary block mb-1">Amount (+/-)</label>
                            <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(+e.target.value)}
                              className="bg-surface-0 border border-border rounded-xl px-3 py-1.5 text-sm text-white w-20" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-text-tertiary block mb-1">Reason</label>
                            <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                              placeholder="e.g. Admin correction"
                              className="bg-surface-0 border border-border rounded-xl px-3 py-1.5 text-sm text-white w-full placeholder:text-text-tertiary" />
                          </div>
                          <button
                            onClick={() => handleAdjust(o.enrollment_id!)}
                            disabled={adjustSubmitting || !adjustAmount || !adjustReason}
                            className="bg-white text-[#0a0a0f] font-semibold px-3 py-1.5 rounded-xl text-sm disabled:opacity-50 h-[34px]"
                          >
                            {adjustSubmitting ? <Spinner size="sm" color="muted" /> : 'Apply'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ledger history */}
                    {ledgerOpen === o.enrollment_id && o.enrollment_id && (
                      <div className="px-4 py-3 bg-surface-2/50 border-b border-border">
                        {ledgerLoading ? (
                          <div className="flex justify-center py-2"><Spinner size="sm" color="muted" /></div>
                        ) : ledgerEntries.length === 0 ? (
                          <p className="text-xs text-text-tertiary">No ledger entries yet.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {ledgerEntries.map(entry => (
                              <div key={entry.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono font-bold ${entry.change_amount > 0 ? 'text-green-400' : entry.change_amount < 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                                    {entry.change_amount > 0 ? '+' : ''}{entry.change_amount}
                                  </span>
                                  <span className="text-text-tertiary">bal: {entry.balance_after}</span>
                                  <span className="text-text-secondary">{entry.reason}</span>
                                </div>
                                <span className="text-text-tertiary">
                                  {new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
