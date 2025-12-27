// =============================================================================
// FILE: app/admin/elearning/page.tsx
// PURPOSE: Admin portal for managing e-learning content (levels, modules, videos)
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BookOpen, Video, Play, Plus, Edit, Trash2, ChevronRight,
  ChevronDown, Eye, EyeOff, Clock, CheckCircle, Search,
  Upload, GripVertical, BarChart3, Users, FileQuestion
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
  is_active: boolean;
  display_order: number;
  modules?: Module[];
}

interface Module {
  id: string;
  level_id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  is_free: boolean;
  display_order: number;
  video_count?: number;
  videos?: VideoItem[];
}

interface VideoItem {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  description: string;
  video_source: string;
  video_id: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  display_order: number;
  has_quiz: boolean;
  is_free: boolean;
  is_active: boolean;
  status: string;
  quiz_count?: number;
}

type TabType = 'content' | 'analytics' | 'assignments';

export default function AdminElearningPage() {
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');

  useEffect(() => {
    fetchContent();
  }, []);

  async function fetchContent() {
    setLoading(true);
    try {
      // Fetch levels with modules and videos
      const { data: levelsData } = await supabase
        .from('learning_levels')
        .select('*')
        .order('display_order');

      if (!levelsData) {
        setLevels([]);
        setLoading(false);
        return;
      }

      // Fetch modules for each level
      const { data: modulesData } = await supabase
        .from('learning_modules')
        .select('*')
        .order('display_order');

      // Fetch videos for each module
      const { data: videosData } = await supabase
        .from('learning_videos')
        .select('*')
        .order('display_order');

      // Fetch quiz counts
      const { data: quizCounts } = await supabase
        .from('video_quizzes')
        .select('video_id');

      // Count quizzes per video
      const quizCountMap: Record<string, number> = {};
      quizCounts?.forEach(q => {
        quizCountMap[q.video_id] = (quizCountMap[q.video_id] || 0) + 1;
      });

      // Organize data hierarchically
      const organizedLevels = levelsData.map(level => ({
        ...level,
        modules: (modulesData || [])
          .filter(m => m.level_id === level.id)
          .map(module => ({
            ...module,
            video_count: (videosData || []).filter(v => v.module_id === module.id).length,
            videos: (videosData || [])
              .filter(v => v.module_id === module.id)
              .map(v => ({
                ...v,
                quiz_count: quizCountMap[v.id] || 0
              }))
          }))
      }));

      setLevels(organizedLevels);
    } catch (error) {
      console.error('Error fetching content:', error);
    }
    setLoading(false);
  }

  function toggleLevel(levelId: string) {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(levelId)) {
      newExpanded.delete(levelId);
    } else {
      newExpanded.add(levelId);
    }
    setExpandedLevels(newExpanded);
  }

  function toggleModule(moduleId: string) {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getStatusBadge(status: string) {
    const config: Record<string, { bg: string; text: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
      review: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
      published: { bg: 'bg-green-100', text: 'text-green-700' },
    };
    const c = config[status] || config.draft;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  // Stats
  const totalVideos = levels.reduce((sum, l) => 
    sum + (l.modules?.reduce((mSum, m) => mSum + (m.videos?.length || 0), 0) || 0), 0);
  const publishedVideos = levels.reduce((sum, l) => 
    sum + (l.modules?.reduce((mSum, m) => 
      mSum + (m.videos?.filter(v => v.status === 'published').length || 0), 0) || 0), 0);
  const totalModules = levels.reduce((sum, l) => sum + (l.modules?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-7 h-7 text-[#7b008b]" />
                E-Learning Management
              </h1>
              <p className="text-gray-500 mt-1">Manage video content, modules, and quizzes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setEditingModule(null);
                  setShowModuleModal(true);
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Module
              </button>
              <button
                onClick={() => {
                  setEditingVideo(null);
                  setShowVideoModal(true);
                }}
                className="px-4 py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078] flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Add Video
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1">
            {[
              { id: 'content', label: 'Content Library', icon: Video },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'assignments', label: 'Assignments', icon: Users },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-[#7b008b]/10 text-[#7b008b]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'content' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Total Levels</p>
                <p className="text-2xl font-bold text-gray-900">{levels.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Total Modules</p>
                <p className="text-2xl font-bold text-gray-900">{totalModules}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Total Videos</p>
                <p className="text-2xl font-bold text-gray-900">{totalVideos}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Published</p>
                <p className="text-2xl font-bold text-green-600">{publishedVideos}</p>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search videos, modules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#7b008b] focus:border-[#7b008b]"
                />
              </div>
            </div>

            {/* Content Tree */}
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading content...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {levels.map(level => (
                  <div key={level.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Level Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleLevel(level.id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedLevels.has(level.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="w-10 h-10 bg-gradient-to-br from-[#ff0099] to-[#7b008b] rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{level.name}</h3>
                          <p className="text-sm text-gray-500">{level.age_range} • {level.modules?.length || 0} modules</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {level.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Inactive</span>
                        )}
                      </div>
                    </div>

                    {/* Modules */}
                    {expandedLevels.has(level.id) && level.modules && (
                      <div className="border-t border-gray-100">
                        {level.modules.length === 0 ? (
                          <div className="p-6 text-center text-gray-500">
                            No modules yet. 
                            <button 
                              onClick={() => {
                                setSelectedModuleId('');
                                setEditingModule(null);
                                setShowModuleModal(true);
                              }}
                              className="text-[#7b008b] ml-1 hover:underline"
                            >
                              Add one
                            </button>
                          </div>
                        ) : (
                          level.modules.map(module => (
                            <div key={module.id} className="border-b border-gray-100 last:border-b-0">
                              {/* Module Header */}
                              <div
                                className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleModule(module.id)}
                              >
                                <div className="flex items-center gap-3">
                                  {expandedModules.has(module.id) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  )}
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Video className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-800">{module.name}</span>
                                      {module.is_free && (
                                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">Free</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500">{module.video_count || 0} videos</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingModule(module);
                                      setShowModuleModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedModuleId(module.id);
                                      setEditingVideo(null);
                                      setShowVideoModal(true);
                                    }}
                                    className="p-1.5 text-[#7b008b] hover:bg-[#7b008b]/10 rounded"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Videos */}
                              {expandedModules.has(module.id) && module.videos && (
                                <div className="bg-gray-50 px-6 py-2">
                                  {module.videos.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-3 text-center">
                                      No videos yet
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {module.videos.map((video, idx) => (
                                        <div
                                          key={video.id}
                                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                                        >
                                          <div className="flex items-center gap-3">
                                            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                                            <div className="w-16 h-10 bg-gray-200 rounded overflow-hidden">
                                              {video.thumbnail_url ? (
                                                <img 
                                                  src={video.thumbnail_url} 
                                                  alt="" 
                                                  className="w-full h-full object-cover"
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                  <Play className="w-4 h-4 text-gray-400" />
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-800 text-sm">{video.title}</span>
                                                {video.is_free && (
                                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">Free</span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                  <Clock className="w-3 h-3" />
                                                  {formatDuration(video.duration_seconds)}
                                                </span>
                                                {video.has_quiz && (
                                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                                    <FileQuestion className="w-3 h-3" />
                                                    {video.quiz_count} questions
                                                  </span>
                                                )}
                                                {getStatusBadge(video.status)}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => {
                                                setSelectedVideoId(video.id);
                                                setShowQuizModal(true);
                                              }}
                                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                              title="Manage Quiz"
                                            >
                                              <FileQuestion className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setEditingVideo(video);
                                                setSelectedModuleId(video.module_id);
                                                setShowVideoModal(true);
                                              }}
                                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                            >
                                              <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => window.open(`https://youtube.com/watch?v=${video.video_id}`, '_blank')}
                                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                              title="Preview"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab />
        )}

        {activeTab === 'assignments' && (
          <AssignmentsTab />
        )}
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <VideoModal
          video={editingVideo}
          moduleId={selectedModuleId}
          levels={levels}
          onClose={() => {
            setShowVideoModal(false);
            setEditingVideo(null);
          }}
          onSave={() => {
            setShowVideoModal(false);
            setEditingVideo(null);
            fetchContent();
          }}
        />
      )}

      {/* Module Modal */}
      {showModuleModal && (
        <ModuleModal
          module={editingModule}
          levels={levels}
          onClose={() => {
            setShowModuleModal(false);
            setEditingModule(null);
          }}
          onSave={() => {
            setShowModuleModal(false);
            setEditingModule(null);
            fetchContent();
          }}
        />
      )}

      {/* Quiz Modal */}
      {showQuizModal && (
        <QuizModal
          videoId={selectedVideoId}
          onClose={() => {
            setShowQuizModal(false);
            setSelectedVideoId('');
          }}
          onSave={() => {
            fetchContent();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// VIDEO MODAL
// =============================================================================
function VideoModal({
  video,
  moduleId,
  levels,
  onClose,
  onSave,
}: {
  video: VideoItem | null;
  moduleId: string;
  levels: Level[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    module_id: video?.module_id || moduleId || '',
    title: video?.title || '',
    description: video?.description || '',
    video_source: video?.video_source || 'youtube',
    video_id: video?.video_id || '',
    duration_seconds: video?.duration_seconds || 0,
    has_quiz: video?.has_quiz || false,
    is_free: video?.is_free || false,
    status: video?.status || 'draft',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const videoUrl = form.video_source === 'youtube'
      ? `https://www.youtube.com/watch?v=${form.video_id}`
      : form.video_id;
    const thumbnailUrl = form.video_source === 'youtube'
      ? `https://img.youtube.com/vi/${form.video_id}/mqdefault.jpg`
      : '';

    const data = {
      ...form,
      slug,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      updated_at: new Date().toISOString(),
    };

    if (video?.id) {
      await supabase.from('learning_videos').update(data).eq('id', video.id);
    } else {
      await supabase.from('learning_videos').insert(data);
    }

    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {video ? 'Edit Video' : 'Add New Video'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Module Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Module *</label>
            <select
              value={form.module_id}
              onChange={(e) => setForm({ ...form, module_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
            >
              <option value="">Select Module</option>
              {levels.map(level => (
                <optgroup key={level.id} label={level.name}>
                  {level.modules?.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="e.g., Introduction to Phonics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="What will children learn?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
            />
          </div>

          {/* Video Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Source</label>
              <select
                value={form.video_source}
                onChange={(e) => setForm({ ...form, video_source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
              >
                <option value="youtube">YouTube</option>
                <option value="bunny">Bunny.net</option>
                <option value="vimeo">Vimeo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video ID *</label>
              <input
                type="text"
                value={form.video_id}
                onChange={(e) => setForm({ ...form, video_id: e.target.value })}
                required
                placeholder="dQw4w9WgXcQ"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Duration & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
              <input
                type="number"
                value={form.duration_seconds}
                onChange={(e) => setForm({ ...form, duration_seconds: parseInt(e.target.value) || 0 })}
                placeholder="300"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
              >
                <option value="draft">Draft</option>
                <option value="review">In Review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_quiz}
                onChange={(e) => setForm({ ...form, has_quiz: e.target.checked })}
                className="w-4 h-4 text-[#7b008b] rounded"
              />
              <span className="text-sm text-gray-700">Has Quiz</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_free}
                onChange={(e) => setForm({ ...form, is_free: e.target.checked })}
                className="w-4 h-4 text-[#7b008b] rounded"
              />
              <span className="text-sm text-gray-700">Free Preview</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078] disabled:opacity-50"
            >
              {saving ? 'Saving...' : video ? 'Update Video' : 'Add Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// MODULE MODAL
// =============================================================================
function ModuleModal({
  module,
  levels,
  onClose,
  onSave,
}: {
  module: Module | null;
  levels: Level[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    level_id: module?.level_id || '',
    name: module?.name || '',
    description: module?.description || '',
    is_free: module?.is_free || false,
    is_active: module?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const data = {
      ...form,
      slug,
      updated_at: new Date().toISOString(),
    };

    if (module?.id) {
      await supabase.from('learning_modules').update(data).eq('id', module.id);
    } else {
      await supabase.from('learning_modules').insert(data);
    }

    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {module ? 'Edit Module' : 'Add New Module'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level *</label>
            <select
              value={form.level_id}
              onChange={(e) => setForm({ ...form, level_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
            >
              <option value="">Select Level</option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.age_range})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Module Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g., Phonics Basics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7b008b] text-gray-900 bg-white"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_free}
                onChange={(e) => setForm({ ...form, is_free: e.target.checked })}
                className="w-4 h-4 text-[#7b008b] rounded"
              />
              <span className="text-sm text-gray-700">Free Preview</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-[#7b008b] rounded"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078] disabled:opacity-50"
            >
              {saving ? 'Saving...' : module ? 'Update' : 'Add Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// QUIZ MODAL
// =============================================================================
function QuizModal({
  videoId,
  onClose,
  onSave,
}: {
  videoId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correct_option_id: 'a',
    explanation: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [videoId]);

  async function fetchQuestions() {
    const { data } = await supabase
      .from('video_quizzes')
      .select('*')
      .eq('video_id', videoId)
      .order('display_order');
    setQuestions(data || []);
    setLoading(false);
  }

  async function addQuestion() {
    if (!newQuestion.question_text || !newQuestion.options.some(o => o.text)) return;
    setSaving(true);

    await supabase.from('video_quizzes').insert({
      video_id: videoId,
      question_text: newQuestion.question_text,
      options: newQuestion.options.filter(o => o.text),
      correct_option_id: newQuestion.correct_option_id,
      explanation: newQuestion.explanation,
      display_order: questions.length,
    });

    setNewQuestion({
      question_text: '',
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ],
      correct_option_id: 'a',
      explanation: '',
    });
    setSaving(false);
    fetchQuestions();
    onSave();
  }

  async function deleteQuestion(id: string) {
    await supabase.from('video_quizzes').delete().eq('id', id);
    fetchQuestions();
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Manage Quiz Questions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        <div className="p-6">
          {/* Existing Questions */}
          {questions.length > 0 && (
            <div className="mb-6 space-y-3">
              <h3 className="font-medium text-gray-900">Existing Questions ({questions.length})</h3>
              {questions.map((q, idx) => (
                <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">Q{idx + 1}: {q.question_text}</p>
                      <p className="text-sm text-green-600 mt-1">
                        Correct: {q.options.find((o: any) => o.id === q.correct_option_id)?.text}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Question */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-medium text-gray-900 mb-4">Add New Question</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  type="text"
                  value={newQuestion.question_text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                  placeholder="What sound does 'ph' make?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {newQuestion.options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={newQuestion.correct_option_id === opt.id}
                      onChange={() => setNewQuestion({ ...newQuestion, correct_option_id: opt.id })}
                      className="text-[#7b008b]"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const options = [...newQuestion.options];
                        options[idx].text = e.target.value;
                        setNewQuestion({ ...newQuestion, options });
                      }}
                      placeholder={`Option ${opt.id.toUpperCase()}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (shown after answer)</label>
                <input
                  type="text"
                  value={newQuestion.explanation}
                  onChange={(e) => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                  placeholder="'ph' makes the /f/ sound, like in 'phone'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                />
              </div>

              <button
                onClick={addQuestion}
                disabled={saving || !newQuestion.question_text}
                className="w-full py-2 bg-[#7b008b] text-white rounded-lg font-medium hover:bg-[#6a0078] disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ANALYTICS TAB (Placeholder)
// =============================================================================
function AnalyticsTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Analytics Coming Soon</h3>
      <p className="text-gray-500">Track video engagement, completion rates, and quiz performance</p>
    </div>
  );
}

// =============================================================================
// ASSIGNMENTS TAB (Placeholder)
// =============================================================================
function AssignmentsTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Video Assignments</h3>
      <p className="text-gray-500">Coaches can assign specific videos to students from here</p>
    </div>
  );
}
