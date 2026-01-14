// ============================================================
// PROGRESS CHART COMPONENT
// File: components/shared/ProgressChart.tsx
// Visual charts showing child's learning progress
// ============================================================

'use client';

import React, { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Star, Award, Target } from 'lucide-react';

// =====================================================
// PROGRESS LINE CHART
// Shows session ratings/engagement over time
// =====================================================
interface ProgressLineData {
  session: number;
  date: string;
  rating?: number | null;
  engagement?: number;
  confidence?: number | null;
}

export function ProgressLineChart({
  data,
  dataKey = 'rating',
  title = 'Session Progress',
  color = '#ec4899',
  showTrend = true,
}: {
  data: ProgressLineData[];
  dataKey?: 'rating' | 'engagement' | 'confidence';
  title?: string;
  color?: string;
  showTrend?: boolean;
}) {
  // Calculate trend
  const trend = useMemo(() => {
    if (data.length < 3) return 'stable';
    const recent = data.slice(-3).map(d => d[dataKey] || 0);
    const older = data.slice(-6, -3).map(d => d[dataKey] || 0);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (recentAvg > olderAvg + 0.3) return 'improving';
    if (recentAvg < olderAvg - 0.3) return 'declining';
    return 'stable';
  }, [data, dataKey]);

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-500' : trend === 'declining' ? 'text-red-500' : 'text-gray-400';

  // Filter out null values for the chart
  const chartData = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="h-48 flex items-center justify-center text-gray-400">
          No data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {showTrend && (
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="capitalize">{trend}</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="session" 
            tick={{ fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            domain={[0, 5]} 
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [value.toFixed(1), dataKey]}
            labelFormatter={(label) => `Session ${label}`}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// SKILLS RADAR CHART
// Shows proficiency across different skill areas
// =====================================================
interface SkillRadarData {
  skill: string;
  value: number;
  fullMark: number;
}

export function SkillsRadarChart({
  data,
  title = 'Skills Overview',
}: {
  data: SkillRadarData[];
  title?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          No skills data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>

      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis 
            dataKey="skill" 
            tick={{ fontSize: 11, fill: '#6b7280' }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fontSize: 10 }}
          />
          <Radar
            name="Progress"
            dataKey="value"
            stroke="#ec4899"
            fill="#ec4899"
            fillOpacity={0.3}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value}%`, 'Progress']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// ENGAGEMENT PIE CHART
// Shows distribution of engagement levels
// =====================================================
interface EngagementData {
  name: string;
  value: number;
  color: string;
}

export function EngagementPieChart({
  data,
  title = 'Engagement Distribution',
}: {
  data: EngagementData[];
  title?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="h-48 flex items-center justify-center text-gray-400">
          No engagement data yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [value, 'Sessions']}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// MILESTONE TIMELINE
// Shows achievements and milestones
// =====================================================
interface Milestone {
  date: string;
  type: 'skill_mastered' | 'achievement' | 'assessment';
  skill?: string;
  description?: string;
}

export function MilestoneTimeline({
  milestones,
  title = 'Milestones & Achievements',
}: {
  milestones: Milestone[];
  title?: string;
}) {
  if (milestones.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="py-8 flex flex-col items-center justify-center text-gray-400">
          <Target className="w-8 h-8 mb-2" />
          <p>Working towards first milestone!</p>
        </div>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'skill_mastered':
        return <Star className="w-4 h-4" />;
      case 'achievement':
        return <Award className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'skill_mastered':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'achievement':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-blue-100 text-blue-600 border-blue-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="space-y-3">
        {milestones.slice(0, 5).map((milestone, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className={`p-2 rounded-full border ${getColor(milestone.type)}`}>
              {getIcon(milestone.type)}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {milestone.skill || milestone.description || milestone.type}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(milestone.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {milestones.length > 5 && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          +{milestones.length - 5} more milestones
        </p>
      )}
    </div>
  );
}

// =====================================================
// SKILLS PROGRESS BARS
// Shows mastery level for specific skills
// =====================================================
interface SkillProgress {
  skill: string;
  skillName: string;
  level: 'mastered' | 'in_progress' | 'needs_work';
  sessionsWorked: number;
}

export function SkillsProgressBars({
  skills,
  title = 'Skill Progress',
}: {
  skills: SkillProgress[];
  title?: string;
}) {
  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'mastered':
        return { width: '100%', color: 'bg-green-500', label: 'Mastered', icon: '✓' };
      case 'in_progress':
        return { width: '60%', color: 'bg-yellow-500', label: 'In Progress', icon: '→' };
      case 'needs_work':
        return { width: '30%', color: 'bg-red-400', label: 'Needs Work', icon: '!' };
      default:
        return { width: '0%', color: 'bg-gray-300', label: 'Not Started', icon: '' };
    }
  };

  if (skills.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="py-8 flex items-center justify-center text-gray-400">
          No skills data available
        </div>
      </div>
    );
  }

  // Group by level
  const grouped = {
    mastered: skills.filter(s => s.level === 'mastered'),
    in_progress: skills.filter(s => s.level === 'in_progress'),
    needs_work: skills.filter(s => s.level === 'needs_work'),
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="space-y-6">
        {/* Mastered */}
        {grouped.mastered.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
              <Star className="w-4 h-4" /> Mastered ({grouped.mastered.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {grouped.mastered.map(skill => (
                <span key={skill.skill} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  {skill.skillName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* In Progress */}
        {grouped.in_progress.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> In Progress ({grouped.in_progress.length})
            </h4>
            <div className="space-y-2">
              {grouped.in_progress.map(skill => {
                const config = getLevelConfig(skill.level);
                return (
                  <div key={skill.skill}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{skill.skillName}</span>
                      <span className="text-gray-500">{skill.sessionsWorked} sessions</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${config.color} rounded-full transition-all`}
                        style={{ width: config.width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Needs Work */}
        {grouped.needs_work.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
              <Target className="w-4 h-4" /> Focus Areas ({grouped.needs_work.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {grouped.needs_work.map(skill => (
                <span key={skill.skill} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                  {skill.skillName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// SUMMARY STATS CARDS
// Quick overview stats for parent dashboard
// =====================================================
interface SummaryStats {
  totalSessions: number;
  completedSessions: number;
  averageRating: number | null;
  trend: 'improving' | 'stable' | 'declining';
  skillsMastered: number;
}

export function SummaryStatsCards({ stats }: { stats: SummaryStats }) {
  const completionRate = stats.totalSessions > 0 
    ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
    : 0;

  const TrendIcon = stats.trend === 'improving' 
    ? TrendingUp 
    : stats.trend === 'declining' 
      ? TrendingDown 
      : Minus;

  const trendColor = stats.trend === 'improving' 
    ? 'text-green-500' 
    : stats.trend === 'declining' 
      ? 'text-red-500' 
      : 'text-gray-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Sessions Completed */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">Sessions</p>
        <p className="text-2xl font-bold text-gray-900">
          {stats.completedSessions}/{stats.totalSessions}
        </p>
        <p className="text-xs text-gray-400 mt-1">{completionRate}% complete</p>
      </div>

      {/* Average Rating */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">Avg. Rating</p>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold text-gray-900">
            {stats.averageRating?.toFixed(1) || '-'}
          </p>
          <Star className="w-4 h-4 text-yellow-400 fill-current" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Out of 5</p>
      </div>

      {/* Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">Progress</p>
        <div className={`flex items-center gap-2 ${trendColor}`}>
          <TrendIcon className="w-6 h-6" />
          <span className="text-lg font-semibold capitalize">{stats.trend}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Based on last sessions</p>
      </div>

      {/* Skills Mastered */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-1">Skills Mastered</p>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold text-gray-900">{stats.skillsMastered}</p>
          <Award className="w-5 h-5 text-purple-500" />
        </div>
        <p className="text-xs text-gray-400 mt-1">Keep it up!</p>
      </div>
    </div>
  );
}
