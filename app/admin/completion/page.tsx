// =============================================================================
// FILE: app/admin/completion/page.tsx
// PURPOSE: Completion Management - track, trigger, and manage program completions
// UPDATED: Added risk categories (Overdue, At Risk, Inactive, Ready)
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle, Clock, Send, Award, AlertCircle,
  Loader2, Search, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, XCircle, Activity, Users,
  Download, Calendar, User, Zap
} from 'lucide-react';

interface Enrollment {
  id: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  coachName: string;
  status: string;
  riskLevel: string;
  programStart: string;
  programEnd: string;
  daysRemaining: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  lastSessionDate: string | null;
  daysSinceLastSession: number | null;
  hasInitialAssessment: boolean;
  hasFinalAssessment: boolean;
  finalAssessmentSent: boolean;
  npsSubmitted: boolean;
  npsScore: number | null;
  certificateNumber: string | null;
  completedAt: string | null;
}

type FilterType = 'all' | 'overdue' | 'at_risk' | 'inactive' | 'ready' | 'on_track' | 'completed';

export default function CompletionManagementPage() {
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  async function fetchEnrollments() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/completion/list');
      const data = await res.json();
      if (data.success) {
        setEnrollments(data.enrollments || []);
      }
    } catch (err) {
      console.error('Failed to fetch enrollments:', err);
    }
    setLoading(false);
  }

  async function sendFinalAssessment(enrollmentId: string, parentEmail: string, childName: string) {
    setActionLoading(enrollmentId + '_assessment');
    try {
      const res = await fetch('/api/admin/completion/send-final-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, parentEmail, childName }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Final assessment link sent to ${parentEmail}`);
        fetchEnrollments();
      } else {
        alert(data.error || 'Failed to send');
      }
    } catch (err) {
      alert('Failed to send assessment link');
    }
    setActionLoading(null);
  }

  async function triggerCompletion(enrollmentId: string, force: boolean = false) {
    const confirmMsg = force 
      ? 'This enrollment has less than 9 sessions. Mark as complete anyway?' 
      : 'Mark this program as complete?';
    if (!confirm(confirmMsg)) return;
    
    setActionLoading(enrollmentId + '_complete');
    try {
      const res = await fetch(`/api/completion/trigger/${enrollmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Program completed! Certificate: ${data.data.certificateNumber}`);
        fetchEnrollments();
      } else {
        alert(data.error || 'Failed to complete');
      }
    } catch (err) {
      alert('Failed to trigger completion');
    }
    setActionLoading(null);
  }

  async function downloadCertificate(enrollmentId: string) {
    window.open(`/api/certificate/pdf?enrollment=${enrollmentId}`, '_blank');
  }

  async function extendProgram(enrollmentId: string, childName: string) {
    const days = prompt(`Extend ${childName}'s program by how many days?`, '14');
    if (!days) return;
    
    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
      alert('Please enter a valid number between 1 and 90');
      return;
    }

    setActionLoading(enrollmentId + '_extend');
    try {
      const res = await fetch('/api/admin/completion/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, days: daysNum }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Program extended! New end date: ${new Date(data.newEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
        fetchEnrollments();
      } else {
        alert(data.error || 'Failed to extend');
      }
    } catch (err) {
      alert('Failed to extend program');
    }
    setActionLoading(null);
  }

  async function runCronManually() {
    setActionLoading('cron');
    try {
      const res = await fetch('/api/cron/enrollment-lifecycle', { method: 'GET' });
      const data = await res.json();
      if (data.success) {
        alert(`Cron completed! Check results in console.`);
        fetchEnrollments();
      } else {
        alert(data.error || 'Failed to run cron');
      }
    } catch (err) {
      alert('Failed to run cron');
    }
    setActionLoading(null);
  }

  // Calculate stats
  const stats = {
    total: enrollments.filter(e => e.status !== 'completed').length,
    overdue: enrollments.filter(e => e.riskLevel === 'overdue').length,
    atRisk: enrollments.filter(e => e.riskLevel === 'at_risk').length,
    inactive: enrollments.filter(e => e.riskLevel === 'inactive').length,
    ready: enrollments.filter(e => e.riskLevel === 'ready' || (e.sessionsCompleted >= (e.sessionsTotal || 9) && e.status !== 'completed')).length,
    onTrack: enrollments.filter(e => e.riskLevel === 'on_track' || e.riskLevel === 'active').length,
    completed: enrollments.filter(e => e.status === 'completed').length,
  };

  // Filter logic
  const filteredEnrollments = enrollments.filter(e => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (!e.childName?.toLowerCase().includes(searchLower) &&
          !e.parentName?.toLowerCase().includes(searchLower) &&
          !e.parentEmail?.toLowerCase().includes(searchLower) &&
          !e.coachName?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Status filter
    switch (filter) {
      case 'overdue':
        return e.riskLevel === 'overdue';
      case 'at_risk':
        return e.riskLevel === 'at_risk';
      case 'inactive':
        return e.riskLevel === 'inactive';
      case 'ready':
        return e.riskLevel === 'ready' || (e.sessionsCompleted >= (e.sessionsTotal || 9) && e.status !== 'completed');
      case 'on_track':
        return e.riskLevel === 'on_track' || e.riskLevel === 'active';
      case 'completed':
        return e.status === 'completed';
      default:
        return true;
    }
  });

  // Sort: overdue first, then at_risk, then by program_end
  const sortedEnrollments = [...filteredEnrollments].sort((a, b) => {
    const riskOrder: Record<string, number> = { overdue: 0, at_risk: 1, inactive: 2, ready: 3, on_track: 4, active: 5, completed: 6 };
    const aRisk = riskOrder[a.riskLevel] ?? 5;
    const bRisk = riskOrder[b.riskLevel] ?? 5;
    if (aRisk !== bRisk) return aRisk - bRisk;
    return new Date(a.programEnd).getTime() - new Date(b.programEnd).getTime();
  });

  const getRiskBadge = (enrollment: Enrollment) => {
    if (enrollment.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
          <CheckCircle className="w-3 h-3" /> Completed
        </span>
      );
    }

    switch (enrollment.riskLevel) {
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" /> Overdue
          </span>
        );
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <AlertTriangle className="w-3 h-3" /> At Risk
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Clock className="w-3 h-3" /> Inactive
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Zap className="w-3 h-3" /> Ready
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-surface-2 text-text-secondary border border-border">
            <Activity className="w-3 h-3" /> Active
          </span>
        );
    }
  };

  const getProgressColor = (completed: number, total: number) => {
    const percent = (completed / total) * 100;
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 66) return 'bg-blue-500';
    if (percent >= 33) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Completion</h1>
          <p className="text-xs sm:text-sm text-text-tertiary">Track progress & manage completions</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={runCronManually}
            disabled={actionLoading === 'cron'}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            title="Run daily alerts check"
          >
            {actionLoading === 'cron' ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">Run</span> Alerts
          </button>
          <button
            onClick={fetchEnrollments}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-surface-2 text-white rounded-lg hover:bg-surface-3 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Risk Categories */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2 lg:gap-3">
        {/* Overdue */}
        <button
          onClick={() => setFilter('overdue')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'overdue' ? 'border-red-500 bg-red-500/10' : 'border-border bg-surface-1 hover:border-red-500/50'
          }`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center ${stats.overdue > 0 ? 'bg-red-500/20' : 'bg-surface-2'}`}>
              <XCircle className={`w-4 h-4 ${stats.overdue > 0 ? 'text-red-400' : 'text-text-tertiary'}`} />
            </div>
            <div className="text-left">
              <p className={`text-base sm:text-xl font-bold ${stats.overdue > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>{stats.overdue}</p>
              <p className="text-[10px] text-text-tertiary">Overdue</p>
            </div>
          </div>
        </button>

        {/* At Risk */}
        <button
          onClick={() => setFilter('at_risk')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'at_risk' ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-surface-1 hover:border-orange-500/50'
          }`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center ${stats.atRisk > 0 ? 'bg-orange-500/20' : 'bg-surface-2'}`}>
              <AlertTriangle className={`w-4 h-4 ${stats.atRisk > 0 ? 'text-orange-400' : 'text-text-tertiary'}`} />
            </div>
            <div className="text-left">
              <p className={`text-base sm:text-xl font-bold ${stats.atRisk > 0 ? 'text-orange-400' : 'text-text-tertiary'}`}>{stats.atRisk}</p>
              <p className="text-[10px] text-text-tertiary">At Risk</p>
            </div>
          </div>
        </button>

        {/* Inactive */}
        <button
          onClick={() => setFilter('inactive')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'inactive' ? 'border-yellow-500 bg-yellow-500/10' : 'border-border bg-surface-1 hover:border-yellow-500/50'
          }`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center ${stats.inactive > 0 ? 'bg-yellow-500/20' : 'bg-surface-2'}`}>
              <Clock className={`w-4 h-4 ${stats.inactive > 0 ? 'text-yellow-400' : 'text-text-tertiary'}`} />
            </div>
            <div className="text-left">
              <p className={`text-base sm:text-xl font-bold ${stats.inactive > 0 ? 'text-yellow-400' : 'text-text-tertiary'}`}>{stats.inactive}</p>
              <p className="text-[10px] text-text-tertiary">Inactive</p>
            </div>
          </div>
        </button>

        {/* Ready */}
        <button
          onClick={() => setFilter('ready')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'ready' ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-surface-1 hover:border-blue-500/50'
          }`}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center ${stats.ready > 0 ? 'bg-blue-500/20' : 'bg-surface-2'}`}>
              <Zap className={`w-4 h-4 ${stats.ready > 0 ? 'text-blue-400' : 'text-text-tertiary'}`} />
            </div>
            <div className="text-left">
              <p className={`text-base sm:text-xl font-bold ${stats.ready > 0 ? 'text-blue-400' : 'text-text-tertiary'}`}>{stats.ready}</p>
              <p className="text-[10px] text-text-tertiary">Ready</p>
            </div>
          </div>
        </button>

        {/* On Track */}
        <button
          onClick={() => setFilter('on_track')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'on_track' ? 'border-green-500 bg-green-500/10' : 'border-border bg-surface-1 hover:border-green-500/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white">{stats.onTrack}</p>
              <p className="text-[10px] text-text-tertiary">On Track</p>
            </div>
          </div>
        </button>

        {/* Completed */}
        <button
          onClick={() => setFilter('completed')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'completed' ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-surface-1 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
              <p className="text-[10px] text-text-tertiary">Done</p>
            </div>
          </div>
        </button>

        {/* All */}
        <button
          onClick={() => setFilter('all')}
          className={`p-3 rounded-xl border-2 transition-all ${
            filter === 'all' ? 'border-white/50 bg-surface-2' : 'border-border bg-surface-1 hover:border-white/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-text-secondary" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-white">{enrollments.length}</p>
              <p className="text-[10px] text-text-tertiary">All</p>
            </div>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search child, parent, coach..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-surface-2 text-sm text-white placeholder:text-text-muted focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <span className="text-xs sm:text-sm text-text-tertiary whitespace-nowrap flex-shrink-0">
          {sortedEnrollments.length}/{enrollments.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-2 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase">Child</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase">Assessment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-tertiary">
                    No enrollments found
                  </td>
                </tr>
              ) : (
                sortedEnrollments.map((enrollment) => (
                  <>
                    <tr key={enrollment.id} className={`hover:bg-surface-2 ${enrollment.riskLevel === 'overdue' ? 'bg-red-500/10' : enrollment.riskLevel === 'at_risk' ? 'bg-orange-500/10' : ''}`}>
                      {/* Child */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{enrollment.childName}</p>
                          <p className="text-xs text-text-tertiary">{enrollment.coachName}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {getRiskBadge(enrollment)}
                        {enrollment.daysRemaining < 0 && enrollment.status !== 'completed' && (
                          <p className="text-[10px] text-red-500 mt-1">{Math.abs(enrollment.daysRemaining)}d overdue</p>
                        )}
                        {enrollment.daysRemaining > 0 && enrollment.daysRemaining <= 7 && enrollment.status !== 'completed' && (
                          <p className="text-[10px] text-orange-500 mt-1">{enrollment.daysRemaining}d left</p>
                        )}
                      </td>

                      {/* Progress */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-surface-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(enrollment.sessionsCompleted, enrollment.sessionsTotal)}`}
                              style={{ width: `${(enrollment.sessionsCompleted / enrollment.sessionsTotal) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-text-secondary">
                            {enrollment.sessionsCompleted}/{enrollment.sessionsTotal}
                          </span>
                        </div>
                        {enrollment.daysSinceLastSession !== null && enrollment.daysSinceLastSession > 7 && enrollment.status !== 'completed' && (
                          <p className="text-[10px] text-yellow-400 mt-1">{enrollment.daysSinceLastSession}d since last session</p>
                        )}
                      </td>

                      {/* End Date */}
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">
                          {new Date(enrollment.programEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </td>

                      {/* Assessment */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1" title="Initial Assessment">
                            <span className={`w-2 h-2 rounded-full ${enrollment.hasInitialAssessment ? 'bg-green-500' : 'bg-surface-3'}`} />
                            <span className="text-[10px] text-text-tertiary">I</span>
                          </div>
                          <div className="flex items-center gap-1" title="Final Assessment">
                            <span className={`w-2 h-2 rounded-full ${enrollment.hasFinalAssessment ? 'bg-green-500' : enrollment.finalAssessmentSent ? 'bg-yellow-500' : 'bg-surface-3'}`} />
                            <span className="text-[10px] text-text-tertiary">F</span>
                          </div>
                          {enrollment.npsSubmitted && (
                            <span className="text-xs font-medium text-blue-400" title="NPS Score">
                              {enrollment.npsScore}/10
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Extend Program - for overdue/at_risk */}
                          {(enrollment.riskLevel === 'overdue' || enrollment.riskLevel === 'at_risk') && enrollment.status !== 'completed' && (
                            <button
                              onClick={() => extendProgram(enrollment.id, enrollment.childName)}
                              disabled={actionLoading === enrollment.id + '_extend'}
                              className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors disabled:opacity-50"
                              title="Extend Program"
                            >
                              {actionLoading === enrollment.id + '_extend' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Calendar className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Send Final Assessment */}
                          {!enrollment.hasFinalAssessment && enrollment.sessionsCompleted >= Math.ceil((enrollment.sessionsTotal || 9) * 0.67) && enrollment.status !== 'completed' && (
                            <button
                              onClick={() => sendFinalAssessment(enrollment.id, enrollment.parentEmail, enrollment.childName)}
                              disabled={actionLoading === enrollment.id + '_assessment'}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                enrollment.finalAssessmentSent
                                  ? 'text-yellow-400 hover:bg-yellow-500/20'
                                  : 'text-blue-400 hover:bg-blue-500/20'
                              }`}
                              title={enrollment.finalAssessmentSent ? 'Resend Final Assessment' : 'Send Final Assessment'}
                            >
                              {actionLoading === enrollment.id + '_assessment' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Mark Complete */}
                          {enrollment.status !== 'completed' && (
                            <button
                              onClick={() => triggerCompletion(enrollment.id, enrollment.sessionsCompleted < (enrollment.sessionsTotal || 9))}
                              disabled={actionLoading === enrollment.id + '_complete'}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                enrollment.sessionsCompleted >= (enrollment.sessionsTotal || 9)
                                  ? 'text-green-400 hover:bg-green-500/20'
                                  : 'text-text-tertiary hover:bg-surface-2'
                              }`}
                              title={enrollment.sessionsCompleted < (enrollment.sessionsTotal || 9) ? `Force Complete (${enrollment.sessionsCompleted}/${enrollment.sessionsTotal || 9})` : 'Mark Complete'}
                            >
                              {actionLoading === enrollment.id + '_complete' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Download Certificate */}
                          {enrollment.status === 'completed' && (
                            <button
                              onClick={() => downloadCertificate(enrollment.id)}
                              className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors"
                              title="Download Certificate"
                            >
                              <Award className="w-4 h-4" />
                            </button>
                          )}

                          {/* Expand */}
                          <button
                            onClick={() => setExpandedRow(expandedRow === enrollment.id ? null : enrollment.id)}
                            className="p-2 text-text-tertiary hover:bg-surface-2 rounded-lg transition-colors"
                          >
                            {expandedRow === enrollment.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedRow === enrollment.id && (
                      <tr className="bg-surface-2">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-text-tertiary text-xs">Parent</p>
                              <p className="text-white">{enrollment.parentName}</p>
                              <p className="text-text-tertiary text-xs">{enrollment.parentEmail}</p>
                            </div>
                            <div>
                              <p className="text-text-tertiary text-xs">Program Dates</p>
                              <p className="text-white">
                                {new Date(enrollment.programStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(enrollment.programEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <div>
                              <p className="text-text-tertiary text-xs">Last Session</p>
                              <p className="text-white">
                                {enrollment.lastSessionDate
                                  ? new Date(enrollment.lastSessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : 'No sessions yet'}
                              </p>
                            </div>
                            <div>
                              <p className="text-text-tertiary text-xs">Certificate</p>
                              <p className="text-white">{enrollment.certificateNumber || '—'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue: Program ended, sessions incomplete</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> At Risk: Ending within 7 days</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Inactive: No session in 14+ days</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Ready: 9 sessions done</span>
      </div>
    </div>
  );
}
