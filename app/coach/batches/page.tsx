// app/coach/batches/page.tsx
// Coach's tuition students organized by batch with progress tracking
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, UserPlus, Clock, Video, MapPin, BookOpen, Pencil, X, ArrowLeftRight, AlertTriangle, Trash2,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { supabase } from '@/lib/supabase/client';
import { getAvatarColor } from '@/lib/utils/avatar-colors';
import ScheduleCapture from '@/components/shared/ScheduleCapture';
import type { SchedulePreference } from '@/lib/scheduling/schedule-time';

// ============================================================
// TYPES
// ============================================================

interface StudentProgress {
  onboardingId: string;
  childId: string;
  childName: string;
  completed: number;
  purchased: number;
}

// 2G-3: a confirmed batch a member could be MOVED to (from /api/tuition/batches/candidates).
type BatchCandidate = { batchId: string; days: string[]; time: string | null; mode: string; memberNames: string[] };

// Roster label for a candidate batch, e.g. "Anirudh & Raysha — Sat 16:00". Empty batch → "Empty batch — …".
function formatBatchCandidateLabel(c: BatchCandidate): string {
  const who = c.memberNames.length > 0 ? c.memberNames.join(' & ') : 'Empty batch';
  const when = [c.days.join('/'), c.time].filter(Boolean).join(' ');
  return when ? `${who} — ${when}` : who;
}

interface BatchData {
  batchId: string;
  rate: number;         // paise
  duration: number;     // minutes
  frequency: number;
  mode: string;
  scheduleConfirmed: boolean;
  students: StudentProgress[];
}

// ============================================================
// COMPONENT
// ============================================================

export default function CoachBatchesPage() {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);

  // 2G-2: batch schedule-edit modal (session-mutating — confirm → success/partial standard)
  const [batchEditId, setBatchEditId] = useState<string | null>(null);
  const [batchEditLoading, setBatchEditLoading] = useState(false);
  const [batchEditSaving, setBatchEditSaving] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchEditPref, setBatchEditPref] = useState<SchedulePreference>({ days: [], times: {} });
  const [batchEditMode, setBatchEditMode] = useState<'online' | 'offline'>('online');
  const [batchEditDuration, setBatchEditDuration] = useState(60);
  const [batchEditRoster, setBatchEditRoster] = useState<{ enrollmentId: string; childName: string; status: string }[]>([]);
  const [batchEditConfirmed, setBatchEditConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);

  // 2G-3: reassign ("Move to batch") modal (session-mutating — confirm → success/partial standard)
  const [reassignFor, setReassignFor] = useState<{ onboardingId: string; childName: string } | null>(null);
  const [reassignCandidates, setReassignCandidates] = useState<BatchCandidate[]>([]);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignPick, setReassignPick] = useState<string>('');
  const [reassignSaving, setReassignSaving] = useState(false);

  useEffect(() => { loadBatches(); }, []);

  // Banner setter. 2G-2.5-fix: ONLY 'success' auto-dismisses (4s); 'error'/'warn' PERSIST until
  // the next action or a manual dismiss (× button).
  function showFeedback(type: 'success' | 'error' | 'warn', text: string) {
    setFeedback({ type, text });
    if (type === 'success') setTimeout(() => setFeedback(null), 4000);
  }

  // 2G-3: open the "Move to batch" picker for one student. Candidates = same coach, confirmed,
  // excluding the current batch — resolved + ownership-scoped server-side from the onboardingId.
  async function openReassign(onboardingId: string, childName: string) {
    setReassignFor({ onboardingId, childName });
    setReassignPick('');
    setReassignCandidates([]);
    setReassignLoading(true);
    try {
      const res = await fetch(`/api/tuition/batches/candidates?onboardingId=${onboardingId}`);
      if (res.ok) {
        const d = await res.json();
        setReassignCandidates(d.candidates || []);
      } else if (res.status === 403) {
        showFeedback('error', 'You can only reassign between your own batches.');
        setReassignFor(null);
      } else {
        showFeedback('error', 'Couldn’t load target batches. Please retry.');
        setReassignFor(null);
      }
    } catch {
      showFeedback('error', 'Network error loading batches. Please retry.');
      setReassignFor(null);
    } finally {
      setReassignLoading(false);
    }
  }

  // Session-mutating: PRE-ACTION confirm states the blast radius before the POST.
  async function confirmReassign() {
    if (!reassignFor || !reassignPick) return;
    const child = reassignFor.childName;
    const target = reassignCandidates.find(c => c.batchId === reassignPick);
    const label = target ? formatBatchCandidateLabel(target) : 'the selected batch';
    if (!window.confirm(
      `Move ${child} to ${label}? This reschedules their future sessions onto that batch’s schedule (cancels the old future sessions, regenerates on the new one). Balance is unchanged; past sessions are untouched.`
    )) return;

    setReassignSaving(true);
    try {
      const res = await fetch('/api/admin/tuition/reassign-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingId: reassignFor.onboardingId, newBatchId: reassignPick }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        showFeedback('success', `${child} moved — ${d.created ?? 0} sessions rescheduled.`);
        setReassignFor(null);
        loadBatches();
      } else if (res.status === 409) {
        showFeedback('error', `Couldn’t move ${child} — target batch schedule isn’t confirmed yet. Confirm it, then retry.`);
      } else if (res.status === 403) {
        showFeedback('error', 'You can only reassign between your own batches.');
      } else {
        showFeedback('error', `Couldn’t move ${child} — ${d.error || 'rescheduling failed'}. Please retry.`);
      }
    } catch {
      showFeedback('error', 'Network error. Please retry.');
    } finally {
      setReassignSaving(false);
    }
  }

  async function openBatchEdit(batchId: string) {
    setBatchEditId(batchId);
    setBatchEditLoading(true);
    try {
      const res = await fetch(`/api/admin/tuition/batches/${batchId}`);
      if (res.ok) {
        const d = await res.json();
        setBatchEditPref({
          days: d.days || [],
          times: d.times || {},
          defaultTime: d.default_time ? String(d.default_time).slice(0, 5) : undefined,
        });
        setBatchEditMode(d.session_mode === 'online' ? 'online' : 'offline');
        setBatchEditDuration(d.duration_minutes || 60);
        setBatchEditRoster(d.roster || []);
        setBatchEditConfirmed(!!d.schedule_confirmed);
      } else if (res.status === 403) {
        showFeedback('error', 'You can only edit your own batches.');
        setBatchEditId(null);
      }
    } catch { /* ignore */ } finally { setBatchEditLoading(false); }
  }

  async function handleBatchSave() {
    if (!batchEditId) return;
    const days = batchEditPref.days || [];
    const time = batchEditPref.defaultTime || (Object.values(batchEditPref.times || {})[0] as string | undefined);
    if (days.length === 0 || !time) {
      showFeedback('error', 'Pick at least one day and a time before saving.');
      return;
    }
    const names = batchEditRoster.map(r => r.childName).join(', ');
    if (!window.confirm(`This will reschedule future sessions for ${batchEditRoster.length} student(s): ${names || '—'}. Balances unchanged, past sessions untouched. Continue?`)) return;
    setBatchEditSaving(true);
    try {
      const res = await fetch(`/api/admin/tuition/batches/${batchEditId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days,
          times: batchEditPref.times || {},
          default_time: batchEditPref.defaultTime || null,
          session_mode: batchEditMode,
          duration_minutes: batchEditDuration,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        const warn = Array.isArray(d.warnings) && d.warnings.length > 0;
        if (warn) showFeedback('warn', `Updated — ${d.created} rescheduled across ${d.memberCount}. Heads up — ${d.warnings[0]}`);
        else showFeedback('success', `Updated — ${d.created} sessions rescheduled across ${d.memberCount} students.`);
        setBatchEditId(null);
        loadBatches();
      } else if (res.status === 409) {
        const c = (d.conflicts || [])[0];
        showFeedback('error', c ? `Time clash — ${c.label} at ${c.start} that day. Pick another time.` : 'Time clash with an existing batch. Pick another time.');
      } else if (res.status === 207) {
        const failedNames = (d.failures || []).map((f: { childName: string }) => f.childName).join(', ');
        showFeedback('error', `Partial: ${d.memberCount - d.failures.length} of ${d.memberCount} updated — ${d.failures.length} failed (${failedNames}). Retry to complete.`);
        loadBatches();
      } else {
        showFeedback('error', d.error || 'Failed to update batch schedule.');
      }
    } catch {
      showFeedback('error', 'Network error. Please retry.');
    } finally {
      setBatchEditSaving(false);
    }
  }

  // 2G-2.5-fix3: soft-retire a batch — cancels members' future sessions + frees the slot. The
  // pre-action confirm states the blast radius (N students, slot freed, irreversible).
  async function handleBatchDelete() {
    if (!batchEditId) return;
    const n = batchEditRoster.length;
    const names = batchEditRoster.map(r => r.childName).join(', ');
    if (!window.confirm(
      `Delete this class? Cancels future sessions for ${n} student${n === 1 ? '' : 's'}${names ? ` (${names})` : ''} and frees the slot. Students can return but will get a new batch. This can't be undone.`
    )) return;
    setBatchDeleting(true);
    try {
      const res = await fetch(`/api/admin/tuition/batches/${batchEditId}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        const sc = d.sessionsCancelled ?? 0;
        const ma = d.membersAffected ?? 0;
        showFeedback('success', `Class deleted — ${sc} future session${sc === 1 ? '' : 's'} cancelled across ${ma} student${ma === 1 ? '' : 's'}. The slot is now free.`);
        setBatchEditId(null);
        loadBatches();
      } else if (res.status === 403) {
        showFeedback('error', 'You can only delete your own classes.');
      } else {
        showFeedback('error', d.error || 'Failed to delete class.');
      }
    } catch {
      showFeedback('error', 'Network error. Please retry.');
    } finally {
      setBatchDeleting(false);
    }
  }

  const loadBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!coach) return;

      // Fetch all tuition onboardings for this coach
      const { data: rows } = await supabase
        .from('tuition_onboarding')
        .select('id, batch_id, child_id, child_name, session_rate, session_duration_minutes, sessions_per_week, sessions_purchased, default_session_mode')
        .eq('coach_id', coach.id)
        .eq('status', 'parent_completed');

      if (!rows?.length) { setBatches([]); return; }

      // Fetch completed session counts
      const childIds = rows.map(r => r.child_id).filter(Boolean);
      const { data: completedRows } = await supabase
        .from('scheduled_sessions')
        .select('child_id')
        .in('child_id', childIds)
        .eq('session_type', 'tuition')
        .eq('status', 'completed');

      const completedMap = new Map<string, number>();
      for (const s of completedRows || []) {
        if (s.child_id) completedMap.set(s.child_id, (completedMap.get(s.child_id) || 0) + 1);
      }

      // Group by batch_id
      const batchMap = new Map<string, BatchData>();
      for (const r of rows) {
        const bid = (r as any).batch_id as string;
        if (!bid) continue;

        const student: StudentProgress = {
          onboardingId: r.id,
          childId: r.child_id || '',
          childName: r.child_name,
          completed: completedMap.get(r.child_id || '') || 0,
          purchased: r.sessions_purchased || 0,
        };

        const existing = batchMap.get(bid);
        if (existing) {
          existing.students.push(student);
        } else {
          batchMap.set(bid, {
            batchId: bid,
            rate: r.session_rate,
            duration: r.session_duration_minutes ?? 60,
            frequency: r.sessions_per_week ?? 2,
            mode: r.default_session_mode || 'online',
            scheduleConfirmed: true, // default true; overwritten by the tuition_batches read below
            students: [student],
          });
        }
      }

      // 2G-5: fetch schedule_confirmed per batch so the list can flag unconfirmed ones. tuition_batches
      // not in generated types yet → 'as any' on the client (2B precedent). Thin read, no writes.
      // 2G-2.5-fix3: also read status → drop deleted (retired) batches from the list entirely.
      const bids = Array.from(batchMap.keys());
      if (bids.length > 0) {
        const { data: batchRows } = await (supabase as any)
          .from('tuition_batches')
          .select('id, schedule_confirmed, status')
          .in('id', bids);
        for (const b of (batchRows ?? []) as Array<{ id: string; schedule_confirmed: boolean | null; status: string | null }>) {
          if (b.status === 'deleted') { batchMap.delete(b.id); continue; }
          const bd = batchMap.get(b.id);
          if (bd) bd.scheduleConfirmed = !!b.schedule_confirmed;
        }
      }

      setBatches(Array.from(batchMap.values()).sort((a, b) => b.students.length - a.students.length));
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        subtitle={`${batches.length} classes, ${batches.reduce((s, b) => s + b.students.length, 0)} students`}
        action={
          <Link
            href="/coach/onboard-student"
            className="h-9 px-4 rounded-xl text-sm font-medium bg-[#00ABFF] text-white hover:bg-[#00ABFF]/90 inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Student
          </Link>
        }
      />

      {feedback && (
        <div className={`p-3 rounded-xl text-sm border flex items-start gap-2 ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : feedback.type === 'warn' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
          <span className="flex-1">{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss"
            className="flex-shrink-0 -mr-1 -mt-0.5 opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {batches.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No tuition students yet"
          description="Onboard your first student to get started with tuition classes."
          action={{ label: 'Onboard Student', href: '/coach/onboard-student' }}
        />
      ) : (
        <div className="space-y-4">
          {batches.map(batch => {
            const isSolo = batch.students.length === 1;
            return (
              <div
                key={batch.batchId}
                className="bg-surface-1/50 rounded-2xl border border-border p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSolo ? (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br ${getAvatarColor(batch.students[0].childName)}`}>
                        {batch.students[0].childName.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#00ABFF]/20 flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#00ABFF]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {isSolo ? batch.students[0].childName : `Batch (${batch.students.length} students)`}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-text-tertiary">
                        <span>{batch.rate / 100}/session</span>
                        <span>&middot;</span>
                        <span><Clock className="w-3 h-3 inline" /> {batch.duration}m</span>
                        <span>&middot;</span>
                        <span>{batch.frequency}x/week</span>
                        <span>&middot;</span>
                        <span>{batch.mode === 'online' ? <Video className="w-3 h-3 inline" /> : <MapPin className="w-3 h-3 inline" />} {batch.mode === 'online' ? 'Online' : 'In-Person'}</span>
                      </div>
                      {/* 2G-5: unconfirmed-schedule badge → opens the batch-edit modal to fix it. */}
                      {!batch.scheduleConfirmed && (
                        <button type="button" onClick={() => openBatchEdit(batch.batchId)}
                          title="Set a day & time to confirm this batch's schedule."
                          className="mt-1 inline-flex items-center gap-1 bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-lg text-[11px] font-medium hover:bg-amber-500/20 transition-colors">
                          <AlertTriangle className="w-3 h-3" />
                          Schedule not confirmed
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSolo && (
                      <button type="button" onClick={() => openReassign(batch.students[0].onboardingId, batch.students[0].childName)}
                        title="Move to another batch"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 text-gray-300 hover:bg-white/[0.08] transition-all duration-200">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => openBatchEdit(batch.batchId)}
                      title="Edit batch schedule"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 text-gray-300 hover:bg-white/[0.08] transition-all duration-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/coach/onboard-student?batchId=${batch.batchId}`}
                      className="min-h-[44px] px-3 rounded-xl text-xs font-medium border border-gray-600 text-gray-300 hover:bg-gray-700 inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />Add
                    </Link>
                  </div>
                </div>

                {/* Students */}
                {!isSolo && (
                  <div className="space-y-2 pl-10">
                    {batch.students.map(student => {
                      const pct = student.purchased > 0 ? Math.round((student.completed / student.purchased) * 100) : 0;
                      return (
                        <div key={student.childId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-[10px] bg-gradient-to-br ${getAvatarColor(student.childName)}`}>
                              {student.childName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-white">{student.childName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full bg-[#00ABFF] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-text-tertiary w-12 text-right">{student.completed}/{student.purchased}</span>
                            <button type="button" onClick={() => openReassign(student.onboardingId, student.childName)}
                              title="Move to another batch"
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 text-gray-300 hover:bg-white/[0.08] transition-all duration-200">
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Solo student progress */}
                {isSolo && (
                  <div className="flex items-center justify-between pl-10">
                    <span className="text-xs text-text-tertiary">Progress</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00ABFF] rounded-full"
                          style={{ width: `${batch.students[0].purchased > 0 ? Math.round((batch.students[0].completed / batch.students[0].purchased) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-tertiary">{batch.students[0].completed}/{batch.students[0].purchased}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reassign / Move-to-batch Modal (2G-3) — session-mutating: pick → confirm → success/partial */}
      {reassignFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-semibold text-white">Move {reassignFor.childName} to a batch</h2>
              <p className="text-xs text-gray-400 mt-1">
                Reschedules future sessions onto the chosen batch. Balance unchanged; past sessions untouched.
              </p>
            </div>

            {reassignLoading ? (
              <div className="py-8 flex justify-center"><Spinner size="lg" className="text-[#00ABFF]" /></div>
            ) : reassignCandidates.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-400">
                No other confirmed batches. Create or confirm a batch first.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {reassignCandidates.map(c => (
                  <button key={c.batchId} type="button"
                    aria-pressed={reassignPick === c.batchId}
                    onClick={() => setReassignPick(c.batchId)}
                    className={`text-left min-h-[44px] rounded-xl px-3 py-2 text-sm transition-all duration-200 ${reassignPick === c.batchId ? 'bg-cyan-500 text-white' : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/[0.08]'}`}>
                    {formatBatchCandidateLabel(c)}
                    <span className={`ml-2 text-xs ${reassignPick === c.batchId ? 'text-white/80' : 'text-gray-500'}`}>
                      {c.mode === 'online' ? 'Online' : 'In-Person'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button type="button" onClick={() => setReassignFor(null)}
                className="min-h-[44px] px-4 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5 transition-all duration-200">
                Cancel
              </button>
              <button type="button" onClick={confirmReassign}
                disabled={!reassignPick || reassignSaving}
                className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all duration-200">
                {reassignSaving ? <Spinner size="sm" /> : <ArrowLeftRight className="w-4 h-4" />}
                Move &amp; reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Schedule-Edit Modal (2G-2) — session-mutating: confirm → success/partial */}
      {batchEditId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">Edit batch schedule</h2>
            {batchEditLoading ? (
              <div className="py-8 flex justify-center"><Spinner size="lg" className="text-[#00ABFF]" /></div>
            ) : (
              <>
                <div className="bg-white/5 rounded-xl border border-white/10 p-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Users className="w-4 h-4" />{batchEditRoster.length} student{batchEditRoster.length === 1 ? '' : 's'}
                    {!batchEditConfirmed && <span className="ml-auto bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-lg">unconfirmed</span>}
                  </div>
                  <p className="text-gray-300 text-xs">{batchEditRoster.map(r => r.childName).join(', ') || '—'}</p>
                </div>

                {/* 2G-5: explain the generation gate when unconfirmed — set a day+time & save to confirm. */}
                {!batchEditConfirmed && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Set a day &amp; time and save to confirm this class. Sessions won&apos;t generate until the schedule is confirmed.</span>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">Mode</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setBatchEditMode('online')}
                      className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200 ${batchEditMode === 'online' ? 'bg-cyan-500 text-white' : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/[0.08]'}`}>
                      <Video className="w-3.5 h-3.5" />Online
                    </button>
                    <button type="button" onClick={() => setBatchEditMode('offline')}
                      className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200 ${batchEditMode === 'offline' ? 'bg-cyan-500 text-white' : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/[0.08]'}`}>
                      <MapPin className="w-3.5 h-3.5" />In-Person
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">Duration</label>
                  <div className="flex gap-2 flex-wrap">
                    {[30, 45, 60, 90, 120].map(d => (
                      <button key={d} type="button" onClick={() => setBatchEditDuration(d)}
                        className={`min-h-[44px] px-3.5 rounded-xl text-sm font-medium flex items-center gap-1 transition-all duration-200 ${batchEditDuration === d ? 'bg-cyan-500 text-white' : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/[0.08]'}`}>
                        <Clock className="w-3 h-3" />{d}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">Schedule</label>
                  <ScheduleCapture value={batchEditPref} onChange={setBatchEditPref} tone="dark" />
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
                  Saving reschedules every member&apos;s future sessions onto this schedule. Balances are unchanged; past sessions are untouched.
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                  {/* 2G-2.5-fix3: soft-retire this class (destructive → red). */}
                  <button type="button" onClick={handleBatchDelete} disabled={batchDeleting || batchEditSaving}
                    className="min-h-[44px] px-3 rounded-xl text-sm text-red-300 hover:text-red-200 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all duration-200">
                    {batchDeleting ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                    Delete class
                  </button>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <button type="button" onClick={() => setBatchEditId(null)}
                      className="min-h-[44px] px-4 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5 transition-all duration-200">
                      Cancel
                    </button>
                    <button type="button" onClick={handleBatchSave} disabled={batchEditSaving || batchDeleting}
                      className="min-h-[44px] px-4 rounded-xl text-sm font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all duration-200">
                      {batchEditSaving ? <Spinner size="sm" /> : <Pencil className="w-4 h-4" />}
                      Save &amp; reschedule
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
