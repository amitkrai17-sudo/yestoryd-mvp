// =============================================================================
// FILE: app/parent/elearning/page.tsx
// PURPOSE: E-Learning page for parents/children to watch videos and track progress
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Play, Lock, CheckCircle, Clock, ChevronRight, ChevronLeft,
  BookOpen, Trophy, Star, ArrowLeft, Volume2, Maximize,
  SkipBack, SkipForward, X
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Level {
  id: string;
  name: string;
  slug: string;
  age_range: string;
  description: string;
  thumbnail_url: string;
}

interface Module {
  id: string;
  level_id: string;
  name: string;
  slug: string;
  description: string;
  is_free: boolean;
  video_count: number;
  completed_count: number;
}

interface Video {
  id: string;
  module_id: string;
  title: string;
  description: string;
  video_source: string;
  video_id: string;
  duration_seconds: number;
  has_quiz: boolean;
  is_free: boolean;
  status: string;
  is_completed?: boolean;
  quiz_passed?: boolean;
  watch_percentage?: number;
}

interface Quiz {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  explanation: string;
}

export default function ParentElearningPage() {
  const router = useRouter();
  
  const [childId, setChildId] = useState<string | null>(null);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState<number>(6);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Content states
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  
  // Player states
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Quiz[]>([]);

  // View mode
  const [view, setView] = useState<'levels' | 'modules' | 'videos' | 'player'>('levels');

  useEffect(() => {
    checkAuthAndFetchChild();
  }, []);

  async function checkAuthAndFetchChild() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/parent/login');
      return;
    }

    // Find enrolled child
    const { data: parentData } = await supabase
      .from('parents')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    let child = null;
    if (parentData?.id) {
      const { data } = await supabase
        .from('children')
        .select('*')
        .eq('parent_id', parentData.id)
        .eq('lead_status', 'enrolled')
        .limit(1)
        .maybeSingle();
      child = data;
    }

    if (!child) {
      const { data } = await supabase
        .from('children')
        .select('*')
        .eq('parent_email', user.email)
        .eq('lead_status', 'enrolled')
        .limit(1)
        .maybeSingle();
      child = data;
    }

    if (child) {
      setChildId(child.id);
      setChildName(child.name || 'Child');
      setChildAge(child.age || 6);
      setIsEnrolled(true);
    }

    await fetchLevels();
    setLoading(false);
  }

  async function fetchLevels() {
    const { data } = await supabase
      .from('learning_levels')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    setLevels(data || []);
  }

  async function selectLevel(level: Level) {
    setSelectedLevel(level);
    setView('modules');

    // Fetch modules with progress
    const { data: modulesData } = await supabase
      .from('learning_modules')
      .select('*')
      .eq('level_id', level.id)
      .eq('is_active', true)
      .order('display_order');

    if (!modulesData) {
      setModules([]);
      return;
    }

    // Get video counts
    const { data: videoCounts } = await supabase
      .from('learning_videos')
      .select('module_id')
      .eq('status', 'published')
      .in('module_id', modulesData.map(m => m.id));

    // Get progress if enrolled
    let progressMap: Record<string, number> = {};
    if (childId) {
      const { data: progress } = await supabase
        .from('child_video_progress')
        .select('video_id')
        .eq('child_id', childId)
        .eq('is_completed', true);

      const completedVideoIds = new Set(progress?.map(p => p.video_id) || []);
      
      const { data: allVideos } = await supabase
        .from('learning_videos')
        .select('id, module_id')
        .in('module_id', modulesData.map(m => m.id));

      allVideos?.forEach(v => {
        if (completedVideoIds.has(v.id)) {
          progressMap[v.module_id] = (progressMap[v.module_id] || 0) + 1;
        }
      });
    }

    const enrichedModules = modulesData.map(m => ({
      ...m,
      video_count: videoCounts?.filter(v => v.module_id === m.id).length || 0,
      completed_count: progressMap[m.id] || 0,
    }));

    setModules(enrichedModules);
  }

  async function selectModule(module: Module) {
    setSelectedModule(module);
    setView('videos');

    // Fetch videos with progress
    const { data: videosData } = await supabase
      .from('learning_videos')
      .select('*')
      .eq('module_id', module.id)
      .eq('status', 'published')
      .order('display_order');

    if (!videosData) {
      setVideos([]);
      return;
    }

    // Get progress if enrolled
    let progressMap: Record<string, any> = {};
    if (childId) {
      const { data: progress } = await supabase
        .from('child_video_progress')
        .select('*')
        .eq('child_id', childId)
        .in('video_id', videosData.map(v => v.id));

      progress?.forEach(p => {
        progressMap[p.video_id] = p;
      });
    }

    const enrichedVideos = videosData.map(v => ({
      ...v,
      is_completed: progressMap[v.id]?.is_completed || false,
      quiz_passed: progressMap[v.id]?.quiz_passed || false,
      watch_percentage: progressMap[v.id]?.completion_percentage || 0,
    }));

    setVideos(enrichedVideos);
  }

  async function playVideo(video: Video) {
    // Check if locked
    if (!video.is_free && !isEnrolled) {
      alert('This video is only available for enrolled students. Please enroll to access.');
      return;
    }

    setPlayingVideo(video);
    setView('player');

    // Fetch quiz if needed
    if (video.has_quiz) {
      const { data } = await supabase
        .from('video_quizzes')
        .select('*')
        .eq('video_id', video.id)
        .order('display_order');
      setQuizQuestions(data || []);
    }

    // Track video start
    if (childId) {
      await supabase.from('child_video_progress').upsert({
        child_id: childId,
        video_id: video.id,
        last_watched_at: new Date().toISOString(),
        watch_count: 1,
      }, {
        onConflict: 'child_id,video_id',
      });
    }
  }

  function goBack() {
    if (view === 'player') {
      setPlayingVideo(null);
      setShowQuiz(false);
      setView('videos');
    } else if (view === 'videos') {
      setSelectedModule(null);
      setView('modules');
    } else if (view === 'modules') {
      setSelectedLevel(null);
      setView('levels');
    }
  }

  // Get suggested level based on age
  function getSuggestedLevel(): string {
    if (childAge <= 6) return 'level-1';
    if (childAge <= 9) return 'level-2';
    return 'level-3';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view !== 'levels' && (
              <button
                onClick={goBack}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#7b008b]" />
                {view === 'levels' && 'Learning Library'}
                {view === 'modules' && selectedLevel?.name}
                {view === 'videos' && selectedModule?.name}
                {view === 'player' && playingVideo?.title}
              </h1>
              {childName && (
                <p className="text-sm text-gray-500">Learning with {childName}</p>
              )}
            </div>
          </div>
          
          {isEnrolled && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-full text-sm">
              <Star className="w-4 h-4" />
              <span className="font-medium">Enrolled</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Level Selection */}
        {view === 'levels' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Level</h2>
              <p className="text-gray-500">Select based on your child&apos;s age and reading ability</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {levels.map(level => {
                const isSuggested = level.slug === getSuggestedLevel();
                return (
                  <button
                    key={level.id}
                    onClick={() => selectLevel(level)}
                    className={`relative bg-white rounded-2xl p-6 border-2 transition-all hover:shadow-lg text-left ${
                      isSuggested ? 'border-[#7b008b] ring-2 ring-[#7b008b]/20' : 'border-gray-200 hover:border-[#7b008b]/50'
                    }`}
                  >
                    {isSuggested && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#7b008b] text-white text-xs font-medium rounded-full">
                        Recommended
                      </div>
                    )}
                    <div className="w-16 h-16 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-xl flex items-center justify-center mb-4">
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{level.name}</h3>
                    <p className="text-[#7b008b] font-medium mb-2">{level.age_range}</p>
                    <p className="text-sm text-gray-500">{level.description}</p>
                    <div className="mt-4 flex items-center text-[#7b008b] font-medium">
                      Explore <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Module Selection */}
        {view === 'modules' && (
          <div className="space-y-4">
            {modules.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No modules available yet</p>
              </div>
            ) : (
              modules.map((module, idx) => (
                <button
                  key={module.id}
                  onClick={() => selectModule(module)}
                  className="w-full bg-white rounded-xl p-5 border border-gray-200 hover:border-[#7b008b]/50 hover:shadow-md transition-all text-left flex items-center gap-4"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-bold text-[#7b008b]">{idx + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{module.name}</h3>
                      {module.is_free && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Free</span>
                      )}
                      {!module.is_free && !isEnrolled && (
                        <Lock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{module.description}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-400">{module.video_count} videos</span>
                      {isEnrolled && module.completed_count > 0 && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {module.completed_count}/{module.video_count} done
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}

        {/* Video List */}
        {view === 'videos' && (
          <div className="space-y-3">
            {videos.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <Play className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No videos available yet</p>
              </div>
            ) : (
              videos.map((video, idx) => {
                const isLocked = !video.is_free && !isEnrolled;
                return (
                  <button
                    key={video.id}
                    onClick={() => playVideo(video)}
                    disabled={isLocked}
                    className={`w-full bg-white rounded-xl p-4 border border-gray-200 hover:border-[#7b008b]/50 hover:shadow-md transition-all text-left flex items-center gap-4 ${
                      isLocked ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                      {video.video_source === 'youtube' && (
                        <img
                          src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {isLocked ? (
                          <Lock className="w-6 h-6 text-white" />
                        ) : video.is_completed ? (
                          <CheckCircle className="w-6 h-6 text-green-400" />
                        ) : (
                          <Play className="w-6 h-6 text-white" fill="white" />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{video.title}</h4>
                        {video.is_free && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs flex-shrink-0">Free</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}
                        </span>
                        {video.has_quiz && (
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            Quiz
                          </span>
                        )}
                        {video.is_completed && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                      </div>
                      {video.watch_percentage !== undefined && video.watch_percentage > 0 && video.watch_percentage < 100 && (
                        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#7b008b] rounded-full"
                            style={{ width: `${video.watch_percentage}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Video Player */}
        {view === 'player' && playingVideo && (
          <VideoPlayer
            video={playingVideo}
            childId={childId}
            quizQuestions={quizQuestions}
            showQuiz={showQuiz}
            setShowQuiz={setShowQuiz}
            onComplete={() => {
              // Refresh videos list
              if (selectedModule) {
                selectModule(selectedModule);
              }
              goBack();
            }}
          />
        )}
      </main>
    </div>
  );
}

// =============================================================================
// VIDEO PLAYER COMPONENT
// =============================================================================
function VideoPlayer({
  video,
  childId,
  quizQuestions,
  showQuiz,
  setShowQuiz,
  onComplete,
}: {
  video: Video;
  childId: string | null;
  quizQuestions: Quiz[];
  showQuiz: boolean;
  setShowQuiz: (show: boolean) => void;
  onComplete: () => void;
}) {
  const [videoEnded, setVideoEnded] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  async function handleVideoEnd() {
    setVideoEnded(true);

    // Update progress
    if (childId) {
      await supabase.from('child_video_progress').upsert({
        child_id: childId,
        video_id: video.id,
        is_completed: true,
        completion_percentage: 100,
        completed_at: new Date().toISOString(),
        xp_earned: 10,
      }, {
        onConflict: 'child_id,video_id',
      });
    }

    // Show quiz if available
    if (video.has_quiz && quizQuestions.length > 0) {
      setShowQuiz(true);
    }
  }

  function submitQuiz() {
    let correct = 0;
    quizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correct_option_id) {
        correct++;
      }
    });

    const score = Math.round((correct / quizQuestions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);

    // Save quiz result
    if (childId) {
      supabase.from('child_video_progress').update({
        quiz_attempted: true,
        quiz_score: score,
        quiz_passed: score >= 70,
        quiz_attempts: 1,
        quiz_completed_at: new Date().toISOString(),
      }).eq('child_id', childId).eq('video_id', video.id);

      // Log attempt
      supabase.from('quiz_attempts').insert({
        child_id: childId,
        video_id: video.id,
        attempt_number: 1,
        answers: quizAnswers,
        score,
        passed: score >= 70,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Video Embed */}
      {!showQuiz && (
        <div className="bg-black rounded-2xl overflow-hidden aspect-video">
          {video.video_source === 'youtube' && (
            <iframe
              src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&rel=0&modestbranding=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      )}

      {/* Video Info */}
      {!showQuiz && (
        <div className="bg-white rounded-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{video.title}</h2>
          {video.description && (
            <p className="text-gray-600 mb-4">{video.description}</p>
          )}
          
          <div className="flex items-center gap-4">
            {!videoEnded && video.has_quiz && (
              <p className="text-sm text-gray-500">
                Complete the video to unlock the quiz
              </p>
            )}
            
            {videoEnded && !video.has_quiz && (
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078]"
              >
                Continue Learning
              </button>
            )}

            {videoEnded && video.has_quiz && !showQuiz && (
              <button
                onClick={() => setShowQuiz(true)}
                className="px-6 py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078] flex items-center gap-2"
              >
                <Trophy className="w-4 h-4" />
                Take Quiz
              </button>
            )}

            {/* Simulate video end for testing */}
            {!videoEnded && (
              <button
                onClick={handleVideoEnd}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                (Debug: Mark as complete)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quiz */}
      {showQuiz && (
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-[#ff0099]" />
              Quiz Time!
            </h2>
            {!quizSubmitted && (
              <span className="text-sm text-gray-500">
                {Object.keys(quizAnswers).length}/{quizQuestions.length} answered
              </span>
            )}
          </div>

          {!quizSubmitted ? (
            <>
              <div className="space-y-6">
                {quizQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-gray-50 rounded-xl">
                    <p className="font-medium text-gray-900 mb-3">
                      {idx + 1}. {q.question_text}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt.id })}
                          className={`p-3 rounded-lg text-left transition ${
                            quizAnswers[q.id] === opt.id
                              ? 'bg-[#7b008b] text-white'
                              : 'bg-white border border-gray-200 text-gray-700 hover:border-[#7b008b]'
                          }`}
                        >
                          <span className="font-medium">{opt.id.toUpperCase()}.</span> {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={submitQuiz}
                disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                className="mt-6 w-full py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-medium disabled:opacity-50"
              >
                Submit Quiz
              </button>
            </>
          ) : (
            <div className="text-center py-8">
              <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
                quizScore >= 70 ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                {quizScore >= 70 ? (
                  <Trophy className="w-12 h-12 text-green-600" />
                ) : (
                  <Star className="w-12 h-12 text-yellow-600" />
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {quizScore >= 70 ? 'Great Job!' : 'Keep Practicing!'}
              </h3>
              
              <p className="text-gray-600 mb-6">
                You scored <span className="font-bold text-[#7b008b]">{quizScore}%</span>
                {quizScore >= 70 ? ' and passed the quiz!' : '. You need 70% to pass.'}
              </p>

              <button
                onClick={onComplete}
                className="px-8 py-3 bg-[#7b008b] text-white rounded-xl font-medium hover:bg-[#6a0078]"
              >
                Continue Learning
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
