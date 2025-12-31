// =============================================================================
// FILE: components/elearning/Leaderboard.tsx
// PURPOSE: Level-based leaderboard showing top learners
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Star, ChevronDown, Crown, Flame, Users } from 'lucide-react';

interface LeaderboardEntry {
  child_id: string;
  child_name: string;
  current_level_id: string | null;
  level_name: string | null;
  total_xp: number;
  gamification_level: number;
  current_streak_days: number;
  total_videos_completed: number;
  level_rank: number;
  percentile: number;
}

interface LeaderboardProps {
  childId: string;
  levelId?: string | null;
  compact?: boolean;
}

interface Level {
  id: string;
  name: string;
  slug: string;
}

export default function Leaderboard({ childId, levelId, compact = false }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [childRank, setChildRank] = useState(0);
  const [childPercentile, setChildPercentile] = useState(0);
  const [totalInLevel, setTotalInLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(levelId || null);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  useEffect(() => {
    fetchLevels();
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [childId, selectedLevelId]);

  async function fetchLevels() {
    try {
      const res = await fetch('/api/elearning/gamification?action=levels');
      const data = await res.json();
      if (data.success) {
        setLevels(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching levels:', error);
    }
  }

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const levelParam = selectedLevelId ? `&levelId=${selectedLevelId}` : '';
      const res = await fetch(`/api/elearning/gamification?childId=${childId}&action=leaderboard${levelParam}`);
      const data = await res.json();
      if (data.success && data.data) {
        setEntries(data.data.topEntries || []);
        setChildRank(data.data.childRank || 0);
        setChildPercentile(data.data.childPercentile || 0);
        setTotalInLevel(data.data.totalInLevel || 0);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-gray-500 font-bold">{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isCurrentChild: boolean) => {
    if (isCurrentChild) return 'bg-purple-50 border-purple-300';
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900">Leaderboard</h3>
          </div>
          {childRank > 0 && (
            <div className="text-sm text-gray-500">
              Your Rank: <span className="font-bold text-[#7b008b]">#{childRank}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 5).map((entry, idx) => (
              <div 
                key={entry.child_id}
                className={`flex items-center gap-3 p-2 rounded-lg border ${getRankBg(idx + 1, entry.child_id === childId)}`}
              >
                {getRankIcon(idx + 1)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate text-sm">
                    {entry.child_name}
                    {entry.child_id === childId && <span className="text-purple-600 ml-1">(You)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                  <span className="font-bold text-gray-700">{entry.total_xp.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6" />
            <h2 className="text-xl font-bold">Leaderboard</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            <span>{totalInLevel} learners</span>
          </div>
        </div>

        {/* Level Selector */}
        <div className="mt-4 relative">
          <button
            onClick={() => setShowLevelDropdown(!showLevelDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <span>
              {selectedLevelId 
                ? levels.find(l => l.id === selectedLevelId)?.name || 'All Levels'
                : 'All Levels'
              }
            </span>
            <ChevronDown className={`w-4 h-4 transition ${showLevelDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showLevelDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-10">
              <button
                onClick={() => {
                  setSelectedLevelId(null);
                  setShowLevelDropdown(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 ${!selectedLevelId ? 'bg-purple-50 text-purple-700' : ''}`}
              >
                All Levels
              </button>
              {levels.map(level => (
                <button
                  key={level.id}
                  onClick={() => {
                    setSelectedLevelId(level.id);
                    setShowLevelDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700 ${selectedLevelId === level.id ? 'bg-purple-50 text-purple-700' : ''}`}
                >
                  {level.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Your Stats */}
        {childRank > 0 && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="px-3 py-1 bg-white/20 rounded-full">
              Rank: <span className="font-bold">#{childRank}</span>
            </div>
            <div className="px-3 py-1 bg-white/20 rounded-full">
              Top <span className="font-bold">{childPercentile}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard List */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No learners yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => {
              const isCurrentChild = entry.child_id === childId;
              return (
                <div 
                  key={entry.child_id}
                  className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${getRankBg(idx + 1, isCurrentChild)} ${isCurrentChild ? 'ring-2 ring-purple-400' : ''}`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    {getRankIcon(idx + 1)}
                  </div>

                  {/* Avatar & Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                        {entry.child_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 truncate">
                          {entry.child_name}
                          {isCurrentChild && <span className="text-purple-600 ml-1">(You)</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          Level {entry.gamification_level}
                          {entry.current_streak_days > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-500" />
                              {entry.current_streak_days}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* XP */}
                  <div className="flex items-center gap-2 text-right">
                    <Star className="w-5 h-5 text-amber-400" fill="currentColor" />
                    <div>
                      <p className="font-bold text-gray-900">{entry.total_xp.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">XP</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
