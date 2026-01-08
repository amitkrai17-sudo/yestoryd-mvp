// =============================================================================
// VIDEO PLAYER COMPONENT - FIXED VIEWPORT
// =============================================================================

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, X, RotateCcw, Check } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  onComplete: () => void;
  onExit: () => void;
}

export default function VideoPlayer({
  videoId,
  title,
  onComplete,
  onExit,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubeId, setYoutubeId] = useState<string | null>(null);

  useEffect(() => {
    fetchVideo();
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/elearning/video/${videoId}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load video');
      setVideoData(data.video);
      const url = data.video.video_url || '';
      const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch) {
        setIsYouTube(true);
        setYoutubeId(ytMatch[1]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isYouTube || !youtubeId) return;
    const timer = setTimeout(() => setIsComplete(true), 20000);
    return () => clearTimeout(timer);
  }, [isYouTube, youtubeId]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">??</div>
          <p className="text-white mb-4">{error}</p>
          <button onClick={onExit} className="bg-white text-black px-6 py-2 rounded-full font-medium">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isYouTube && youtubeId) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Header - 56px */}
        <div className="h-14 flex-shrink-0 px-4 flex items-center justify-between">
          <button onClick={onExit} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-white font-medium truncate max-w-[50%] text-sm">{title}</h2>
          {isComplete ? (
            <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> Watched!
            </div>
          ) : <div className="w-16" />}
        </div>

        {/* Video - calc(100% - header - footer) */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <div className="w-full h-full max-w-4xl max-h-[calc(100vh-180px)]">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={title}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Footer - 80px */}
        <div className="h-20 flex-shrink-0 flex items-center justify-center px-4">
          <motion.button
            onClick={() => { setIsComplete(true); onComplete(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold ${
              isComplete ? 'bg-green-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Check className="w-5 h-5" />
            {isComplete ? "Done! Continue ?" : "I've finished watching"}
          </motion.button>
        </div>
      </div>
    );
  }

  // Native video player (fallback)
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="h-14 flex-shrink-0 px-4 flex items-center justify-between">
        <button onClick={onExit} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-white font-medium truncate max-w-[50%] text-sm">{title}</h2>
        <div className="w-10" />
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoData?.video_url}
          className="max-w-full max-h-full"
          controls
          playsInline
          onEnded={() => setIsComplete(true)}
        />
      </div>
      <div className="h-20 flex-shrink-0 flex items-center justify-center">
        {isComplete && (
          <motion.button
            onClick={onComplete}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-green-500 text-white font-semibold"
          >
            <Check className="w-5 h-5" /> Done! Continue ?
          </motion.button>
        )}
      </div>
    </div>
  );
}
