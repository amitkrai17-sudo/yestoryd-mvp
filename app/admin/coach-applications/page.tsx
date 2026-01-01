// file: app/admin/coach-applications/page.tsx
// Admin Coach Applications - Complete V2
// FIXES: Status persistence, Powerful search with date/score filters
// Version: 2.0 - December 19, 2025

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Search, X, CheckCircle, Clock, MessageCircle, Phone,
  Mail, Play, Pause, Calendar, AlertCircle, Video,
  Award, ThumbsUp, ThumbsDown, Loader2, ExternalLink,
  RefreshCw, UserCheck, UserX, Eye, Filter, MapPin,
  CalendarDays, Target
} from 'lucide-react';

// ==================== TYPES ====================
interface CoachApplication {
  id: string;
  email: string;
  name: string;
  phone: string;
  city: string | null;
  qualification: string | null;
  experience_years: string | null;
  why_join: string | null;
  audio_statement_url: string | null;
  audio_duration_seconds: number | null;
  ai_responses: any;
  ai_total_score: number | null;
  ai_score_breakdown: any;
  ai_assessment_completed_at: string | null;
  status: string;
  interview_scheduled_at: string | null;
  interview_completed_at: string | null;
  google_meet_link: string | null;
  interview_outcome?: string | null;
  interview_notes?: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by?: string | null;
}

// ==================== STATUS CONFIG ====================
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  started: { label: 'Started', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  applied: { label: 'Applied', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ai_assessment_complete: { label: 'Assessment Done', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  qualified: { label: 'Qualified ✓', color: 'text-green-700', bgColor: 'bg-green-100' },
  not_qualified: { label: 'Not Qualified', color: 'text-red-700', bgColor: 'bg-red-100' },
  interview_scheduled: { label: 'Interview Set', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  approved: { label: 'Approved', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
  on_hold: { label: 'On Hold', color: 'text-amber-700', bgColor: 'bg-amber-100' },
};

// ==================== AUDIO PLAYER ====================
function AudioPlayer({ url, duration }: { url: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  const togglePlay = async () => {
    if (!audioRef.current || error) return;
    try {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { await audioRef.current.play(); setIsPlaying(true); }
    } catch { setError(true); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  if (!url) return <div className="text-gray-400 text-sm">No voice recording</div>;

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-2">
      <audio ref={audioRef} src={url} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)} onError={() => setError(true)}
        onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || duration || 0)} preload="metadata" />
      {error ? (
        <a href={url} target="_blank" className="text-blue-500 text-xs flex items-center gap-1"><ExternalLink className="w-3 h-3" />Open</a>
      ) : (
        <>
          <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center hover:bg-pink-600">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex-1">
            <div className="h-1.5 bg-gray-300 rounded-full"><div className="h-full bg-pink-500 rounded-full" style={{ width: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%` }} /></div>
            <div className="text-xs text-gray-500 mt-0.5">{formatTime(currentTime)} / {formatTime(audioDuration)}</div>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== SCHEDULE MODAL ====================
function ScheduleModal({ app, onClose, onDone }: { app: CoachApplication; onClose: () => void; onDone: (updatedApp: Partial<CoachApplication>) => void }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSchedule = async () => {
    if (!date || !time) return;
    setLoading(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const res = await fetch(`/api/admin/coach-applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'interview_scheduled',
          interview_scheduled_at: scheduledAt
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onDone({
          status: data.application.status,
          interview_scheduled_at: data.application.interview_scheduled_at,
          google_meet_link: data.application.google_meet_link
        });
        onClose();
      } else {
        alert('Failed to schedule');
      }
    } catch (e) {
      alert('Error scheduling interview');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-900 mb-4">Schedule Interview</h3>
        <div className="space-y-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border rounded text-gray-900 bg-white" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-2 border rounded text-gray-900 bg-white" />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-gray-700">Cancel</button>
          <button onClick={handleSchedule} disabled={loading || !date || !time} className="flex-1 py-2 bg-indigo-500 text-white rounded-lg disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== FEEDBACK MODAL ====================
function FeedbackModal({ app, onClose, onDone }: { app: CoachApplication; onClose: () => void; onDone: (updates: Partial<CoachApplication>) => void }) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!outcome) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/coach-applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_completed_at: new Date().toISOString(),
          interview_outcome: outcome,
          interview_notes: notes,
          status: outcome === 'pass' ? 'approved' : outcome === 'hold' ? 'on_hold' : 'rejected'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onDone({
          status: data.application.status,
          interview_completed_at: data.application.interview_completed_at,
          interview_outcome: data.application.interview_outcome,
          interview_notes: data.application.interview_notes
        });
        onClose();
      } else {
        alert('Failed to save feedback');
      }
    } catch (e) {
      alert('Error saving feedback');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-900 mb-4">Interview Feedback</h3>
        <div className="space-y-3">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full p-2 border rounded text-gray-900 bg-white">
            <option value="">Select outcome...</option>
            <option value="pass">✅ Pass - Approve</option>
            <option value="hold">⏸️ Hold - Need more info</option>
            <option value="fail">❌ Fail - Reject</option>
          </select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)..." rows={3} className="w-full p-2 border rounded text-gray-900 bg-white" />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-gray-700">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !outcome} className="flex-1 py-2 bg-purple-500 text-white rounded-lg disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== DETAIL MODAL ====================
function DetailModal({
  app,
  onClose,
  onUpdate
}: {
  app: CoachApplication;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CoachApplication>) => void;
}) {
  const [calculating, setCalculating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;
  const isQualified = (app.ai_total_score || 0) >= 6;
  const hasInterview = !!app.interview_scheduled_at;
  const interviewDone = !!app.interview_completed_at;

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch('/api/coach-assessment/calculate-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: app.id })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onUpdate(app.id, {
          ai_total_score: data.scores.combined,
          status: data.scores.isQualified ? 'qualified' : 'not_qualified',
          ai_score_breakdown: {
            voiceScore: data.scores.voice,
            raiScore: data.scores.rai,
            combinedScore: data.scores.combined,
            isQualified: data.scores.isQualified
          }
        });
      } else {
        alert(data.error || 'Failed to calculate score');
      }
    } catch (e) {
      console.error('Error:', e);
      alert('Error calculating score');
    }
    setCalculating(false);
  };

  const handleQuickAction = async (newStatus: string) => {
    setActionLoading(newStatus);
    try {
      console.log('🔄 Quick action:', newStatus, 'for app:', app.id);

      const res = await fetch(`/api/admin/coach-applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          reviewed_by: 'admin',
          reviewed_at: new Date().toISOString()
        })
      });

      const data = await res.json();
      console.log('📥 API response:', data);

      if (res.ok && data.success && data.application) {
        console.log('✅ Status updated to:', data.application.status);
        // CRITICAL: Use the ACTUAL status from database response
        onUpdate(app.id, {
          status: data.application.status,
          reviewed_by: data.application.reviewed_by,
          reviewed_at: data.application.reviewed_at
        });

        // 🔔 SEND NOTIFICATIONS for approved, rejected, on_hold, qualified
        if (['approved', 'rejected', 'on_hold', 'qualified'].includes(newStatus)) {
          try {
            console.log('📧 Sending notification for status:', newStatus);
            const notifyRes = await fetch('/api/coach/send-status-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                coachId: app.id,
                coachEmail: app.email,
                coachName: app.name,
                coachPhone: app.phone,
                status: newStatus === 'on_hold' ? 'hold' : newStatus
              })
            });
            const notifyData = await notifyRes.json();
            if (notifyData.success) {
              console.log('✅ Notification sent:', notifyData);
              alert(`✅ ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)} - Email ${notifyData.emailSent ? '✓' : '✗'} | WhatsApp ${notifyData.whatsappSent ? '✓' : '✗'}`);
            } else {
              console.error('❌ Notification failed:', notifyData.error);
            }
          } catch (notifyErr) {
            console.error('❌ Notification error:', notifyErr);
          }
        }
      } else {
        console.error('❌ Failed:', data.error);
        alert('Failed to update status: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('💥 Error:', err);
      alert('Failed to update');
    }
    setActionLoading(null);
  };

  const handleScheduleDone = (updates: Partial<CoachApplication>) => {
    onUpdate(app.id, updates);
  };

  const handleFeedbackDone = (updates: Partial<CoachApplication>) => {
    onUpdate(app.id, updates);
  };

  // Get AI conversation
  const aiConversation = Array.isArray(app.ai_responses) ? app.ai_responses : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-r from-pink-500 to-purple-600 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{app.name}</h2>
                <p className="text-white/80 text-sm">{app.email}</p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              {app.ai_total_score !== null && (
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${isQualified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  Score: {app.ai_total_score}/10 {isQualified ? '✓' : '✗'}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Contact + Score Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">CONTACT</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4" />{app.phone}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4" />{app.city || 'Not specified'}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <a href={`tel:${app.phone}`} className="flex-1 text-center py-1 bg-blue-500 text-white text-xs rounded">Call</a>
                  <a href={`https://wa.me/91${app.phone.replace(/\D/g, '')}`} target="_blank" className="flex-1 text-center py-1 bg-green-500 text-white text-xs rounded">WhatsApp</a>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">AI SCORE</h4>
                {app.ai_total_score !== null ? (
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{app.ai_total_score}/10</div>
                    <div className={`text-xs ${isQualified ? 'text-green-600' : 'text-red-600'}`}>
                      {isQualified ? '✓ Qualified' : '✗ Not Qualified'}
                    </div>
                    {app.ai_score_breakdown && (
                      <div className="text-xs text-gray-500 mt-1">
                        Voice: {app.ai_score_breakdown.voiceScore}/5 | Chat: {app.ai_score_breakdown.raiScore}/5
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">Not calculated</div>
                )}
              </div>
            </div>

            {/* Voice Recording */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2">VOICE INTRO ({app.audio_duration_seconds || 0}s)</h4>
              <AudioPlayer url={app.audio_statement_url || ''} duration={app.audio_duration_seconds || undefined} />
            </div>

            {/* AI Chat */}
            {aiConversation.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">AI ASSESSMENT ({aiConversation.length} messages)</h4>
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {aiConversation.map((msg: any, i: number) => (
                    <div key={i} className={`text-sm ${msg.role === 'assistant' ? 'text-purple-700' : 'text-gray-700'}`}>
                      <span className="font-semibold">{msg.role === 'assistant' ? 'rAI: ' : 'Applicant: '}</span>
                      {msg.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interview Info */}
            {hasInterview && (
              <div className="bg-indigo-50 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-indigo-600 mb-2">INTERVIEW</h4>
                <div className="text-sm text-gray-700">
                  📅 {new Date(app.interview_scheduled_at!).toLocaleString()}
                </div>
                {app.google_meet_link && (
                  <a href={app.google_meet_link} target="_blank" className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 hover:underline">
                    <Video className="w-4 h-4" /> Join Google Meet
                  </a>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-500 mb-3">⚡ QUICK ACTIONS</h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Calculate Score */}
                <button onClick={handleCalculate} disabled={calculating || !app.audio_statement_url}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50">
                  {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  Calculate Score
                </button>

                {/* Schedule Interview */}
                <button onClick={() => setShowSchedule(true)} disabled={hasInterview}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 disabled:opacity-50">
                  <Calendar className="w-4 h-4" />
                  {hasInterview ? 'Scheduled' : 'Schedule'}
                </button>

                {/* Approve */}
                <button onClick={() => handleQuickAction('approved')} disabled={actionLoading === 'approved' || app.status === 'approved'}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-50">
                  {actionLoading === 'approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve
                </button>

                {/* Reject */}
                <button onClick={() => handleQuickAction('rejected')} disabled={actionLoading === 'rejected' || app.status === 'rejected'}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                  {actionLoading === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Reject
                </button>

                {/* Google Meet */}
                {app.google_meet_link && (
                  <a href={app.google_meet_link} target="_blank"
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                    <Video className="w-4 h-4" /> Join Meet
                  </a>
                )}

                {/* Hold */}
                <button onClick={() => handleQuickAction('on_hold')} disabled={actionLoading === 'on_hold' || app.status === 'on_hold'}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50">
                  {actionLoading === 'on_hold' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                  Hold
                </button>

                {/* Complete Interview */}
                {hasInterview && !interviewDone && (
                  <button onClick={() => setShowFeedback(true)}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 col-span-2">
                    <Award className="w-4 h-4" /> Complete Interview & Give Feedback
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSchedule && <ScheduleModal app={app} onClose={() => setShowSchedule(false)} onDone={handleScheduleDone} />}
      {showFeedback && <FeedbackModal app={app} onClose={() => setShowFeedback(false)} onDone={handleFeedbackDone} />}
    </>
  );
}

// ==================== MAIN PAGE ====================
export default function AdminCoachApplicationsPage() {
  const [applications, setApplications] = useState<CoachApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all'); // all, qualified, not_qualified
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch applications on mount
  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Add timestamp to prevent caching
      const res = await fetch(`/api/admin/coach-applications?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json();

      console.log('📥 Fetched applications:', data.applications?.length);
      console.log('📊 Sample statuses:', data.applications?.slice(0, 3).map((a: any) => ({ name: a.name, status: a.status })));

      if (res.ok && data.applications) {
        setApplications(data.applications);
      }
    } catch (e) {
      console.error('❌ Fetch error:', e);
    }
    setLoading(false);
  };

  // Update a single application in state
  const handleUpdateApplication = useCallback((id: string, updates: Partial<CoachApplication>) => {
    console.log('🔄 Updating app in state:', id, updates);
    setApplications(prev => {
      const newApps = prev.map(app =>
        app.id === id ? { ...app, ...updates } : app
      );
      console.log('✅ Updated state. New status for', id, ':', newApps.find(a => a.id === id)?.status);
      return newApps;
    });
  }, []);

  // Get selected application from applications array (single source of truth)
  const selectedApp = applications.find(app => app.id === selectedAppId) || null;

  // POWERFUL FILTER LOGIC
  const filtered = applications
    .filter(app => {
      // Status filter
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;

      // Score filter
      if (scoreFilter === 'qualified' && (app.ai_total_score === null || app.ai_total_score < 6)) return false;
      if (scoreFilter === 'not_qualified' && (app.ai_total_score === null || app.ai_total_score >= 6)) return false;
      if (scoreFilter === 'no_score' && app.ai_total_score !== null) return false;

      // Date filter
      if (dateFrom) {
        const appDate = new Date(app.created_at).setHours(0, 0, 0, 0);
        const fromDate = new Date(dateFrom).setHours(0, 0, 0, 0);
        if (appDate < fromDate) return false;
      }
      if (dateTo) {
        const appDate = new Date(app.created_at).setHours(23, 59, 59, 999);
        const toDate = new Date(dateTo).setHours(23, 59, 59, 999);
        if (appDate > toDate) return false;
      }

      // Combined search - searches across ALL fields
      if (search) {
        const s = search.toLowerCase().trim();
        const searchableText = [
          app.name,
          app.email,
          app.phone,
          app.city,
          app.qualification,
          app.status,
          app.ai_total_score?.toString(),
          new Date(app.created_at).toLocaleDateString(),
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(s);
      }

      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Stats
  const stats = {
    total: applications.length,
    pending: applications.filter(a => ['applied', 'started', 'ai_assessment_complete'].includes(a.status)).length,
    qualified: applications.filter(a => (a.ai_total_score || 0) >= 6).length,
    approved: applications.filter(a => a.status === 'approved').length,
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setScoreFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter !== 'all' || scoreFilter !== 'all' || dateFrom || dateTo || search;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Coach Applications</h1>
            <p className="text-sm text-gray-500">Quick review dashboard</p>
          </div>
          <button onClick={fetchApplications} className="p-2 bg-white border rounded-lg hover:bg-gray-50" title="Refresh">
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'border-gray-300' },
            { label: 'Pending', value: stats.pending, color: 'border-yellow-400' },
            { label: 'Qualified', value: stats.qualified, color: 'border-green-400' },
            { label: 'Approved', value: stats.approved, color: 'border-blue-400' },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-lg p-3 border-l-4 ${s.color}`}>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg p-3 mb-4 space-y-3">
          {/* Main Search Row */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, phone, city, score, date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg text-sm flex items-center gap-2 ${showFilters || hasActiveFilters ? 'bg-pink-50 border-pink-300 text-pink-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-pink-500 rounded-full"></span>}
            </button>
          </div>

          {/* Advanced Filters (Collapsible) */}
          {showFilters && (
            <div className="pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Score */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Score</label>
                <select
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="all">All Scores</option>
                  <option value="qualified">✓ Qualified (6+)</option>
                  <option value="not_qualified">✗ Not Qualified (&lt;6)</option>
                  <option value="no_score">No Score Yet</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="col-span-2 md:col-span-4">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-pink-600 hover:text-pink-700 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Count */}
        {hasActiveFilters && (
          <div className="text-sm text-gray-500 mb-3">
            Showing {filtered.length} of {applications.length} applications
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-lg overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-pink-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {hasActiveFilters ? 'No applications match your filters' : 'No applications found'}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(app => {
                const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;
                const isQ = (app.ai_total_score || 0) >= 6;
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{app.name}</span>
                        {app.ai_total_score !== null && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${isQ ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {app.ai_total_score}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{app.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bgColor} ${sc.color}`}>
                        {sc.label}
                      </span>
                      {app.city && (
                        <span className="text-xs text-gray-400 hidden md:inline">{app.city}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 w-20 text-right">
                      {new Date(app.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <DetailModal
          app={selectedApp}
          onClose={() => setSelectedAppId(null)}
          onUpdate={handleUpdateApplication}
        />
      )}
    </div>
  );
}
