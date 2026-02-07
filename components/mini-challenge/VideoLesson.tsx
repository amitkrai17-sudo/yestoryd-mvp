// ============================================================
// FILE: components/mini-challenge/VideoLesson.tsx
// ============================================================
// Video lesson player with skip delay
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

interface VideoLessonProps {
  videoUrl: string;
  title: string;
  skipDelaySeconds: number;
  onComplete: (watchPercent: number) => void;
  onSkip: () => void;
}

export function VideoLesson({
  videoUrl,
  title,
  skipDelaySeconds,
  onComplete,
  onSkip
}: VideoLessonProps) {
  const [canSkip, setCanSkip] = useState(false);
  const [secondsWatched, setSecondsWatched] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, skipDelaySeconds * 1000);

    const watchTimer = setInterval(() => {
      setSecondsWatched(s => s + 1);
    }, 1000);

    return () => {
      clearTimeout(skipTimer);
      clearInterval(watchTimer);
    };
  }, [skipDelaySeconds, isPlaying]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handleVideoEnd = () => {
    onComplete(100);
  };

  const handleSkip = () => {
    const estimatedDuration = 120;
    const watchPercent = Math.min(100, Math.round((secondsWatched / estimatedDuration) * 100));
    onSkip();
  };

  // Convert YouTube URL to embed format if needed
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/embed')) return url;
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-gray-400 text-sm">Now let's learn more</p>
        <h3 className="text-white font-medium">{title}</h3>
      </div>

      <div className="aspect-video bg-gray-800 rounded-2xl overflow-hidden relative">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <div className="w-16 h-16 bg-[#FF0099] rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </button>
        ) : (
          <iframe
            src={`${getEmbedUrl(videoUrl)}?autoplay=1&rel=0`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">
          {isPlaying && `Watched: ${Math.floor(secondsWatched / 60)}:${(secondsWatched % 60).toString().padStart(2, '0')}`}
        </p>

        {canSkip && (
          <button
            onClick={handleSkip}
            className="text-gray-500 text-sm underline hover:text-gray-400 transition-colors"
          >
            Skip video
          </button>
        )}
      </div>

      {isPlaying && (
        <button
          onClick={() => onComplete(Math.min(100, Math.round((secondsWatched / 120) * 100)))}
          className="w-full h-12 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold rounded-xl transition-colors"
        >
          I've finished watching
        </button>
      )}
    </div>
  );
}
