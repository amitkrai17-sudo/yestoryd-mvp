// ============================================================
// PARENT PROGRESS DASHBOARD PAGE
// File: app/(parent)/progress/[childId]/page.tsx
// Visual dashboard showing child's learning progress
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Calendar, MessageSquare, Clock, 
  Download, Share2, Loader2, RefreshCw
} from 'lucide-react';
import {
  ProgressLineChart,
  EngagementPieChart,
  MilestoneTimeline,
  SkillsProgressBars,
  SummaryStatsCards,
} from '@/components/shared/ProgressChart';
import { CoachMiniProfile } from '@/components/shared/CoachCard';

interface ProgressData {
  child: {
    id: string;
    name: string;
    age: number;
    coach: any;
    learning_needs: string[];
    primary_focus: string;
    initial_score: number;
    initial_wpm: number;
  };
  progress: {
    total_sessions: number;
    completed_sessions: number;
    completion_rate: number;
    skills_mastered: string[];
    skills_in_progress: string[];
    skills_need_work: string[];
    engagement_trend: 'improving' | 'stable' | 'declining';
    overall_trend: 'improving' | 'stable' | 'declining';
    average_rating: number | null;
    latest_rating: number | null;
  };
  charts: {
    session_progress: any[];
    skills_timeline: any[];
    assessment_scores: any[];
    milestones: any[];
    engagement_distribution: any[];
  };
  skill_names: Record<string, string>;
  recent_sessions: any[];
  next_session: any;
  time_range: string;
}

export default function ParentProgressDashboard() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as string;

  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('all');

  // Fetch progress data
  useEffect(() => {
    async function fetchProgress() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/parent/progress?child_id=${childId}&range=${timeRange}`);
        
        if (!response.ok) {
          throw new Error('Failed to load progress data');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (childId) {
      fetchProgress();
    }
  }, [childId, timeRange]);

  // Refresh data
  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    // Re-trigger useEffect
    setTimeRange(prev => prev);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading progress data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-4">{error || 'Something went wrong'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { child, progress, charts, skill_names, recent_sessions, next_session } = data;

  // Prepare skills data for progress bars
  const skillsProgress = [
    ...progress.skills_mastered.map(s => ({
      skill: s,
      skillName: skill_names[s] || s,
      level: 'mastered' as const,
      sessionsWorked: charts.skills_timeline.find(t => t.skill === s)?.sessions_count || 0,
    })),
    ...progress.skills_in_progress.map(s => ({
      skill: s,
      skillName: skill_names[s] || s,
      level: 'in_progress' as const,
      sessionsWorked: charts.skills_timeline.find(t => t.skill === s)?.sessions_count || 0,
    })),
    ...progress.skills_need_work.map(s => ({
      skill: s,
      skillName: skill_names[s] || s,
      level: 'needs_work' as const,
      sessionsWorked: charts.skills_timeline.find(t => t.skill === s)?.sessions_count || 0,
    })),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back button and title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {child.name}'s Progress
                </h1>
                <p className="text-sm text-gray-500">Age {child.age}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download Report"
              >
                <Download className="w-5 h-5 text-gray-600" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Time Range Selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-white border border-gray-200 rounded-lg p-1">
            {(['week', 'month', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`
                  px-4 py-2 text-sm font-medium rounded-md transition-colors
                  ${timeRange === range 
                    ? 'bg-pink-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>

          {/* Coach info */}
          {child.coach && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Coach:</span>
              <CoachMiniProfile coach={child.coach} showRating />
            </div>
          )}
        </div>

        {/* Next Session Banner */}
        {next_session && (
          <div className="mb-6 p-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-white/80">Next Session</p>
                  <p className="text-lg font-semibold">
                    {new Date(next_session.scheduled_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })} at {next_session.scheduled_time}
                  </p>
                </div>
              </div>
              {next_session.google_meet_link && (
                <a
                  href={next_session.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white text-pink-600 rounded-lg font-medium hover:bg-pink-50 transition-colors"
                >
                  Join Session
                </a>
              )}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <SummaryStatsCards
          stats={{
            totalSessions: progress.total_sessions,
            completedSessions: progress.completed_sessions,
            averageRating: progress.average_rating,
            trend: progress.overall_trend,
            skillsMastered: progress.skills_mastered.length,
          }}
        />

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* Session Progress */}
          <ProgressLineChart
            data={charts.session_progress}
            dataKey="rating"
            title="Session Ratings Over Time"
            color="#ec4899"
          />

          {/* Engagement Distribution */}
          <EngagementPieChart
            data={charts.engagement_distribution}
            title="Engagement Distribution"
          />

          {/* Skills Progress */}
          <SkillsProgressBars
            skills={skillsProgress}
            title="Skills Progress"
          />

          {/* Milestones */}
          <MilestoneTimeline
            milestones={charts.milestones}
            title="Achievements & Milestones"
          />
        </div>

        {/* Recent Sessions */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Sessions</h3>
          
          {recent_sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No completed sessions yet</p>
          ) : (
            <div className="space-y-4">
              {recent_sessions.map((session, index) => (
                <div 
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                      <span className="text-pink-600 font-medium">
                        #{session.session_number || index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {session.focus_area || 'General Practice'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.scheduled_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress indicator */}
                    {session.progress_rating && (
                      <span className={`
                        px-2 py-1 rounded-full text-xs font-medium
                        ${session.progress_rating === 'improved' 
                          ? 'bg-green-100 text-green-700' 
                          : session.progress_rating === 'struggled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }
                      `}>
                        {session.progress_rating === 'improved' ? '📈 Improved' :
                         session.progress_rating === 'struggled' ? '📉 Struggled' :
                         '➡️ Steady'}
                      </span>
                    )}

                    {/* Rating */}
                    {session.rating_overall && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="font-medium">{session.rating_overall}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push(`/chat/${childId}`)}
            className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="p-3 bg-blue-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Message Coach</p>
              <p className="text-sm text-gray-500">Ask questions or share feedback</p>
            </div>
          </button>

          <button
            onClick={() => router.push(`/book/${childId}`)}
            className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Reschedule Session</p>
              <p className="text-sm text-gray-500">Change upcoming session time</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
