// =============================================================================
// FILE: app/parent/elearning/page.tsx
// PURPOSE: E-Learning page with rAI recommendations
// VERSION: Final - proper refresh handling
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Sparkles, Flame, Zap, Trophy, Star,
  Play, CheckCircle
} from 'lucide-react';

// Components
import RAICarousel from '@/components/elearning/RAICarousel';
import VideoQuizModal from '@/components/elearning/VideoQuizModal';
import AskRAIModal from '@/components/elearning/AskRAIModal';

export default function ELearningPage() {
  const router = useRouter();

  // State
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [activeVideo, setActiveVideo] = useState<any>(null);
  const [showAskRAI, setShowAskRAI] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);

  // Fetch enrolled child on mount
  useEffect(() => {
    fetchEnrolledChild();
  }, []);

  // Fetch gamification when child is set or refreshTrigger changes
  useEffect(() => {
    if (childId) {
      const loadGamification = async () => {
        try {
          // Add timestamp to URL to bypass all caching
          const res = await fetch(`/api/elearning/gamification?childId=${childId}&_t=${Date.now()}`);
          const data = await res.json();

          if (data.success) {
            setGamification(data);
          }
        } catch (err) {
          console.error('Failed to fetch gamification:', err);
        }
      };

      loadGamification();
    }
  }, [childId, refreshTrigger]);

  async function fetchEnrolledChild() {
    try {
      const res = await fetch('/api/parent/enrolled-child');
      const data = await res.json();

      if (data.child) {
        setChildId(data.child.id);
        setChildName(data.child.child_name || 'Learner');
      } else {
        setError('No enrolled child found. E-learning is available after coaching enrollment.');
      }
    } catch (err) {
      console.error('Error fetching enrolled child:', err);
      // Fallback for development
      setChildId('d53752ea-ce16-4876-ac23-128834eb8c9f');
      setChildName('Test Child');
    } finally {
      setLoading(false);
    }
  }

  const fetchGamification = useCallback(async () => {
    if (!childId) return;

    try {
      // Add timestamp to URL to bypass all caching
      const res = await fetch(`/api/elearning/gamification?childId=${childId}&_t=${Date.now()}`);
      const data = await res.json();

      if (data.success) {
        setGamification(data);
      }
    } catch (err) {
      console.error('Failed to fetch gamification:', err);
    }
  }, [childId]);

  // Handle video selection
  function handleSelectItem(item: any) {
    if (item.type === 'video') {
      setActiveVideo(item);
    } else if (item.type === 'practice') {
      // TODO: Implement practice modal
      alert('Practice feature coming soon!');
    }
  }

  // Handle video/quiz completion
  function handleVideoComplete(result: {
    videoCompleted: boolean;
    quizPassed?: boolean;
    xpEarned: number;
    newBadges: string[];
  }) {

    // Close modal first
    setActiveVideo(null);

    // Wait a moment for DB to settle, then refresh
    setTimeout(() => {
      fetchGamification();
      setRefreshTrigger(prev => prev + 1);
    }, 800);
  }

  // Handle Ask rAI request
  async function handleAskRAI(requestType: string, customRequest?: string) {
    setShowAskRAI(false);

    try {
      const res = await fetch('/api/elearning/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          requestType,
          customRequest,
        }),
      });

      if (res.ok) {
        // Set forceRefresh to get new recommendations
        setForceRefresh(true);
        setRefreshTrigger(prev => prev + 1);
        // Reset forceRefresh after a short delay
        setTimeout(() => setForceRefresh(false), 1000);
      }
    } catch (err) {
      console.error('Ask rAI error:', err);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#FF0099] mx-auto mb-4 animate-pulse" />
          <p className="text-text-secondary">Loading e-learning...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/parent')}
            className="px-4 py-2 bg-[#FF0099] text-white rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="bg-surface-1 border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 md:py-3">
          <div className="flex items-center justify-between">
            {/* Back & Title */}
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => router.push('/parent')}
                className="p-1.5 md:p-2 hover:bg-surface-2 rounded-lg transition"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-text-secondary" />
              </button>
              <div>
                <h1 className="font-bold text-white flex items-center gap-1.5 md:gap-2 text-sm md:text-base">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#FF0099]" />
                  E-Learning
                </h1>
                <p className="text-xs md:text-sm text-text-tertiary hidden sm:block">Powered by rAI</p>
              </div>
            </div>

            {/* Gamification Stats */}
            {gamification && (
              <div className="flex items-center gap-2 md:gap-4">
                {/* Streak */}
                <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-orange-500/10 rounded-lg">
                  <Flame className={`w-4 h-4 md:w-5 md:h-5 ${gamification.streak?.current > 0 ? 'text-orange-400' : 'text-text-muted'}`} />
                  <span className="font-semibold text-white text-xs md:text-sm">{gamification.streak?.current || 0}</span>
                </div>

                {/* XP */}
                <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-purple-500/10 rounded-lg">
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-[#FF0099]" />
                  <span className="font-semibold text-white text-xs md:text-sm">{gamification.xp?.current || 0}</span>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-yellow-500/10 rounded-lg">
                  <Trophy className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
                  <span className="font-semibold text-white text-xs md:text-sm">{gamification.badges?.earned?.length || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* XP Progress Bar */}
        {gamification && (
          <div className="bg-surface-1 rounded-lg md:rounded-xl p-3 md:p-4 border border-border mb-4 md:mb-6">
            <div className="flex items-center justify-between mb-1.5 md:mb-2">
              <div className="flex items-center gap-1.5 md:gap-2">
                <Star className="w-4 h-4 md:w-5 md:h-5 text-[#FF0099]" />
                <span className="font-medium text-white text-xs md:text-sm">
                  Level {gamification.xp?.level || 1}: {gamification.xp?.levelName || 'Beginner'}
                </span>
              </div>
              <span className="text-xs md:text-sm text-text-tertiary">
                {gamification.xp?.xpInCurrentLevel || 0} / {gamification.xp?.xpRequiredForLevel || 100} XP
              </span>
            </div>
            <div className="h-2 md:h-3 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full transition-all duration-500"
                style={{ width: `${gamification.xp?.progressPercent || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* rAI Carousel */}
        {childId && (
          <RAICarousel
            childId={childId}
            childName={childName}
            onSelectItem={handleSelectItem}
            onAskRAI={() => setShowAskRAI(true)}
            refreshTrigger={refreshTrigger}
            forceRefresh={forceRefresh}
          />
        )}

        {/* Recent Achievements */}
        {gamification && gamification.badges?.earned?.length > 0 && (
          <div className="mt-4 md:mt-6 bg-surface-1 rounded-lg md:rounded-xl p-4 md:p-5 border border-border">
            <h3 className="font-semibold text-white mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
              <Trophy className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" />
              Recent Achievements
            </h3>
            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2">
              {gamification.badges.earned.slice(0, 5).map((badge: any) => (
                <div key={badge.id} className="flex-shrink-0 w-16 md:w-24 text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg md:rounded-xl flex items-center justify-center mb-1.5 md:mb-2 border border-yellow-500/30">
                    <Trophy className="w-6 h-6 md:w-8 md:h-8 text-amber-400" />
                  </div>
                  <p className="text-xs md:text-sm font-medium text-white truncate">{badge.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {gamification && (
          <div className="mt-4 md:mt-6 grid grid-cols-3 gap-2 md:gap-4">
            <div className="bg-surface-1 rounded-lg md:rounded-xl p-3 md:p-4 border border-border text-center">
              <Play className="w-6 h-6 md:w-8 md:h-8 text-blue-400 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold text-white">{gamification.stats?.totalVideosCompleted || 0}</p>
              <p className="text-xs md:text-sm text-text-tertiary">Videos</p>
            </div>
            <div className="bg-surface-1 rounded-lg md:rounded-xl p-3 md:p-4 border border-border text-center">
              <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-400 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold text-white">{gamification.stats?.totalQuizzesPassed || 0}</p>
              <p className="text-xs md:text-sm text-text-tertiary">Quizzes</p>
            </div>
            <div className="bg-surface-1 rounded-lg md:rounded-xl p-3 md:p-4 border border-border text-center">
              <Star className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold text-white">{gamification.stats?.perfectScores || 0}</p>
              <p className="text-xs md:text-sm text-text-tertiary">Perfect!</p>
            </div>
          </div>
        )}
      </main>

      {/* Video Quiz Modal */}
      {activeVideo && childId && (
        <VideoQuizModal
          isOpen={!!activeVideo}
          onClose={() => setActiveVideo(null)}
          video={activeVideo}
          childId={childId}
          onComplete={handleVideoComplete}
        />
      )}

      {/* Ask rAI Modal */}
      {showAskRAI && <AskRAIModal onSelect={handleAskRAI} onClose={() => setShowAskRAI(false)} />}
    </div>
  );
}

