// =============================================================================
// CHILD E-LEARNING: FOCUS MODE
// Single clear action - reduces cognitive load for kids
// Premium UI with rAI intelligence and gamification
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Volume2, Sparkles, BookOpen, Trophy, Settings } from 'lucide-react';
import { playSound, playHaptic } from '@/lib/sounds';
import type { ELearningSession, Unit, CelebrationEvent } from '@/types/elearning';

// Components
import DailyGoalCard from '@/components/elearning/DailyGoalCard';
import MissionCard from '@/components/elearning/MissionCard';
import JourneyMap from '@/components/elearning/JourneyMap';
import AskRAIModal from '@/components/elearning/AskRAIModal';
import CelebrationOverlay from '@/components/elearning/CelebrationOverlay';
import ParentGate from '@/components/child/ParentGate';

// Level configuration
const LEVEL_CONFIG = {
  1: { title: 'Beginner', emoji: '🌱', color: '#10B981' },
  2: { title: 'Explorer', emoji: '🧭', color: '#3B82F6' },
  3: { title: 'Learner', emoji: '📚', color: '#8B5CF6' },
  4: { title: 'Reader', emoji: '📖', color: '#F59E0B' },
  5: { title: 'Star Reader', emoji: '⭐', color: '#EF4444' },
  6: { title: 'Super Reader', emoji: '🦸', color: '#EC4899' },
  7: { title: 'Champion', emoji: '🏆', color: '#14B8A6' },
  8: { title: 'Master', emoji: '🎓', color: '#6366F1' },
  9: { title: 'Legend', emoji: '👑', color: '#F97316' },
  10: { title: 'Genius', emoji: '🧠', color: '#8B5CF6' },
};

export default function FocusModePage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as string;
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ELearningSession | null>(null);
  const [showAskRAI, setShowAskRAI] = useState(false);
  const [showParentGate, setShowParentGate] = useState(false);
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // Fetch session data
  useEffect(() => {
    fetchSession();
  }, [childId]);
  
  const fetchSession = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/elearning/session?childId=${childId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load');
      }
      
      setSession(data.session);
      
      // Check for celebrations (level up, streak, etc.)
      if (data.celebration) {
        setCelebration(data.celebration);
      }
    } catch (err: any) {
      console.error('Session fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle mission start
  const handleStartMission = (unit: Unit) => {
    playSound('start');
    playHaptic('medium');
    router.push(`/child/${childId}/unit/${unit.id}`);
  };
  
  // Handle Ask rAI selection
  const handleAskRAISelect = async (topic: string) => {
    setShowAskRAI(false);
    playSound('success');
    
    // Call API to regenerate recommendations
    try {
      const response = await fetch('/api/elearning/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, topic }),
      });
      
      const data = await response.json();
      if (data.success) {
        setSession(data.session);
      }
    } catch (err) {
      console.error('Ask rAI error:', err);
    }
  };
  
  // Handle back (parent gate)
  const handleBack = () => {
    playSound('click');
    setShowParentGate(true);
  };
  
  const handleParentGateSuccess = () => {
    setShowParentGate(false);
    router.push(`/parent/elearning?childId=${childId}`);
  };
  
  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };
  
  // Level info
  const levelInfo = session?.gamification 
    ? LEVEL_CONFIG[session.gamification.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1]
    : LEVEL_CONFIG[1];
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-3 border-[#FF0099]/20 border-t-[#FF0099] rounded-full mx-auto mb-4"
          />
          <p className="text-gray-500">Loading your adventure...</p>
        </motion.div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-lg text-center max-w-sm">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[#FF0099] text-white py-3 rounded-xl font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (!session) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF]">
      {/* Celebration Overlay */}
      <AnimatePresence>
        {celebration && (
          <CelebrationOverlay
            event={celebration}
            onComplete={() => setCelebration(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Parent Gate */}
      <AnimatePresence>
        {showParentGate && (
          <ParentGate
            onSuccess={handleParentGateSuccess}
            onCancel={() => setShowParentGate(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Ask rAI Modal */}
      <AnimatePresence>
        {showAskRAI && (
          <AskRAIModal
            onSelect={handleAskRAISelect}
            onClose={() => setShowAskRAI(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            {/* Back + Branding */}
            <div className="flex items-center gap-3">
              <motion.button
                onClick={handleBack}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"
                whileTap={{ scale: 0.95 }}
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF0099]" />
                  <span className="font-semibold text-gray-800">E-Learning</span>
                </div>
                <p className="text-[10px] text-gray-400">Powered by rAI</p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-2">
              {/* Coins */}
              <div className="flex items-center gap-1 bg-yellow-50 px-2.5 py-1 rounded-full">
                <span className="text-sm">🪙</span>
                <span className="font-bold text-yellow-700 text-sm">
                  {session.gamification.coins}
                </span>
              </div>
              
              {/* Streak */}
              {session.gamification.streak > 0 && (
                <motion.div
                  className="flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-full"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <motion.span
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-sm"
                  >
                    🔥
                  </motion.span>
                  <span className="font-bold text-orange-600 text-sm">
                    {session.gamification.streak}
                  </span>
                </motion.div>
              )}
              
              {/* Audio toggle */}
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"
              >
                <Volume2 className={`w-4 h-4 ${audioEnabled ? 'text-[#FF0099]' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="px-4 pb-32 max-w-lg mx-auto">
        {/* Level Progress */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 mt-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{levelInfo.emoji}</span>
              <div>
                <span className="font-semibold text-gray-800">
                  Level {session.gamification.level}
                </span>
                <span className="text-gray-400 mx-1">•</span>
                <span className="text-gray-500">{levelInfo.title}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium" style={{ color: levelInfo.color }}>
                {session.gamification.totalXP} XP
              </span>
            </div>
          </div>
          
          {/* XP Progress bar */}
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ 
                background: `linear-gradient(90deg, ${levelInfo.color}, ${levelInfo.color}dd)` 
              }}
              initial={{ width: 0 }}
              animate={{ 
                width: `${((session.gamification.totalXP % 100) / 100) * 100}%` 
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-right">
            {session.gamification.xpToNextLevel} XP to Level {session.gamification.level + 1}
          </p>
        </motion.div>
        
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6"
        >
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>👋</span>
            {getGreeting()}, {session.child.displayName}!
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#FF0099]" />
            rAI picked today's learning for you
          </p>
        </motion.div>
        
        {/* Daily Goal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6"
        >
          <DailyGoalCard
            target={session.dailyGoal.target}
            completed={session.dailyGoal.completed}
            isAchieved={session.dailyGoal.isAchieved}
            xpBonus={session.dailyGoal.xpBonus}
          />
        </motion.div>
        
        {/* TODAY'S MISSION - Single Clear Action */}
        {session.todaysFocus && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                Your Mission
              </h2>
            </div>
            
            <MissionCard
              unit={session.todaysFocus.unit}
              reason={session.todaysFocus.reason}
              source={session.todaysFocus.source}
              onStart={() => handleStartMission(session.todaysFocus!.unit)}
              audioEnabled={audioEnabled}
            />
          </motion.div>
        )}
        
        {/* Want something different? */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6"
        >
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-lg">💬</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Want something different?</p>
                  <p className="text-xs text-gray-400">Tell rAI what you'd like to learn</p>
                </div>
              </div>
              <motion.button
                onClick={() => {
                  playSound('click');
                  setShowAskRAI(true);
                }}
                className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white px-4 py-2 rounded-xl font-medium text-sm flex items-center gap-1.5"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles className="w-4 h-4" />
                Ask rAI
              </motion.button>
            </div>
          </div>
        </motion.div>
        
        {/* See All / Journey Map (collapsed by default) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <button
            onClick={() => setShowAllUnits(!showAllUnits)}
            className="w-full flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-800">See all activities</p>
                <p className="text-xs text-gray-400">
                  {session.queue.length} units available
                </p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: showAllUnits ? 180 : 0 }}
              className="text-gray-400"
            >
              <ChevronLeft className="w-5 h-5 -rotate-90" />
            </motion.div>
          </button>
          
          <AnimatePresence>
            {showAllUnits && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4">
                  <JourneyMap
                    units={session.queue}
                    onSelectUnit={handleStartMission}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        {/* Review Due (if any) */}
        {session.reviewDue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-6"
          >
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔔</span>
                <h3 className="font-medium text-amber-800">Time to review!</h3>
              </div>
              <p className="text-sm text-amber-700">
                {session.reviewDue.length} unit{session.reviewDue.length > 1 ? 's' : ''} ready for practice
              </p>
              <button
                onClick={() => handleStartMission(session.reviewDue[0])}
                className="mt-3 w-full bg-amber-500 text-white py-2.5 rounded-xl font-medium text-sm"
              >
                Start Review
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Stats (minimal) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <div className="text-2xl mb-1">🎬</div>
              <div className="font-bold text-gray-800">{session.stats.videosWatched}</div>
              <div className="text-xs text-gray-400">Videos</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <div className="text-2xl mb-1">🎮</div>
              <div className="font-bold text-gray-800">{session.stats.gamesPlayed}</div>
              <div className="text-xs text-gray-400">Games</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <div className="text-2xl mb-1">⭐</div>
              <div className="font-bold text-gray-800">{session.stats.perfectScores}</div>
              <div className="text-xs text-gray-400">Perfect!</div>
            </div>
          </div>
        </motion.div>
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40">
        <div className="max-w-lg mx-auto px-4 py-2">
          <div className="flex items-center justify-around">
            <button className="flex flex-col items-center py-2 px-4 text-[#FF0099]">
              <span className="text-xl mb-0.5">🏠</span>
              <span className="text-xs font-medium">Home</span>
            </button>
            <button 
              onClick={() => router.push(`/child/${childId}/games`)}
              className="flex flex-col items-center py-2 px-4 text-gray-400"
            >
              <span className="text-xl mb-0.5">🎮</span>
              <span className="text-xs">Games</span>
            </button>
            <button 
              onClick={() => router.push(`/child/${childId}/progress`)}
              className="flex flex-col items-center py-2 px-4 text-gray-400"
            >
              <Trophy className="w-5 h-5 mb-0.5" />
              <span className="text-xs">Progress</span>
            </button>
            <button 
              onClick={() => setShowParentGate(true)}
              className="flex flex-col items-center py-2 px-4 text-gray-400"
            >
              <Settings className="w-5 h-5 mb-0.5" />
              <span className="text-xs">Settings</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
