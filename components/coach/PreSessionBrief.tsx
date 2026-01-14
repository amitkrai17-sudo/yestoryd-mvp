'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Target, TrendingUp, Star, AlertCircle, Heart, Calendar, Video, ChevronRight } from 'lucide-react';

interface Session {
  id: string;
  child_id: string;
  child_name: string;
  child_age: number;
  session_number?: number;
  session_type: string;
  scheduled_date: string;
  scheduled_time: string;
  google_meet_link: string;
  assessment_score: number | null;
  last_session_summary: string | null;
  last_session_date: string | null;
  last_session_focus: string | null;
  favorite_topics: string[];
  learning_style: string | null;
  challenges: string[];
  motivators: string[];
  sessions_completed: number;
  total_sessions: number;
}

interface PreSessionBriefProps {
  session: Session;
  onClose: () => void;
}

export default function PreSessionBrief({ session, onClose }: PreSessionBriefProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [aiInsights, setAiInsights] = useState<{
    recap?: string;
    current_status?: string;
    session_focus?: string;
    challenges?: string[];
    motivators?: string[];
    watch_for?: string[];
    favorite_topics?: string[];
    learning_style?: string;
    recommended_activities?: string[];
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const params = new URLSearchParams({
          childId: session.child_id,
          date: session.scheduled_date,
          time: session.scheduled_time,
          type: session.session_type
        });
        const response = await fetch(`/api/coach/session-prep?${params}`);
        if (response.ok) {
          const data = await response.json();
          setAiInsights(data.insights);
        }
      } catch (error) {
        console.error('Failed to fetch AI insights:', error);
      } finally {
        setLoadingInsights(false);
      }
    };
    fetchInsights();
  }, [session.child_id, session.scheduled_date, session.scheduled_time, session.session_type]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const progress = session.total_sessions > 0 ? Math.round((session.sessions_completed / session.total_sessions) * 100) : 0;
  const sessionNumber = session.session_number || session.sessions_completed + 1;
  const favoriteTopics = aiInsights?.favorite_topics?.length ? aiInsights.favorite_topics : (Array.isArray(session.favorite_topics) ? session.favorite_topics : []);
  const challenges = aiInsights?.challenges?.length ? aiInsights.challenges : (Array.isArray(session.challenges) ? session.challenges : []);
  const motivators = aiInsights?.motivators?.length ? aiInsights.motivators : (Array.isArray(session.motivators) ? session.motivators : []);
  const watchFor = aiInsights?.watch_for || [];
  const learningStyle = aiInsights?.learning_style || session.learning_style;
  const recommendedActivities = aiInsights?.recommended_activities || [];
  const firstName = session.child_name ? session.child_name.split(' ')[0] : 'Child';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Session Prep</h2>
              <p className="text-white/80 text-sm mt-0.5">{formatDate(session.scheduled_date)} - {formatTime(session.scheduled_time)}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {session.child_name ? session.child_name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{session.child_name || 'Unknown'}</p>
              <p className="text-white/70 text-sm">{session.child_age || '?'} years - Session {sessionNumber}/{session.total_sessions || 9}</p>
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-700">
          {['overview', 'history', 'tips'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'text-[#FF0099] border-b-2 border-[#FF0099]' : 'text-gray-400 hover:text-white'}`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'history' ? 'Last Session' : 'Tips'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Target className="w-4 h-4" />Assessment
                  </div>
                  <p className="text-2xl font-bold text-white">{session.assessment_score !== null ? `${session.assessment_score}/10` : 'N/A'}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />Progress
                  </div>
                  <p className="text-2xl font-bold text-[#00ABFF]">{progress}%</p>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Sessions Completed</span>
                  <span className="text-white font-medium">{session.sessions_completed}/{session.total_sessions}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#FF0099] to-[#00ABFF] rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
              {favoriteTopics.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Star className="w-4 h-4 text-yellow-400" />Favorite Topics
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {favoriteTopics.map((topic, i) => (
                      <span key={i} className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
              {session.learning_style && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <BookOpen className="w-4 h-4 text-purple-400" />Learning Style
                  </div>
                  <p className="text-white">{session.learning_style}</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {session.last_session_summary ? (
                <>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <Calendar className="w-4 h-4" />Last Session
                    </div>
                    <p className="text-white/70 text-sm">{session.last_session_date ? formatDate(session.last_session_date) : 'Recently'}</p>
                  </div>
                  {session.last_session_focus && (
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                        <Target className="w-4 h-4 text-[#00ABFF]" />Focus Area
                      </div>
                      <p className="text-white">{session.last_session_focus}</p>
                    </div>
                  )}
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <BookOpen className="w-4 h-4 text-[#FF0099]" />Summary
                    </div>
                    <p className="text-white/90 text-sm leading-relaxed">{session.last_session_summary}</p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-gray-400">No previous session data</p>
                  <p className="text-gray-500 text-sm mt-1">This may be the first session</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'tips' && (
            <>
              {loadingInsights ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-[#FF0099] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-400 text-sm">Generating AI insights...</p>
                </div>
              ) : (
                <>
                  {(watchFor.length > 0 || challenges.length > 0) && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                        <AlertCircle className="w-4 h-4" />Watch Out For
                      </div>
                      <ul className="space-y-1">
                        {(watchFor.length > 0 ? watchFor : challenges).map((item, i) => (
                          <li key={i} className="text-red-300/80 text-sm flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {motivators.length > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                        <Heart className="w-4 h-4" />What Motivates {firstName}
                      </div>
                      <ul className="space-y-1">
                        {motivators.map((motivator, i) => (
                          <li key={i} className="text-emerald-300/80 text-sm flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />{motivator}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendedActivities.length > 0 && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
                        <BookOpen className="w-4 h-4" />Recommended Activities
                      </div>
                      <ul className="space-y-1">
                        {recommendedActivities.map((activity, i) => (
                          <li key={i} className="text-purple-300/80 text-sm flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />{activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInsights?.session_focus && (
                    <div className="bg-[#FF0099]/10 border border-[#FF0099]/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-[#FF0099] text-sm mb-2">
                        <Target className="w-4 h-4" />Session Focus
                      </div>
                      <p className="text-[#FF0099]/80 text-sm">{aiInsights.session_focus}</p>
                    </div>
                  )}
                  <div className="bg-[#00ABFF]/10 border border-[#00ABFF]/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[#00ABFF] text-sm mb-2">
                      <Star className="w-4 h-4" />Quick Tips
                    </div>
                    <ul className="space-y-1 text-[#00ABFF]/80 text-sm">
                      <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />Start with a quick review of last session</li>
                      <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />Use favorite topics for engagement</li>
                      <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />End with positive reinforcement</li>
                    </ul>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors">Close</button>
          {session.google_meet_link && (
            <a href={session.google_meet_link} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 bg-[#25D366] text-white rounded-xl font-medium hover:bg-[#25D366]/90 transition-colors flex items-center justify-center gap-2">
              <Video className="w-5 h-5" />Join Session
            </a>
          )}
        </div>
      </div>
    </div>
  );
}