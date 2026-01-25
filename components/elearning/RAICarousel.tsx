// =============================================================================
// FILE: components/elearning/RAICarousel.tsx
// PURPOSE: Displays rAI-curated learning carousel
// VERSION: Final - uses explicit is_completed from API
// =============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Play, Lock, CheckCircle, Clock, Trophy, Zap,
  ChevronLeft, ChevronRight, Mic, Gamepad2, Sparkles,
  RefreshCw, MessageCircle, Brain, Sun, Sunrise, Moon
} from 'lucide-react';

// Types matching API response
interface CarouselItem {
  id: string;
  type: 'video' | 'game' | 'practice' | 'assessment';
  title: string;
  description: string;
  thumbnail_url?: string;
  video_id?: string;
  video_source?: string;
  duration_seconds?: number;
  xp_reward: number;
  has_quiz?: boolean;
  is_locked: boolean;
  module_name?: string;
  // Explicit status fields from API
  is_completed: boolean;
  needs_quiz_retry: boolean;
  quiz_passed?: boolean;
}

interface RAICarouselProps {
  childId: string;
  childName: string;
  onSelectItem: (item: CarouselItem) => void;
  onAskRAI: () => void;
  refreshTrigger?: number;
  forceRefresh?: boolean;
}

export default function RAICarousel({
  childId,
  childName,
  onSelectItem,
  onAskRAI,
  refreshTrigger = 0,
  forceRefresh = false,
}: RAICarouselProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only force refresh when forceRefresh prop is explicitly true
    // Regular refreshTrigger changes (after video completion) use cached data
    fetchRecommendations(forceRefresh);
  }, [childId, refreshTrigger, forceRefresh]);

  async function fetchRecommendations(forceNew: boolean = false) {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/elearning/recommendations?childId=${childId}${forceNew ? '&refresh=true' : ''}`;
      console.log('Fetching recommendations:', forceNew ? 'FORCE NEW' : 'use cache');
      const res = await fetch(url);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to load recommendations');
      }

      console.log('Carousel data:', result.cached ? '(cached)' : '(fresh)');
      setData(result);
    } catch (err: any) {
      console.error('Carousel fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function scroll(direction: 'left' | 'right') {
    if (carouselRef.current) {
      const scrollAmount = 200;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  }

  function getItemIcon(type: string) {
    switch (type) {
      case 'video': return <Play className="w-5 h-5 md:w-6 md:h-6" />;
      case 'game': return <Gamepad2 className="w-5 h-5 md:w-6 md:h-6" />;
      case 'practice': return <Mic className="w-5 h-5 md:w-6 md:h-6" />;
      case 'assessment': return <Trophy className="w-5 h-5 md:w-6 md:h-6" />;
      default: return <Play className="w-5 h-5 md:w-6 md:h-6" />;
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-200">
        <div className="flex items-center justify-center py-8 md:py-12">
          <div className="text-center">
            <Brain className="w-10 h-10 md:w-12 md:h-12 text-[#7b008b] mx-auto mb-3 animate-pulse" />
            <p className="text-gray-600 text-sm md:text-base">rAI is preparing your learning...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-red-200">
        <div className="text-center py-6 md:py-8">
          <p className="text-red-600 mb-4 text-sm md:text-base">{error}</p>
          <button
            onClick={() => fetchRecommendations(true)}
            className="px-4 py-2 bg-[#7b008b] text-white rounded-lg hover:bg-[#6a0078] flex items-center gap-2 mx-auto text-sm md:text-base"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No data
  if (!data || !data.carousel || data.carousel.length === 0) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-gray-200">
        <div className="text-center py-6 md:py-8">
          <Sparkles className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-4 text-sm md:text-base">No recommendations yet.</p>
          <button
            onClick={onAskRAI}
            className="px-4 py-2 bg-[#7b008b] text-white rounded-lg hover:bg-[#6a0078] text-sm md:text-base"
          >
            Ask rAI for content
          </button>
        </div>
      </div>
    );
  }

  const firstName = childName.split(' ')[0];
  const greeting = getGreeting();
  const GreetingIcon = getGreetingIcon();

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Welcome & Focus Card */}
      <div className="bg-gradient-to-r from-[#ff0099]/10 to-[#7b008b]/10 rounded-xl md:rounded-2xl p-4 md:p-5 border border-[#7b008b]/20">
        <div className="flex items-start justify-between mb-3 md:mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
              <GreetingIcon className="w-5 h-5 md:w-6 md:h-6" />
              {greeting}, {firstName}!
            </h2>
            <p className="text-gray-600 mt-1 text-xs md:text-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-[#7b008b]" />
              rAI has picked today's learning for you
            </p>
          </div>
          <button
            onClick={() => fetchRecommendations(true)}
            className="p-1.5 md:p-2 hover:bg-white/50 rounded-lg transition"
            title="Get new recommendations"
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
          </button>
        </div>

        {/* Focus Area */}
        <div className="bg-white rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-100">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-gray-500">Today's Focus</p>
              <p className="font-semibold text-gray-900 text-sm md:text-base truncate">{data.focus?.area}</p>
            </div>
            <div className="text-right text-xs md:text-sm flex-shrink-0">
              <p className="text-gray-500 hidden sm:block">Based on</p>
              <p className="text-[#7b008b] font-medium">{data.focus?.source}</p>
            </div>
          </div>
          {data.focus?.reason && (
            <p className="text-xs md:text-sm text-gray-600 mt-2 line-clamp-2">
              💡 {data.focus.reason}
            </p>
          )}
        </div>
      </div>

      {/* Carousel */}
      <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm md:text-base">
            📚 Your Learning Path
            <span className="text-xs md:text-sm font-normal text-gray-500">
              ({data.carousel.length})
            </span>
          </h3>
          <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
            <span className="flex items-center gap-1 text-[#7b008b]">
              <Zap className="w-3 h-3 md:w-4 md:h-4" />
              {data.total_xp_available} XP
            </span>
            <span className="flex items-center gap-1 text-gray-500 hidden sm:flex">
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              ~{data.estimated_time_minutes} min
            </span>
          </div>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Scroll Buttons - Desktop only */}
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg items-center justify-center hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg items-center justify-center hover:bg-gray-50 transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>

          {/* Carousel Items */}
          <div
            ref={carouselRef}
            className="flex gap-3 md:gap-4 overflow-x-auto pb-2 px-0.5 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {data.carousel.map((item: CarouselItem) => {
              // Use EXPLICIT fields from API
              const isCompleted = item.is_completed === true;
              const needsQuizRetry = item.needs_quiz_retry === true;
              const isLocked = item.is_locked && !isCompleted;

              // Determine card style
              let cardStyle = 'border-gray-200';
              let bgStyle = '';
              if (isLocked) {
                cardStyle = 'border-gray-200 opacity-60';
              } else if (needsQuizRetry) {
                cardStyle = 'border-orange-400';
                bgStyle = 'bg-orange-50';
              } else if (isCompleted) {
                cardStyle = 'border-green-400';
                bgStyle = 'bg-green-50';
              } else {
                cardStyle = 'border-gray-200 cursor-pointer active:border-[#7b008b] md:hover:border-[#7b008b] md:hover:shadow-lg';
              }

              // Determine thumbnail background
              let thumbBg = 'from-blue-400 to-blue-600';
              if (isLocked) {
                thumbBg = 'from-gray-300 to-gray-400';
              } else if (needsQuizRetry) {
                thumbBg = 'from-orange-400 to-orange-600';
              } else if (isCompleted) {
                thumbBg = 'from-green-400 to-green-600';
              } else if (item.type === 'practice') {
                thumbBg = 'from-purple-400 to-purple-600';
              }

              return (
                <div
                  key={item.id}
                  className={`flex-shrink-0 w-44 md:w-56 lg:w-64 rounded-xl border-2 overflow-hidden transition-all snap-start ${cardStyle}`}
                  onClick={() => !isLocked && onSelectItem(item)}
                >
                  {/* Thumbnail */}
                  <div className={`relative h-24 md:h-32 lg:h-36 bg-gradient-to-br ${thumbBg}`}>
                    {/* Show thumbnail only for unwatched videos */}
                    {item.thumbnail_url && !isCompleted && !needsQuizRetry && !isLocked ? (
                      <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : null}

                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isLocked ? (
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-black/40 rounded-full flex items-center justify-center">
                          <Lock className="w-6 h-6 md:w-7 md:h-7 text-white" />
                        </div>
                      ) : needsQuizRetry ? (
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-full flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 md:w-7 md:h-7 text-white" />
                        </div>
                      ) : isCompleted ? (
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 md:w-7 md:h-7 text-white" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-white/90 rounded-full flex items-center justify-center text-[#7b008b]">
                          {getItemIcon(item.type)}
                        </div>
                      )}
                    </div>

                    {/* Top-left badge: status */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
                        needsQuizRetry ? 'bg-orange-600 text-white' :
                        isCompleted ? 'bg-green-600 text-white' :
                        item.type === 'practice' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {needsQuizRetry ? '🔄 Retry Quiz' :
                         isCompleted ? '✓ Done' :
                         item.type === 'practice' ? '🎤 Practice' : '🎬 Video'}
                      </span>
                    </div>

                    {/* Top-right badge: XP or status */}
                    <div className="absolute top-2 right-2">
                      {needsQuizRetry ? (
                        <span className="px-2 py-0.5 bg-orange-600 text-white rounded-full text-[10px] md:text-xs font-medium">
                          +50 XP
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2 py-0.5 bg-green-600 text-white rounded-full text-[10px] md:text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Complete
                        </span>
                      ) : item.xp_reward > 0 && !isLocked ? (
                        <span className="px-2 py-0.5 bg-[#7b008b] text-white rounded-full text-[10px] md:text-xs font-medium flex items-center gap-1">
                          <Zap className="w-3 h-3" /> +{item.xp_reward}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`p-2 md:p-3 ${bgStyle}`}>
                    <h4 className={`font-medium truncate text-xs md:text-sm ${
                      needsQuizRetry ? 'text-orange-800' :
                      isCompleted ? 'text-green-800' : 'text-gray-900'
                    }`}>
                      {item.title}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-1 text-[10px] md:text-xs text-gray-500">
                      {item.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.floor(item.duration_seconds / 60)}:{(item.duration_seconds % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                      {item.has_quiz && (
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          Quiz
                        </span>
                      )}
                    </div>

                    {/* Status message */}
                    <p className={`text-[10px] md:text-xs mt-2 font-medium ${
                      isLocked ? 'text-gray-400' :
                      needsQuizRetry ? 'text-orange-600' :
                      isCompleted ? 'text-green-600' : 'text-[#7b008b]'
                    }`}>
                      {isLocked ? '🔒 Complete previous first' :
                       needsQuizRetry ? '🔄 Pass the quiz to earn XP' :
                       isCompleted ? '✅ Watch again anytime' :
                       '▶ Start learning'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ask rAI Section */}
      <div className="bg-gray-50 rounded-lg md:rounded-xl p-3 md:p-4 border border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-[#7b008b] flex-shrink-0" />
            <span className="text-gray-700 text-xs md:text-sm truncate">Want something different?</span>
          </div>
          <button
            onClick={onAskRAI}
            className="px-3 md:px-4 py-2 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-lg text-xs md:text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 md:gap-2 flex-shrink-0"
          >
            <Brain className="w-3 h-3 md:w-4 md:h-4" />
            Ask rAI
          </button>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingIcon() {
  const hour = new Date().getHours();
  if (hour < 12) return Sunrise;
  if (hour < 17) return Sun;
  return Moon;
}
