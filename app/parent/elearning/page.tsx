// =============================================================================
// FILE: app/parent/elearning/page.tsx
// PURPOSE: E-Learning page with rAI recommendations
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Flame, Zap, Trophy, Star,
  Play, CheckCircle, BookOpen,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useParentContext } from '@/app/parent/context';
import { FeatureGate } from '@/components/shared/FeatureGate';

// Components
import RAICarousel from '@/components/elearning/RAICarousel';
import VideoQuizModal from '@/components/elearning/VideoQuizModal';
import AskRAIModal from '@/components/elearning/AskRAIModal';

export default function ELearningPageGated() {
  const { selectedChildId } = useParentContext();
  return (
    <FeatureGate featureKey="elearning_access" childId={selectedChildId}>
      <ELearningPageInner />
    </FeatureGate>
  );
}

function ELearningPageInner() {
  const router = useRouter();
  const { selectedChildId, selectedChild } = useParentContext();
  const childName = selectedChild?.child_name || selectedChild?.name || 'Learner';

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [activeVideo, setActiveVideo] = useState<any>(null);
  const [showAskRAI, setShowAskRAI] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);

  // Fetch gamification when child is set or refreshTrigger changes
  useEffect(() => {
    if (selectedChildId) {
      setLoading(false);
      const loadGamification = async () => {
        try {
          const res = await fetch(`/api/elearning/gamification?childId=${selectedChildId}&_t=${Date.now()}`);
          const data = await res.json();
          if (data.success) {
            setGamification(data);
          }
        } catch (err) {
          console.error('Failed to fetch gamification:', err);
        }
      };
      loadGamification();
    } else {
      setLoading(false);
      setError('No enrolled child found. E-learning is available after enrollment.');
    }
  }, [selectedChildId, refreshTrigger]);

  const fetchGamification = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      const res = await fetch(`/api/elearning/gamification?childId=${selectedChildId}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setGamification(data);
      }
    } catch (err) {
      console.error('Failed to fetch gamification:', err);
    }
  }, [selectedChildId]);

  // Handle video selection
  function handleSelectItem(item: any) {
    if (item.type === 'video') {
      setActiveVideo(item);
    } else if (item.type === 'practice') {
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
    setActiveVideo(null);
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
          childId: selectedChildId,
          requestType,
          customRequest,
        }),
      });
      if (res.ok) {
        setForceRefresh(true);
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setForceRefresh(false), 1000);
      }
    } catch (err) {
      console.error('Ask rAI error:', err);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error || !selectedChildId) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          <div>
            <h1 className="text-xl font-medium text-gray-900">E-Learning</h1>
            <p className="text-gray-500 text-sm mt-0.5">Powered by rAI</p>
          </div>
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">{error || 'No enrolled child found.'}</p>
            <button
              onClick={() => router.push('/parent/dashboard')}
              className="px-4 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-medium hover:bg-[#E6008A] transition-colors min-h-[44px]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900">E-Learning</h1>
            <p className="text-gray-500 text-sm mt-0.5">{childName}&apos;s learning content</p>
          </div>

          {/* Gamification Stats */}
          {gamification && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 rounded-xl">
                <Flame className={`w-4 h-4 ${gamification.streak?.current > 0 ? 'text-orange-400' : 'text-gray-400'}`} />
                <span className="font-medium text-gray-900 text-xs">{gamification.streak?.current || 0}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-[#FFF5F9] rounded-xl">
                <Zap className="w-4 h-4 text-[#FF0099]" />
                <span className="font-medium text-gray-900 text-xs">{gamification.xp?.current || 0}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-xl">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-gray-900 text-xs">{gamification.badges?.earned?.length || 0}</span>
              </div>
            </div>
          )}
        </div>

        {/* XP Progress Bar */}
        {gamification && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-[#FF0099]" />
                <span className="font-medium text-gray-900 text-sm">
                  Level {gamification.xp?.level || 1}: {gamification.xp?.levelName || 'Beginner'}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {gamification.xp?.xpInCurrentLevel || 0} / {gamification.xp?.xpRequiredForLevel || 100} XP
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF0099] rounded-full transition-all duration-500"
                style={{ width: `${gamification.xp?.progressPercent || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* rAI Carousel */}
        {selectedChildId && (
          <RAICarousel
            childId={selectedChildId}
            childName={childName}
            onSelectItem={handleSelectItem}
            onAskRAI={() => setShowAskRAI(true)}
            refreshTrigger={refreshTrigger}
            forceRefresh={forceRefresh}
          />
        )}

        {/* Recent Achievements */}
        {gamification && gamification.badges?.earned?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Recent Achievements
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
              {gamification.badges.earned.slice(0, 5).map((badge: any) => (
                <div key={badge.id} className="flex-shrink-0 w-20 text-center snap-start">
                  <div className="w-14 h-14 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center mb-1.5 border border-amber-200">
                    <Trophy className="w-7 h-7 text-amber-400" />
                  </div>
                  <p className="text-xs font-medium text-gray-900">{badge.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {gamification && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
              <Play className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{gamification.stats?.totalVideosCompleted || 0}</p>
              <p className="text-xs text-gray-500">Videos</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{gamification.stats?.totalQuizzesPassed || 0}</p>
              <p className="text-xs text-gray-500">Quizzes</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center">
              <Star className="w-6 h-6 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{gamification.stats?.perfectScores || 0}</p>
              <p className="text-xs text-gray-500">Perfect</p>
            </div>
          </div>
        )}
      </div>

      {/* Video Quiz Modal */}
      {activeVideo && selectedChildId && (
        <VideoQuizModal
          isOpen={!!activeVideo}
          onClose={() => setActiveVideo(null)}
          video={activeVideo}
          childId={selectedChildId}
          onComplete={handleVideoComplete}
        />
      )}

      {/* Ask rAI Modal */}
      {showAskRAI && <AskRAIModal onSelect={handleAskRAI} onClose={() => setShowAskRAI(false)} />}
    </div>
  );
}
