// ============================================================
// SESSION PREP HUB PAGE
// File: app/coach/sessions/[sessionId]/prep/page.tsx
// Coach preparation area before a session
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Clock, User, BookOpen, AlertTriangle,
  Sparkles, Target, CheckCircle, Loader2, Play,
  ChevronDown, ChevronUp, MessageSquare, FileText
} from 'lucide-react';
import SessionFeedbackForm from '@/components/shared/SessionFeedbackForm';
import { SkillTagDisplay } from '@/components/shared/SkillTagSelector';

interface SessionData {
  id: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  google_meet_link: string | null;
  prep_notes: string | null;
  focus_area: string | null;
  children: {
    id: string;
    child_name: string;
    age: number;
    learning_needs: string[];
    primary_focus_area: string | null;
    latest_assessment_score: number | null;
    assessment_wpm: number | null;
    parent_name: string;
    parent_email: string;
  };
  coaches: {
    id: string;
    name: string;
    email: string;
  };
}

interface LearningHistory {
  recent_sessions: any[];
  learning_events: any[];
  patterns: {
    common_struggles: string[];
    improved_skills: string[];
    engagement_trend: 'improving' | 'stable' | 'declining';
    suggested_focus: string[];
  };
}

export default function SessionPrepHub() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [history, setHistory] = useState<LearningHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prepNotes, setPrepNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    history: true,
    patterns: true,
    notes: true,
  });

  // Fetch session data
  useEffect(() => {
    async function fetchSessionData() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sessions/${sessionId}/feedback`);
        
        if (!response.ok) {
          throw new Error('Failed to load session data');
        }
        
        const data = await response.json();
        setSession(data.session);
        setHistory(data.learning_history);
        setPrepNotes(data.session.prep_notes || '');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId]);

  // Save prep notes
  const saveNotes = async () => {
    try {
      setIsSavingNotes(true);
      const response = await fetch(`/api/sessions/${sessionId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prep_notes: prepNotes }),
      });

      if (!response.ok) throw new Error('Failed to save notes');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Toggle section
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Submit feedback
  const handleFeedbackSubmit = async (feedback: any) => {
    const response = await fetch(`/api/sessions/${sessionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to submit feedback');
    }

    setShowFeedbackForm(false);
    router.push('/coach/sessions');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-text-tertiary">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Session not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const child = session.children;
  const isCompleted = session.status === 'completed';
  const isToday = new Date(session.scheduled_date).toDateString() === new Date().toDateString();

  return (
    <div className="text-white">
      {/* Header */}
      <header className="border-b border-border bg-surface-1 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text-tertiary" />
              </button>
              <div>
                <h1 className="text-lg font-bold">Session #{session.session_number} Prep</h1>
                <p className="text-sm text-text-tertiary">
                  {child.child_name} • {new Date(session.scheduled_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })} at {session.scheduled_time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isCompleted && session.google_meet_link && (
                <a
                  href={session.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Play className="w-4 h-4" />
                  {isToday ? 'Join Session' : 'Session Link'}
                </a>
              )}
              {isCompleted && (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FileText className="w-4 h-4" />
                  Add Feedback
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Child Overview */}
            <div className="bg-surface-1 rounded-xl border border-border p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                  {child.child_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{child.child_name}</h2>
                  <p className="text-text-tertiary">Age {child.age} • Parent: {child.parent_name}</p>
                  
                  {/* Quick Stats */}
                  <div className="flex gap-6 mt-3">
                    {child.latest_assessment_score && (
                      <div>
                        <p className="text-2xl font-bold text-blue-400">{child.latest_assessment_score}</p>
                        <p className="text-xs text-text-tertiary">Assessment Score</p>
                      </div>
                    )}
                    {child.assessment_wpm && (
                      <div>
                        <p className="text-2xl font-bold text-blue-400">{child.assessment_wpm}</p>
                        <p className="text-xs text-text-tertiary">WPM</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Learning Needs */}
              {child.learning_needs && child.learning_needs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-text-tertiary mb-2">Learning Needs</p>
                  <SkillTagDisplay tags={child.learning_needs} maxVisible={10} />
                </div>
              )}

              {child.primary_focus_area && (
                <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-blue-400">Primary Focus:</span>
                    <span className="font-medium">{child.primary_focus_area}</span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Patterns & Insights */}
            {history?.patterns && (
              <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('patterns')}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-2/50"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <span className="font-semibold">AI Insights & Patterns</span>
                  </div>
                  {expandedSections.patterns ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.patterns && (
                  <div className="px-6 pb-6 space-y-4">
                    {/* Engagement Trend */}
                    <div className={`
                      p-3 rounded-lg border
                      ${history.patterns.engagement_trend === 'improving' 
                        ? 'bg-green-900/20 border-green-800/30' 
                        : history.patterns.engagement_trend === 'declining'
                          ? 'bg-red-900/20 border-red-800/30'
                          : 'bg-surface-2/50 border-border'
                      }
                    `}>
                      <p className="text-sm">
                        <span className="font-medium">Engagement Trend: </span>
                        <span className={
                          history.patterns.engagement_trend === 'improving' ? 'text-green-400' :
                          history.patterns.engagement_trend === 'declining' ? 'text-red-400' :
                          'text-text-tertiary'
                        }>
                          {history.patterns.engagement_trend === 'improving' ? '📈 Improving' :
                           history.patterns.engagement_trend === 'declining' ? '📉 Declining' :
                           '➡️ Stable'}
                        </span>
                      </p>
                    </div>

                    {/* Suggested Focus */}
                    {history.patterns.suggested_focus.length > 0 && (
                      <div>
                        <p className="text-sm text-text-tertiary mb-2 flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          Suggested Focus Areas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {history.patterns.suggested_focus.map(skill => (
                            <span key={skill} className="px-3 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Common Struggles */}
                    {history.patterns.common_struggles.length > 0 && (
                      <div>
                        <p className="text-sm text-text-tertiary mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-orange-400" />
                          Common Struggles
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {history.patterns.common_struggles.map(skill => (
                            <span key={skill} className="px-3 py-1 bg-orange-900/30 text-orange-400 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Improved Skills */}
                    {history.patterns.improved_skills.length > 0 && (
                      <div>
                        <p className="text-sm text-text-tertiary mb-2 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          Improved Skills
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {history.patterns.improved_skills.map(skill => (
                            <span key={skill} className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recent Sessions History */}
            {history?.recent_sessions && history.recent_sessions.length > 0 && (
              <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('history')}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-2/50"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">Recent Sessions ({history.recent_sessions.length})</span>
                  </div>
                  {expandedSections.history ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.history && (
                  <div className="px-6 pb-6 space-y-3">
                    {history.recent_sessions.map((sess, index) => (
                      <div key={sess.id} className="p-4 bg-surface-2/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            Session #{sess.session_number || index + 1}
                          </span>
                          <span className="text-sm text-text-tertiary">
                            {new Date(sess.scheduled_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        {sess.focus_area && (
                          <p className="text-sm text-text-secondary mb-2">Focus: {sess.focus_area}</p>
                        )}

                        <div className="flex items-center gap-3 text-sm">
                          {sess.progress_rating && (
                            <span className={`
                              px-2 py-0.5 rounded-full
                              ${sess.progress_rating === 'improved' ? 'bg-green-900/30 text-green-400' :
                                sess.progress_rating === 'struggled' ? 'bg-red-900/30 text-red-400' :
                                'bg-surface-2 text-text-secondary'}
                            `}>
                              {sess.progress_rating === 'improved' ? '📈' : 
                               sess.progress_rating === 'struggled' ? '📉' : '➡️'} {sess.progress_rating}
                            </span>
                          )}
                          {sess.rating_overall && (
                            <span className="text-yellow-400">★ {sess.rating_overall}</span>
                          )}
                        </div>

                        {sess.breakthrough_moment && (
                          <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-800/30 rounded text-sm">
                            <span className="text-yellow-400">✨ Breakthrough: </span>
                            {sess.breakthrough_moment}
                          </div>
                        )}

                        {sess.concerns_noted && (
                          <div className="mt-2 p-2 bg-red-900/20 border border-red-800/30 rounded text-sm">
                            <span className="text-red-400">⚠️ Concern: </span>
                            {sess.concerns_noted}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Prep Notes */}
            <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => toggleSection('notes')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-1/50"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold">Session Notes</span>
                </div>
                {expandedSections.notes ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {expandedSections.notes && (
                <div className="px-6 pb-6">
                  <textarea
                    value={prepNotes}
                    onChange={(e) => setPrepNotes(e.target.value)}
                    placeholder="Add your notes for this session..."
                    rows={6}
                    className="w-full px-4 py-3 bg-surface-0 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <button
                    onClick={saveNotes}
                    disabled={isSavingNotes}
                    className="mt-3 w-full py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm disabled:opacity-50"
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-surface-1 rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push(`/coach/chat/${child.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-surface-2 hover:bg-surface-3 rounded-lg text-left"
                >
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <span>Message Parent</span>
                </button>
                <button
                  onClick={() => router.push(`/coach/students/${child.id}`)}
                  className="w-full flex items-center gap-3 p-3 bg-surface-2 hover:bg-surface-3 rounded-lg text-left"
                >
                  <User className="w-5 h-5 text-purple-400" />
                  <span>View Student Profile</span>
                </button>
              </div>
            </div>

            {/* Session Info */}
            <div className="bg-surface-1 rounded-xl border border-border p-6">
              <h3 className="font-semibold mb-4">Session Info</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Status</dt>
                  <dd className={`font-medium ${
                    session.status === 'completed' ? 'text-green-400' :
                    session.status === 'scheduled' ? 'text-blue-400' :
                    'text-text-tertiary'
                  }`}>
                    {session.status}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Session #</dt>
                  <dd className="font-medium">{session.session_number}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Date</dt>
                  <dd className="font-medium">{session.scheduled_date}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-tertiary">Time</dt>
                  <dd className="font-medium">{session.scheduled_time}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <SessionFeedbackForm
              sessionId={sessionId}
              childName={child.child_name}
              sessionNumber={session.session_number}
              onSubmit={handleFeedbackSubmit}
              onCancel={() => setShowFeedbackForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
