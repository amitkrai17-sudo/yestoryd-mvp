// =============================================================================
// FILE: components/elearning/BadgesModal.tsx
// PURPOSE: Modal showing all badges with earned/unearned status
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { X, Lock, CheckCircle, Trophy, Search } from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_bonus: number;
  earnedAt?: string;
}

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  childId: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  milestone: { label: 'Milestones', color: 'bg-blue-100 text-blue-700' },
  level: { label: 'Levels', color: 'bg-purple-100 text-purple-700' },
  streak: { label: 'Streaks', color: 'bg-orange-100 text-orange-700' },
  quiz: { label: 'Quizzes', color: 'bg-green-100 text-green-700' },
  reading: { label: 'Reading', color: 'bg-pink-100 text-pink-700' },
  game: { label: 'Games', color: 'bg-cyan-100 text-cyan-700' },
  special: { label: 'Special', color: 'bg-yellow-100 text-yellow-700' },
};

export default function BadgesModal({ isOpen, onClose, childId }: BadgesModalProps) {
  const [earned, setEarned] = useState<Badge[]>([]);
  const [unearned, setUnearned] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && childId) {
      fetchBadges();
    }
  }, [isOpen, childId]);

  async function fetchBadges() {
    setLoading(true);
    try {
      const res = await fetch(`/api/elearning/gamification?childId=${childId}&action=badges`);
      const data = await res.json();
      if (data.success && data.data) {
        setEarned(data.data.earned || []);
        setUnearned(data.data.unearned || []);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  // Get unique categories
  const allBadges = [...earned, ...unearned];
  const categories = Array.from(new Set(allBadges.map(b => b.category)));

  // Filter badges
  const filteredEarned = earned.filter(b => {
    const matchesCategory = !selectedCategory || b.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredUnearned = unearned.filter(b => {
    const matchesCategory = !selectedCategory || b.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-bold text-gray-900">My Badges</h2>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                {earned.length} / {allBadges.length}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search badges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] focus:border-[#7b008b] text-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                !selectedCategory
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-gray-900 text-white'
                    : `${CATEGORY_LABELS[cat]?.color || 'bg-gray-100 text-gray-600'} hover:opacity-80`
                }`}
              >
                {CATEGORY_LABELS[cat]?.label || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-180px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading badges...</p>
            </div>
          ) : (
            <>
              {/* Earned Badges */}
              {filteredEarned.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Earned ({filteredEarned.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredEarned.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} earned />
                    ))}
                  </div>
                </div>
              )}

              {/* Locked Badges */}
              {filteredUnearned.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-400" />
                    Locked ({filteredUnearned.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredUnearned.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} earned={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredEarned.length === 0 && filteredUnearned.length === 0 && (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No badges found</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Badge Card Component
function BadgeCard({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div 
      className={`relative p-4 rounded-xl border transition-all ${
        earned
          ? 'bg-gradient-to-br from-white to-amber-50 border-amber-200 hover:shadow-md'
          : 'bg-gray-50 border-gray-200 opacity-60'
      }`}
    >
      {/* Badge Icon */}
      <div className={`text-4xl mb-2 ${!earned && 'grayscale'}`}>
        {badge.icon}
      </div>

      {/* Badge Info */}
      <h4 className={`font-semibold text-sm ${earned ? 'text-gray-900' : 'text-gray-500'}`}>
        {badge.name}
      </h4>
      <p className={`text-xs mt-1 ${earned ? 'text-gray-600' : 'text-gray-400'}`}>
        {badge.description}
      </p>

      {/* XP Bonus */}
      <div className={`mt-2 text-xs font-medium ${earned ? 'text-amber-600' : 'text-gray-400'}`}>
        +{badge.xp_bonus} XP
      </div>

      {/* Category Tag */}
      <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs ${
        earned
          ? CATEGORY_LABELS[badge.category]?.color || 'bg-gray-100 text-gray-600'
          : 'bg-gray-200 text-gray-500'
      }`}>
        {CATEGORY_LABELS[badge.category]?.label || badge.category}
      </div>

      {/* Earned Indicator */}
      {earned && (
        <div className="absolute top-2 right-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      )}

      {/* Locked Indicator */}
      {!earned && (
        <div className="absolute top-2 right-2">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
      )}

      {/* Earned Date */}
      {earned && badge.earnedAt && (
        <p className="text-xs text-gray-400 mt-2">
          {new Date(badge.earnedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
